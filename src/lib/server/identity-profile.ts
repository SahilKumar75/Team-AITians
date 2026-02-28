import { ethers } from "ethers";
import { fetchIdentity, fetchIdentityByWallet } from "@/lib/blockchain";
import { normalizeIdentifier } from "@/lib/identifier";
import { catFromIPFSNode, isIPFSNodeConfigured } from "@/lib/ipfs-node";
import { fetchFromPinataGateway } from "@/lib/pinata-server";

interface IdentityLike {
  lockACid: string;
  emergencyCid?: string;
  walletAddress: string;
  role: string;
}

interface LockPayload {
  profileCid?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
  identifierRaw?: string;
  [key: string]: unknown;
}

interface CachedProfilePayload {
  profile: Record<string, unknown> | null;
  lockPayload: LockPayload | null;
  error?: string;
}

const PROFILE_CACHE_TTL_MS = Math.max(10_000, Number(process.env.IDENTITY_PROFILE_CACHE_TTL_MS || 90_000));
const LOCK_CACHE_TTL_MS = Math.max(10_000, Number(process.env.IDENTITY_LOCK_CACHE_TTL_MS || 120_000));

const lockJsonCache = new Map<string, { expiresAt: number; value: LockPayload | null }>();
const profileByLockCache = new Map<string, { expiresAt: number; value: CachedProfilePayload }>();
const profileInflightByLock = new Map<string, Promise<CachedProfilePayload>>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function fetchCidArrayBuffer(cid: string): Promise<ArrayBuffer> {
  if (isIPFSNodeConfigured()) {
    try {
      return await catFromIPFSNode(cid);
    } catch {
      // fallback to gateway
    }
  }
  return fetchFromPinataGateway(cid);
}

export async function fetchJsonByCidServer(cid: string): Promise<unknown> {
  const arr = await fetchCidArrayBuffer(cid);
  const text = new TextDecoder().decode(new Uint8Array(arr));
  return JSON.parse(text) as unknown;
}

export async function resolveIdentity(
  identifierOrWallet?: string | null
): Promise<{ identity: IdentityLike | null; normalizedIdentifier?: string }> {
  const input = (identifierOrWallet || "").trim();
  if (!input) return { identity: null };

  if (ethers.isAddress(input)) {
    const byWallet = await fetchIdentityByWallet(input);
    if (!byWallet) return { identity: null };
    return {
      identity: {
        lockACid: byWallet.lockACid,
        emergencyCid: byWallet.emergencyCid,
        walletAddress: byWallet.walletAddress,
        role: byWallet.role,
      },
    };
  }

  const normalizedIdentifier = normalizeIdentifier(input);
  const byIdentifier = await fetchIdentity(normalizedIdentifier);
  if (!byIdentifier) return { identity: null, normalizedIdentifier };
  return {
    identity: {
      lockACid: byIdentifier.lockACid,
      emergencyCid: byIdentifier.emergencyCid,
      walletAddress: byIdentifier.walletAddress,
      role: byIdentifier.role,
    },
    normalizedIdentifier,
  };
}

export async function loadProfileFromCid(cid: string): Promise<Record<string, unknown> | null> {
  const normalized = (cid || "").trim();
  if (!normalized) return null;
  try {
    const profileRaw = await fetchJsonByCidServer(normalized);
    const envelope = asRecord(profileRaw);
    if (!envelope) return null;
    const fromEnvelope = asRecord(envelope.profile);
    return fromEnvelope ?? envelope;
  } catch {
    return null;
  }
}

export async function loadProfileFromIdentity(identity: IdentityLike): Promise<{
  profile: Record<string, unknown> | null;
  lockPayload: LockPayload | null;
  error?: string;
}> {
  const lockCid = (identity.lockACid || "").trim();
  if (!lockCid) return { profile: null, lockPayload: null };

  const now = Date.now();
  const cached = profileByLockCache.get(lockCid);
  if (cached && cached.expiresAt > now) return cached.value;

  const inflight = profileInflightByLock.get(lockCid);
  if (inflight) return inflight;

  const task = (async (): Promise<CachedProfilePayload> => {
    let lock: LockPayload | null = null;
    const lockCached = lockJsonCache.get(lockCid);
    if (lockCached && lockCached.expiresAt > Date.now()) {
      lock = lockCached.value;
    } else {
      try {
        const lockRaw = await fetchJsonByCidServer(lockCid);
        lock = asRecord(lockRaw) as LockPayload | null;
        lockJsonCache.set(lockCid, { expiresAt: Date.now() + LOCK_CACHE_TTL_MS, value: lock });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load lock payload from IPFS";
        console.warn("loadProfileFromIdentity: lock payload fetch failed", message);
        const stale = profileByLockCache.get(lockCid)?.value;
        if (stale) return stale;
        const payload = { profile: null, lockPayload: null, error: message };
        profileByLockCache.set(lockCid, { expiresAt: Date.now() + 10_000, value: payload });
        return payload;
      }
    }

    const profileCid = asString(lock?.profileCid);
    if (!profileCid) {
      const payload = { profile: null, lockPayload: lock };
      profileByLockCache.set(lockCid, { expiresAt: Date.now() + PROFILE_CACHE_TTL_MS, value: payload });
      return payload;
    }

    try {
      const profileRaw = await fetchJsonByCidServer(profileCid);
      const envelope = asRecord(profileRaw);
      if (!envelope) {
        const payload = { profile: null, lockPayload: lock };
        profileByLockCache.set(lockCid, { expiresAt: Date.now() + PROFILE_CACHE_TTL_MS, value: payload });
        return payload;
      }
      const fromEnvelope = asRecord(envelope.profile);
      const payload = { profile: fromEnvelope ?? envelope, lockPayload: lock };
      profileByLockCache.set(lockCid, { expiresAt: Date.now() + PROFILE_CACHE_TTL_MS, value: payload });
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load profile payload from IPFS";
      console.warn("loadProfileFromIdentity: profile payload fetch failed", message);
      const stale = profileByLockCache.get(lockCid)?.value;
      if (stale) return stale;
      const payload = { profile: null, lockPayload: lock, error: message };
      profileByLockCache.set(lockCid, { expiresAt: Date.now() + 10_000, value: payload });
      return payload;
    }
  })();

  profileInflightByLock.set(lockCid, task);
  try {
    return await task;
  } finally {
    profileInflightByLock.delete(lockCid);
  }
}
