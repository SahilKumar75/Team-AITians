#!/usr/bin/env node
/**
 * Repair on-chain lockACid pointer for selected wallets.
 *
 * What it does per wallet:
 * 1) Reads IdentityRegistry identity + current lock payload (if available).
 * 2) Reads current profile payload via lock.profileCid (if available).
 * 3) Creates/updates a valid profile envelope and lock payload with profileCid.
 * 4) Calls updateLockA(idHash, newLockCid) signed by THAT wallet.
 *
 * IMPORTANT:
 * - IdentityRegistry.updateLockA is onlyWallet(idHash). You must provide each wallet's private key.
 * - This script does not use DEPLOYER key for updates.
 *
 * Env:
 * - NEXT_PUBLIC_POLYGON_RPC_URL / POLYGON_RPC_URL
 * - NEXT_PUBLIC_POLYGON_CHAIN_ID
 * - NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS
 * - PINATA_JWT
 * - PINATA_GATEWAY (optional; default https://gateway.pinata.cloud)
 * - MIGRATION_PRIVATE_KEYS (comma-separated private keys)
 * - TARGET_WALLETS (optional, comma-separated wallet addresses; if set, only these are processed)
 * - FORCE_REWRITE=true (optional; rewrites even when lock already has profileCid)
 */

import { ethers } from "ethers";

const RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ||
  process.env.POLYGON_RPC_URL ||
  "https://rpc-amoy.polygon.technology";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || "80002");
const IDENTITY_REGISTRY = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "";
const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY = (process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/$/, "");
const FORCE_REWRITE = process.env.FORCE_REWRITE === "true";

const privateKeys = (process.env.MIGRATION_PRIVATE_KEYS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const targetWallets = new Set(
  (process.env.TARGET_WALLETS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
);

const IDENTITY_ABI = [
  "function walletToIdentifier(address wallet) external view returns (bytes32)",
  "function getIdentity(bytes32 idHash) external view returns (tuple(string lockACid, string lockCCid, bytes32 recoveryKeyHash, string emergencyCid, address wallet, bytes32 role, bytes32 licenseHash, bool exists, string title))",
  "function updateLockA(bytes32 idHash, string newLockA) external",
];

function asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function decodeRole(bytes32Role) {
  try {
    return ethers.decodeBytes32String(bytes32Role || "0x");
  } catch {
    return "unknown";
  }
}

async function fetchJsonFromGateway(cid) {
  if (!cid) return { ok: false, status: 0, body: "", json: null };
  const headers = PINATA_JWT ? { Authorization: `Bearer ${PINATA_JWT}` } : {};
  try {
    const res = await fetch(`${PINATA_GATEWAY}/ipfs/${encodeURIComponent(cid)}`, { headers });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, body: text, json: null };
    try {
      return { ok: true, status: 200, body: text, json: JSON.parse(text) };
    } catch {
      return { ok: false, status: 200, body: text, json: null };
    }
  } catch (error) {
    return { ok: false, status: 0, body: String(error?.message || error), json: null };
  }
}

async function pinJsonToPinata(payload, name) {
  if (!PINATA_JWT) throw new Error("PINATA_JWT is required for migration.");
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataMetadata: {
        name,
        keyvalues: {
          migratedAt: new Date().toISOString(),
        },
      },
      pinataContent: payload,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`pinJSONToIPFS failed: ${res.status} ${text.slice(0, 240)}`);
  }
  const json = JSON.parse(text);
  if (!json.IpfsHash) throw new Error("pinJSONToIPFS response missing IpfsHash");
  return json.IpfsHash;
}

function normalizeProfile(existingProfile, lockObj, identity, wallet) {
  const role = decodeRole(identity.role);
  const base = asObject(existingProfile) || {};
  const merged = {
    fullName:
      (typeof base.fullName === "string" && base.fullName.trim()) ||
      (typeof base.name === "string" && base.name.trim()) ||
      (typeof lockObj?.fullName === "string" && lockObj.fullName.trim()) ||
      (typeof lockObj?.name === "string" && lockObj.name.trim()) ||
      (typeof identity.title === "string" && identity.title.trim()) ||
      "",
    email:
      (typeof base.email === "string" && base.email.trim()) ||
      (typeof lockObj?.email === "string" && lockObj.email.trim()) ||
      "",
    phone:
      (typeof base.phone === "string" && base.phone.trim()) ||
      (typeof lockObj?.phone === "string" && lockObj.phone.trim()) ||
      "",
    preferredLanguage:
      (typeof base.preferredLanguage === "string" && base.preferredLanguage.trim()) ||
      (typeof lockObj?.preferredLanguage === "string" && lockObj.preferredLanguage.trim()) ||
      "en",
    role,
    walletAddress: wallet,
    migratedAt: Date.now(),
    schemaVersion: 2,
  };
  return { ...base, ...merged };
}

function normalizeLockPayload(lockObj, profileCid, identity, wallet) {
  const role = decodeRole(identity.role);
  const base = asObject(lockObj) || {};
  return {
    ...base,
    role: typeof base.role === "string" && base.role.trim() ? base.role : role,
    identifierRaw:
      (typeof base.identifierRaw === "string" && base.identifierRaw.trim()) ||
      (typeof base.email === "string" && base.email.trim()) ||
      (typeof base.phone === "string" && base.phone.trim()) ||
      wallet,
    email: typeof base.email === "string" ? base.email : "",
    phone: typeof base.phone === "string" ? base.phone : "",
    preferredLanguage:
      typeof base.preferredLanguage === "string" && base.preferredLanguage.trim()
        ? base.preferredLanguage
        : "en",
    profileCid,
    // keep audit fields
    migratedAt: Date.now(),
    lockSchemaVersion: 2,
  };
}

async function processWallet(privateKey, provider, identityContract) {
  const walletSigner = new ethers.Wallet(privateKey, provider);
  const wallet = walletSigner.address.toLowerCase();
  if (targetWallets.size > 0 && !targetWallets.has(wallet)) {
    return { wallet, skipped: true, reason: "not in TARGET_WALLETS" };
  }

  const idHash = await identityContract.walletToIdentifier(wallet);
  if (!idHash || idHash === ethers.ZeroHash) {
    return { wallet, skipped: true, reason: "no identity mapped to wallet" };
  }

  const identity = await identityContract.getIdentity(idHash);
  if (!identity?.exists) {
    return { wallet, skipped: true, reason: "identity does not exist" };
  }

  const lockCid = String(identity.lockACid || "").trim();
  const lockRes = await fetchJsonFromGateway(lockCid);
  const lockObj = asObject(lockRes.json);
  const currentProfileCid = typeof lockObj?.profileCid === "string" ? lockObj.profileCid.trim() : "";
  const profileRes = currentProfileCid ? await fetchJsonFromGateway(currentProfileCid) : null;
  const profilePayload = asObject(profileRes?.json?.profile) || asObject(profileRes?.json);

  const hasUsableProfilePointer = !!currentProfileCid && !!profileRes?.ok;
  if (hasUsableProfilePointer && !FORCE_REWRITE) {
    return {
      wallet,
      idHash,
      unchanged: true,
      reason: "lock payload already has reachable profileCid",
      lockCid,
      profileCid: currentProfileCid,
    };
  }

  const normalizedProfile = normalizeProfile(profilePayload, lockObj, identity, wallet);
  const profileEnvelope = {
    version: 1,
    profile: normalizedProfile,
  };
  const newProfileCid = await pinJsonToPinata(profileEnvelope, `profile-${wallet}-${Date.now()}`);
  const newLockPayload = normalizeLockPayload(lockObj, newProfileCid, identity, wallet);
  const newLockCid = await pinJsonToPinata(newLockPayload, `lockA-${wallet}-${Date.now()}`);

  const signerContract = identityContract.connect(walletSigner);
  const tx = await signerContract.updateLockA(idHash, newLockCid);
  const receipt = await tx.wait();

  return {
    wallet,
    idHash,
    updated: true,
    oldLockCid: lockCid,
    newLockCid,
    newProfileCid,
    txHash: receipt?.hash || tx.hash,
  };
}

async function main() {
  if (!IDENTITY_REGISTRY) {
    throw new Error("NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS is required.");
  }
  if (privateKeys.length === 0) {
    throw new Error("MIGRATION_PRIVATE_KEYS is empty. Provide comma-separated private keys of wallets to repair.");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const contract = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, provider);

  const results = [];
  for (const key of privateKeys) {
    try {
      const result = await processWallet(key, provider, contract);
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const wallet = (() => {
        try {
          return new ethers.Wallet(key).address.toLowerCase();
        } catch {
          return "invalid-key";
        }
      })();
      const failure = {
        wallet,
        updated: false,
        error: String(error?.message || error),
      };
      results.push(failure);
      console.log(JSON.stringify(failure, null, 2));
    }
  }

  const summary = {
    total: results.length,
    updated: results.filter((r) => r.updated).length,
    unchanged: results.filter((r) => r.unchanged).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => r.updated === false && r.error).length,
  };

  console.log("---- SUMMARY ----");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

