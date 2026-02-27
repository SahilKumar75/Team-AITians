/**
 * MRC-inspired identity (IPFS + Blockchain).
 * 
 * Registration: Generate wallet → encrypt privKey with Argon2id(password) → pin to IPFS → register on IdentityRegistry.
 * Login: Check localStorage cache → if miss, fetch lockACid from chain → download from IPFS → decrypt.
 * 
 * No recovery phrase. Social recovery via guardian voting (IdentityRegistry.sol) replaces it.
 */

import { Wallet, ethers, type HDNodeWallet } from "ethers";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { normalizeIdentifier } from "./identifier";

export type Role = "patient" | "doctor" | "hospital";

export interface UnlockedIdentity {
  wallet: Wallet | HDNodeWallet;
  role: Role;
  identifier: string;
}

export interface IdentityContactMeta {
  email?: string;
  phone?: string;
  preferredLanguage?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "swasthya_identity_store";
const IDENTIFIER_ALIAS_KEY = "swasthya_identifier_alias";
const ALG = "AES-GCM";
const IV_LEN = 12;
const TAG_LEN = 128;

export function getIdentityStorageKey(identifier: string): string {
  const norm = normalizeIdentifier(identifier);
  return `${STORAGE_KEY}:${bytesToHex(sha256(new TextEncoder().encode(norm))).slice(0, 32)}`;
}

function storageKey(identifier: string): string {
  return getIdentityStorageKey(identifier);
}

function aliasKey(identifier: string): string {
  return `${IDENTIFIER_ALIAS_KEY}:${normalizeIdentifier(identifier)}`;
}

function saveIdentifierAlias(alias: string, primary: string): void {
  if (typeof window === "undefined") return;
  const a = normalizeIdentifier(alias);
  const p = normalizeIdentifier(primary);
  if (!a || !p) return;
  try {
    localStorage.setItem(aliasKey(a), p);
  } catch {
    // ignore
  }
}

function resolveIdentifierAlias(identifier: string): string {
  if (typeof window === "undefined") return identifier;
  const id = normalizeIdentifier(identifier);
  try {
    const mapped = localStorage.getItem(aliasKey(id));
    return mapped || id;
  } catch {
    return id;
  }
}

// ─── Key Derivation ──────────────────────────────────────────────────────────

/** Derive 32-byte key with PBKDF2 (fallback). */
async function deriveKeyPBKDF2(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    baseKey,
    256
  );
  return crypto.subtle.importKey(
    "raw",
    bits,
    { name: ALG, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Derive with Argon2id (preferred); fallback to PBKDF2 on failure. */
async function deriveKey(password: string, salt: Uint8Array, useArgon2 = false): Promise<CryptoKey> {
  if (useArgon2 && typeof window !== "undefined") {
    try {
      const { argon2idDerive } = await import("./argon2-browser-shim");
      const keyBytes = await argon2idDerive(password, salt);
      return crypto.subtle.importKey(
        "raw",
        keyBytes as BufferSource,
        { name: ALG, length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    } catch {
      /* fallback to PBKDF2 */
    }
  }
  return deriveKeyPBKDF2(password, salt);
}

/** Argon2id only (no fallback). For unlocking v3 accounts. */
async function deriveKeyArgon2Only(password: string, salt: Uint8Array): Promise<CryptoKey | null> {
  if (typeof window === "undefined") return null;
  try {
    const { argon2idDerive } = await import("./argon2-browser-shim");
    const keyBytes = await argon2idDerive(password, salt);
    return crypto.subtle.importKey(
      "raw",
      keyBytes as BufferSource,
      { name: ALG, length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

// ─── Encryption Helpers ──────────────────────────────────────────────────────

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  }
  return buf;
}

const toB64 = (u: Uint8Array) => btoa(String.fromCharCode.apply(null, Array.from(u)));
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

async function encryptPrivateKey(privateKey: string, key: CryptoKey): Promise<{ iv: string; cipher: string }> {
  const iv = randomBytes(IV_LEN);
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: ALG, iv: iv as BufferSource, tagLength: TAG_LEN },
    key,
    enc.encode(privateKey)
  );
  return {
    iv: toB64(iv),
    cipher: toB64(new Uint8Array(cipher)),
  };
}

async function decryptPrivateKey(ivB64: string, cipherB64: string, key: CryptoKey): Promise<string> {
  const iv = fromB64(ivB64);
  const cipher = fromB64(cipherB64);
  const dec = await crypto.subtle.decrypt(
    { name: ALG, iv: iv as BufferSource, tagLength: TAG_LEN },
    key,
    cipher as BufferSource
  );
  return new TextDecoder().decode(dec);
}

// ─── IPFS + Chain Helpers ────────────────────────────────────────────────────

/** Pin encrypted identity payload to IPFS. Returns CID. */
async function pinIdentityToIPFS(payload: object): Promise<string> {
  // Use the existing uploadJSON from ipfs.ts (supports Pinata + own node)
  const { uploadJSON } = await import("./ipfs");
  return uploadJSON(payload);
}

/** Fetch encrypted identity payload from IPFS by CID. */
async function fetchIdentityFromIPFS(cid: string): Promise<{
  version: number;
  salt: string;
  iv: string;
  cipher: string;
  role: string;
  identifierRaw: string;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
}> {
  const { fetchJSONFromIPFS } = await import("./ipfs");
  return fetchJSONFromIPFS(cid) as Promise<{
    version: number;
    salt: string;
    iv: string;
    cipher: string;
    role: string;
    identifierRaw: string;
    email?: string;
    phone?: string;
    preferredLanguage?: string;
  }>;
}

/** Register identity on IdentityRegistry smart contract. */
async function registerOnChain(
  wallet: Wallet | HDNodeWallet,
  identifier: string,
  lockACid: string,
  role: Role,
  licenseNumber?: string
): Promise<void> {
  const { getIdentityContract, getProvider } = await import("./blockchain");
  const provider = getProvider();
  const signer = wallet.connect(provider);

  // Fresh generated wallets have zero gas. Ask backend sponsor to fund a small amount first.
  const bal = await provider.getBalance(wallet.address);
  if (bal === BigInt(0) && typeof window !== "undefined") {
    try {
      const fundRes = await fetch("/api/auth/fund-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });
      if (!fundRes.ok) {
        const err = await fundRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Could not sponsor gas for registration");
      }
    } catch (e) {
      throw new Error(
        e instanceof Error
          ? `Registration failed: ${e.message}`
          : "Registration failed: unable to fund new wallet for gas"
      );
    }
  }

  const contract = getIdentityContract(signer);

  const norm = normalizeIdentifier(identifier);
  const idHash = ethers.keccak256(ethers.toUtf8Bytes(norm));
  const roleBytes32 = ethers.encodeBytes32String(role);
  const licenseHash = licenseNumber
    ? ethers.keccak256(ethers.toUtf8Bytes(licenseNumber))
    : ethers.ZeroHash;

  const tx = await contract.register(
    idHash,       // identifierHash
    lockACid,     // lockACid (IPFS CID of encrypted private key)
    "",           // lockCCid (no recovery phrase — social recovery instead)
    ethers.ZeroHash, // recoveryKeyHash (unused)
    "",           // emergencyCid (can be set later)
    roleBytes32,  // role
    licenseHash   // licenseHash
  );
  await tx.wait();
}

/** Fetch identity from chain by identifier. Returns lockACid and role. */
async function fetchIdentityFromChain(identifier: string): Promise<{
  lockACid: string;
  role: string;
  wallet: string;
} | null> {
  try {
    const { fetchIdentity } = await import("./blockchain");
    const identity = await fetchIdentity(identifier);
    if (!identity || !identity.lockACid) return null;
    return {
      lockACid: identity.lockACid,
      role: identity.role,
      wallet: identity.walletAddress,
    };
  } catch {
    return null;
  }
}

// ─── Create Identity (Registration) ─────────────────────────────────────────

/**
 * Create identity: 
 * 1. Generate wallet
 * 2. Encrypt private key with Argon2id(password)
 * 3. Pin encrypted payload to IPFS → get lockACid
 * 4. Register on IdentityRegistry with lockACid
 * 5. Cache to localStorage for fast re-login
 */
export async function createIdentity(params: {
  identifier: string;
  password: string;
  role: Role;
  licenseNumber?: string;
  contactMeta?: IdentityContactMeta;
}): Promise<UnlockedIdentity> {
  const identifier = params.identifier.trim();
  const password = params.password.trim();
  const { role, licenseNumber, contactMeta } = params;
  const wallet = Wallet.createRandom();

  if (typeof window === "undefined") {
    return { wallet, role, identifier };
  }

  // Step 1: Encrypt private key
  const salt = randomBytes(16);
  let key: CryptoKey;
  let version = 2;
  try {
    key = await deriveKey(`${normalizeIdentifier(identifier)}:${password}`, salt, true);
    version = 3;
  } catch {
    key = await deriveKeyPBKDF2(`${normalizeIdentifier(identifier)}:${password}`, salt);
  }
  const { iv, cipher } = await encryptPrivateKey(wallet.privateKey, key);

  const payload = {
    version,
    salt: toB64(salt),
    iv,
    cipher,
    role,
    identifierRaw: identifier,
    email: contactMeta?.email ? normalizeIdentifier(contactMeta.email) : undefined,
    phone: contactMeta?.phone ? normalizeIdentifier(contactMeta.phone) : undefined,
    preferredLanguage: contactMeta?.preferredLanguage || undefined,
  };

  let lockACid = "";
  try {
    // Step 2: Pin to IPFS
    lockACid = await pinIdentityToIPFS(payload);
  } catch (e) {
    throw new Error(e instanceof Error ? `IPFS upload failed: ${e.message}` : "IPFS upload failed");
  }

  try {
    // Step 3: Register on-chain
    await registerOnChain(wallet, identifier, lockACid, role, licenseNumber);
  } catch (e) {
    throw new Error(e instanceof Error ? `On-chain registration failed: ${e.message}` : "On-chain registration failed");
  }

  // Step 4: Cache to localStorage for fast re-login on this device
  const keyStr = storageKey(identifier);
  const localPayload = { ...payload, lockACid };
  localStorage.setItem(keyStr, JSON.stringify(localPayload));
  if (contactMeta?.email) saveIdentifierAlias(contactMeta.email, identifier);
  if (contactMeta?.phone) saveIdentifierAlias(contactMeta.phone, identifier);
  saveIdentifierAlias(identifier, identifier);

  return { wallet, role, identifier };
}

// ─── Unlock Identity (Login) ─────────────────────────────────────────────────

/**
 * Login flow:
 * 1. Check localStorage cache → if found, decrypt directly (fast path)
 * 2. If no cache: fetch lockACid from chain → download from IPFS → decrypt
 * 3. Cache to localStorage for next time
 */
export async function unlockWithPassword(
  identifier: string,
  password: string
): Promise<UnlockedIdentity | null> {
  if (typeof window === "undefined") return null;
  const input = identifier.trim();
  const id = resolveIdentifierAlias(input);
  const pass = password.trim();
  const keyStr = storageKey(id);

  // ── Preferred path: Chain + IPFS ───────────────────────────────────────
  try {
    const chainIdentity = await fetchIdentityFromChain(id);
    if (!chainIdentity || !chainIdentity.lockACid) {
      // Continue to device cache fallback.
    } else {
      // Download encrypted payload from IPFS
      const payload = await fetchIdentityFromIPFS(chainIdentity.lockACid);
      if (payload) {
        // Try to decrypt
        const raw = JSON.stringify(payload);
        const result = await tryDecryptPayload(raw, id, pass);
        if (result) {
          // Cache to localStorage for faster future logins on this device
          const localPayload = { ...payload, lockACid: chainIdentity.lockACid };
          localStorage.setItem(keyStr, JSON.stringify(localPayload));
          if (typeof payload.email === "string") saveIdentifierAlias(payload.email, id);
          if (typeof payload.phone === "string") saveIdentifierAlias(payload.phone, id);
          return result;
        }
      }
    }
  } catch (e) {
    console.warn("Chain+IPFS login failed, trying device cache:", e);
  }

  // ── Fallback path: local device cache ──────────────────────────────────
  const cached = localStorage.getItem(keyStr);
  if (cached) {
    const result = await tryDecryptPayload(cached, id, pass);
    if (result) return result;
  }

  return null;
}

/** Try to decrypt an identity payload (JSON string). Handles v1, v2, v3 formats. */
async function tryDecryptPayload(
  raw: string,
  identifier: string,
  password: string
): Promise<UnlockedIdentity | null> {
  try {
    const payload = JSON.parse(raw);
    const displayId = payload.identifierRaw ?? identifier;
    const norm = normalizeIdentifier(identifier);

    if (payload.version === 2 || payload.version === 3) {
      const salt = fromB64(payload.salt);
      const passwordString = `${norm}:${password}`;
      let key: CryptoKey;
      if (payload.version === 3) {
        const argonKey = await deriveKeyArgon2Only(passwordString, salt);
        if (!argonKey) return null;
        key = argonKey;
      } else {
        key = await deriveKeyPBKDF2(passwordString, salt);
      }
      const privateKey = await decryptPrivateKey(payload.iv, payload.cipher, key);
      const wallet = new Wallet(privateKey);
      return { wallet, role: payload.role as Role, identifier: displayId };
    }

    // V1 fallback (legacy: passwordHash comparison)
    const passwordHash = bytesToHex(sha256(new TextEncoder().encode(`${norm}:${password}`)));
    if (payload.passwordHash !== passwordHash) return null;
    const wallet = new Wallet(payload.privateKey);
    return { wallet, role: payload.role as Role, identifier: displayId };
  } catch {
    return null;
  }
}
