import { ethers, type Signer } from "ethers";
import { normalizeIdentifier } from "@/lib/identifier";
import { fetchIdentity, fetchIdentityByWallet, getIdentityContract } from "@/lib/blockchain";
import { fetchJSONFromIPFS, uploadJSON } from "@/lib/ipfs";

export interface RoleProfileEnvelope {
  version: 1;
  identifier: string;
  role: string;
  profile: Record<string, unknown>;
  updatedAt: string;
}

interface IdentityLockPayload {
  version?: number;
  salt?: string;
  iv?: string;
  cipher?: string;
  role?: string;
  identifierRaw?: string;
  profileCid?: string;
  updatedAt?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
  [key: string]: unknown;
}

export interface IdentityBootstrapProfile {
  email?: string;
  phone?: string;
  preferredLanguage?: string;
  identifierRaw?: string;
  role?: string;
}

interface ResolvedIdentityRef {
  identity: Awaited<ReturnType<typeof fetchIdentity>>;
  canonicalIdentifier: string;
}

const ROLE_PROFILE_CACHE_TTL_MS = Math.max(10_000, Number(process.env.NEXT_PUBLIC_ROLE_PROFILE_CACHE_TTL_MS || 60_000));
const roleProfileCache = new Map<string, { expiresAt: number; value: Record<string, unknown> | null }>();
const roleProfileInflight = new Map<string, Promise<Record<string, unknown> | null>>();

async function resolveIdentityRef(
  identifier?: string,
  walletAddress?: string
): Promise<ResolvedIdentityRef> {
  const trimmedIdentifier = (identifier || "").trim();
  if (trimmedIdentifier) {
    const byIdentifier = await fetchIdentity(trimmedIdentifier);
    if (byIdentifier) {
      return {
        identity: byIdentifier,
        canonicalIdentifier: normalizeIdentifier(trimmedIdentifier),
      };
    }
  }

  const trimmedWallet = (walletAddress || "").trim();
  if (trimmedWallet) {
    const byWallet = await fetchIdentityByWallet(trimmedWallet);
    if (!byWallet) {
      throw new Error("Identity not found for wallet address.");
    }
    const payload = (await fetchJSONFromIPFS(byWallet.lockACid)) as IdentityLockPayload;
    const fromPayload =
      (typeof payload?.email === "string" && payload.email.trim()) ||
      (typeof payload?.identifierRaw === "string" && payload.identifierRaw.trim()) ||
      "";
    if (!fromPayload) {
      throw new Error("Unable to resolve canonical identifier from identity lock payload.");
    }
    return {
      identity: byWallet,
      canonicalIdentifier: normalizeIdentifier(fromPayload),
    };
  }

  throw new Error("Identifier or wallet address is required.");
}

export async function loadRoleProfileFromChain(
  identifier: string,
  walletAddress?: string
): Promise<Record<string, unknown> | null> {
  const key = `${(identifier || "").trim().toLowerCase()}|${(walletAddress || "").trim().toLowerCase()}`;
  const now = Date.now();
  const cached = roleProfileCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const inflight = roleProfileInflight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const { identity } = await resolveIdentityRef(identifier, walletAddress);
      if (!identity?.lockACid) return null;

      const payload = (await fetchJSONFromIPFS(identity.lockACid)) as IdentityLockPayload;
      if (!payload?.profileCid || typeof payload.profileCid !== "string") return null;

      const envelope = (await fetchJSONFromIPFS(payload.profileCid)) as Partial<RoleProfileEnvelope>;
      if (!envelope || typeof envelope !== "object") return null;
      if (!envelope.profile || typeof envelope.profile !== "object") return null;
      const value = envelope.profile as Record<string, unknown>;
      roleProfileCache.set(key, { expiresAt: Date.now() + ROLE_PROFILE_CACHE_TTL_MS, value });
      return value;
    } catch {
      roleProfileCache.set(key, { expiresAt: Date.now() + 10_000, value: null });
      return null;
    }
  })();

  roleProfileInflight.set(key, task);
  try {
    return await task;
  } finally {
    roleProfileInflight.delete(key);
  }
}

export async function saveRoleProfileToChain(
  identifier: string,
  signer: Signer,
  profile: Record<string, unknown>,
  walletAddress?: string
): Promise<{ profileCid: string; lockACid: string; txHash: string }> {
  const fallbackWallet = walletAddress || (await signer.getAddress().catch(() => ""));
  const { identity, canonicalIdentifier } = await resolveIdentityRef(identifier, fallbackWallet);
  if (!identity?.lockACid) {
    throw new Error("Identity lock not found on-chain for this account.");
  }

  const payload = (await fetchJSONFromIPFS(identity.lockACid)) as IdentityLockPayload;

  const envelope: RoleProfileEnvelope = {
    version: 1,
    identifier: canonicalIdentifier,
    role: identity.role,
    profile,
    updatedAt: new Date().toISOString(),
  };

  const profileCid = await uploadJSON(envelope);

  const nextPayload: IdentityLockPayload = {
    ...payload,
    profileCid,
    updatedAt: envelope.updatedAt,
  };
  const newLockACid = await uploadJSON(nextPayload);

  const idHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalIdentifier));
  const contract = getIdentityContract(signer);
  const tx = await contract.updateLockA(idHash, newLockACid);
  const receipt = await tx.wait();

  return {
    profileCid,
    lockACid: newLockACid,
    txHash: receipt.hash,
  };
}

export async function loadIdentityBootstrapFromChain(
  identifier: string,
  walletAddress?: string
): Promise<IdentityBootstrapProfile | null> {
  try {
    const { identity } = await resolveIdentityRef(identifier, walletAddress);
    if (!identity?.lockACid) return null;

    const payload = (await fetchJSONFromIPFS(identity.lockACid)) as IdentityLockPayload;
    if (!payload || typeof payload !== "object") return null;

    return {
      email: typeof payload.email === "string" ? payload.email : undefined,
      phone: typeof payload.phone === "string" ? payload.phone : undefined,
      preferredLanguage: typeof payload.preferredLanguage === "string" ? payload.preferredLanguage : undefined,
      identifierRaw: typeof payload.identifierRaw === "string" ? payload.identifierRaw : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
    };
  } catch {
    return null;
  }
}
