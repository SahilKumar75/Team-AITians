import { ethers } from "ethers";
import { fetchIdentity, fetchIdentityByWallet, getIdentityContract } from "@/lib/blockchain";
import { asString, loadProfileFromIdentity } from "@/lib/server/identity-profile";
import {
  getSubgraphMetaBlock,
  listPatientIdentitiesFromSubgraph,
  searchPatientIdentitiesByTitleFromSubgraph,
} from "@/lib/subgraph-directory";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export interface PatientDirectoryEntry {
  walletAddress: string;
  fullName: string;
  email: string;
  phone: string;
  profile: Record<string, unknown>;
}

interface PatientPointer {
  wallet: string;
  lockACid: string;
  title?: string;
}

interface CachedProfileRow {
  lockACid: string;
  entry: PatientDirectoryEntry;
  expiresAt: number;
}

const POINTER_CACHE_TTL_MS = Math.max(5000, Number(process.env.PATIENT_POINTER_CACHE_TTL_MS || 30000));
const PROFILE_CACHE_TTL_MS = Math.max(10_000, Number(process.env.PATIENT_PROFILE_CACHE_TTL_MS || 300_000));
const PROFILE_LOAD_CONCURRENCY = Math.max(2, Math.min(20, Number(process.env.PATIENT_PROFILE_LOAD_CONCURRENCY || 8)));
const SUBGRAPH_MAX_BLOCK_LAG = Math.max(5, Number(process.env.SUBGRAPH_MAX_BLOCK_LAG || 150));
const PATIENT_SEARCH_MAX_PROFILE_SCAN = Math.max(
  100,
  Number(process.env.PATIENT_SEARCH_MAX_PROFILE_SCAN || 500)
);

let pointerCache: { expiresAt: number; rows: PatientPointer[] } | null = null;
const profileCache = new Map<string, CachedProfileRow>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function isTimeoutLikeError(error: unknown): boolean {
  const e = error as { code?: number | string; message?: string; error?: { code?: number | string; message?: string } };
  const code = e?.error?.code ?? e?.code;
  const msg = `${e?.error?.message || ""} ${e?.message || ""}`.toLowerCase();
  return code === -32002 || msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout");
}

async function queryIdentityEventsAdaptive(
  contract: ethers.Contract,
  fromBlock: number,
  toBlock: number
): Promise<ethers.EventLog[]> {
  const filter = contract.filters.IdentityRegistered();
  try {
    return (await contract.queryFilter(filter, fromBlock, toBlock)) as ethers.EventLog[];
  } catch (error) {
    const span = toBlock - fromBlock;
    if (!isTimeoutLikeError(error) || span <= 1500) throw error;
    const mid = Math.floor((fromBlock + toBlock) / 2);
    const left = await queryIdentityEventsAdaptive(contract, fromBlock, mid);
    const right = await queryIdentityEventsAdaptive(contract, mid + 1, toBlock);
    return [...left, ...right];
  }
}

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}

function matchesNameEmailPhone(entry: PatientDirectoryEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qPhone = normalizePhone(q);
  return (
    entry.fullName.toLowerCase().includes(q) ||
    entry.email.toLowerCase().includes(q) ||
    (qPhone.length >= 3 && normalizePhone(entry.phone).includes(qPhone))
  );
}

async function buildPatientFromIdentity(identity: {
  walletAddress: string;
  lockACid: string;
  title?: string;
}): Promise<PatientDirectoryEntry | null> {
  if (isBlockedWallet(identity.walletAddress)) return null;
  if (!identity.walletAddress || !identity.lockACid) return null;
  const loaded = await loadProfileFromIdentity({
    walletAddress: identity.walletAddress,
    lockACid: identity.lockACid,
    role: "patient",
  });
  const profile = loaded.profile || {};
  const fullName =
    asString(profile.fullName, asString(profile.name, asString(identity.title, "Patient"))).trim() || "Patient";
  return {
    walletAddress: identity.walletAddress.toLowerCase(),
    fullName,
    email: asString(profile.email).trim(),
    phone: asString(profile.phone).trim(),
    profile,
  };
}

async function isSubgraphFreshEnough(): Promise<boolean> {
  try {
    const metaBlock = await getSubgraphMetaBlock();
    if (!metaBlock) return false;
    const contract = getIdentityContract();
    const provider = (contract.runner as { provider?: ethers.Provider } | null)?.provider;
    if (!provider) return true;
    const latest = await provider.getBlockNumber();
    return latest - metaBlock <= SUBGRAPH_MAX_BLOCK_LAG;
  } catch {
    return false;
  }
}

async function getPatientPointersFromSubgraph(): Promise<PatientPointer[]> {
  const now = Date.now();
  if (pointerCache && pointerCache.expiresAt > now) return pointerCache.rows;
  const rows = await listPatientIdentitiesFromSubgraph({ limit: 8000, pageSize: 500 });
  const normalized = rows
    .filter(
      (r) =>
        (r.role || "").toLowerCase() === "patient" &&
        !!r.wallet &&
        !!r.lockACid &&
        !isBlockedWallet(r.wallet)
    )
    .map((r) => ({ wallet: r.wallet.toLowerCase(), lockACid: r.lockACid, title: r.title }));
  pointerCache = { expiresAt: now + POINTER_CACHE_TTL_MS, rows: normalized };
  return normalized;
}

function getCachedProfile(wallet: string, lockACid: string): PatientDirectoryEntry | null {
  const hit = profileCache.get(wallet.toLowerCase());
  if (!hit) return null;
  if (hit.expiresAt <= Date.now() || hit.lockACid !== lockACid) {
    profileCache.delete(wallet.toLowerCase());
    return null;
  }
  return hit.entry;
}

function putCachedProfile(wallet: string, lockACid: string, entry: PatientDirectoryEntry): void {
  profileCache.set(wallet.toLowerCase(), {
    lockACid,
    entry,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  });
}

async function loadPatientByPointer(pointer: PatientPointer): Promise<PatientDirectoryEntry | null> {
  const cached = getCachedProfile(pointer.wallet, pointer.lockACid);
  if (cached) return cached;
  const loaded = await buildPatientFromIdentity({
    walletAddress: pointer.wallet,
    lockACid: pointer.lockACid,
    title: pointer.title,
  });
  if (!loaded) return null;
  putCachedProfile(pointer.wallet, pointer.lockACid, loaded);
  return loaded;
}

async function verifyCandidatesByOnChainIdentity(rows: PatientDirectoryEntry[]): Promise<PatientDirectoryEntry[]> {
  const verified = await Promise.all(
    rows.map(async (row) => {
      try {
        const identity = await fetchIdentityByWallet(row.walletAddress);
        if (!identity || identity.role.toLowerCase() !== "patient") return null;
        return row;
      } catch {
        return null;
      }
    })
  );
  return verified.filter((v): v is PatientDirectoryEntry => !!v);
}

async function searchBySubgraphIndex(
  query: string,
  opts: { excludeWallet: string; limit: number }
): Promise<PatientDirectoryEntry[]> {
  const looksLikePhone = /^\+?[0-9()\-\s]{6,}$/.test(query);
  const shouldUseTitlePrefilter = !query.includes("@") && !looksLikePhone;
  let pointers: PatientPointer[] = [];
  if (shouldUseTitlePrefilter) {
    try {
      const byTitle = await searchPatientIdentitiesByTitleFromSubgraph(query, {
        limit: Math.max(opts.limit * 10, 200),
      });
      pointers = byTitle
        .filter(
          (r) =>
            (r.role || "").toLowerCase() === "patient" &&
            !!r.wallet &&
            !!r.lockACid &&
            !isBlockedWallet(r.wallet)
        )
        .map((r) => ({ wallet: r.wallet.toLowerCase(), lockACid: r.lockACid, title: r.title }));
    } catch {
      pointers = [];
    }
  }
  if (pointers.length === 0) {
    pointers = await getPatientPointersFromSubgraph();
  }

  const filteredPointers = pointers.filter((p) => p.wallet !== opts.excludeWallet);
  const out = new Map<string, PatientDirectoryEntry>();
  let inspected = 0;

  for (
    let i = 0;
    i < filteredPointers.length &&
    out.size < opts.limit &&
    inspected < PATIENT_SEARCH_MAX_PROFILE_SCAN;
    i += PROFILE_LOAD_CONCURRENCY
  ) {
    const batch = filteredPointers.slice(i, i + PROFILE_LOAD_CONCURRENCY);
    inspected += batch.length;
    const rows = await Promise.all(batch.map((p) => loadPatientByPointer(p)));
    for (const row of rows) {
      if (!row) continue;
      if (row.walletAddress === opts.excludeWallet) continue;
      if (!matchesNameEmailPhone(row, query)) continue;
      out.set(row.walletAddress, row);
      if (out.size >= opts.limit) break;
    }
  }

  return Array.from(out.values()).slice(0, opts.limit);
}

async function searchByOnChainEvents(
  query: string,
  opts: { excludeWallet: string; limit: number; lookbackBlocks: number },
  prefill?: Map<string, PatientDirectoryEntry>
): Promise<PatientDirectoryEntry[]> {
  const out = prefill ?? new Map<string, PatientDirectoryEntry>();
  if (out.size >= opts.limit) return Array.from(out.values()).slice(0, opts.limit);

  const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "";
  if (!identityAddress) return Array.from(out.values()).slice(0, opts.limit);

  const contract = getIdentityContract();
  const provider = (contract.runner as { provider?: ethers.Provider } | null)?.provider;
  if (!provider) return Array.from(out.values()).slice(0, opts.limit);

  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - opts.lookbackBlocks);
  const events = await queryIdentityEventsAdaptive(contract, fromBlock, latest);

  for (const ev of events) {
    if (out.size >= opts.limit) break;
    const args = (ev as { args?: unknown[] }).args;
    const idHash = (args?.[0] as string) || "";
    if (!idHash) continue;

    let identity: unknown;
    try {
      identity = await contract.getIdentity(idHash);
    } catch {
      continue;
    }
    const rec = asRecord(identity);
    if (!rec || !rec.exists) continue;

    let role = "";
    try {
      role = ethers.decodeBytes32String(String(rec.role || ""));
    } catch {
      role = "";
    }
    if (role.toLowerCase() !== "patient") continue;

    const walletAddress = asString(rec.wallet).toLowerCase();
    const lockACid = asString(rec.lockACid);
    if (!walletAddress || !lockACid) continue;
    if (isBlockedWallet(walletAddress)) continue;
    if (walletAddress === opts.excludeWallet) continue;
    if (out.has(walletAddress)) continue;

    const candidate = await buildPatientFromIdentity({
      walletAddress,
      lockACid,
      title: asString(rec.title),
    });
    if (!candidate) continue;
    if (!matchesNameEmailPhone(candidate, query)) continue;
    out.set(walletAddress, candidate);
  }

  return Array.from(out.values()).slice(0, opts.limit);
}

export async function searchPatientsByNameEmailPhone(
  query: string,
  opts?: { excludeWallet?: string; limit?: number; lookbackBlocks?: number }
): Promise<PatientDirectoryEntry[]> {
  const q = query.trim();
  if (!q) return [];

  const excludeWallet = (opts?.excludeWallet || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 20));
  const lookbackBlocks = Math.max(1000, opts?.lookbackBlocks ?? Number(process.env.HOSPITAL_DIRECTORY_LOOKBACK_BLOCKS || 500000));
  const prefill = new Map<string, PatientDirectoryEntry>();
  const looksLikePhone = /^\+?[0-9()\-\s]{6,}$/.test(q);
  const looksLikeEmail = q.includes("@");

  // Fast path for exact email/phone identifiers — resolved directly from chain, no verification needed.
  if (looksLikeEmail || looksLikePhone) {
    try {
      const identity = await fetchIdentity(q);
      if (identity && identity.role.toLowerCase() === "patient") {
        const candidate = await buildPatientFromIdentity(identity);
        if (candidate && candidate.walletAddress !== excludeWallet && matchesNameEmailPhone(candidate, q)) {
          prefill.set(candidate.walletAddress, candidate);
        }
      }
    } catch {
      // Continue.
    }
  }

  if (prefill.size >= limit) {
    // prefill was built directly from fetchIdentity — already chain-verified, trust it.
    return Array.from(prefill.values()).slice(0, limit).filter((row) => !isBlockedWallet(row.walletAddress));
  }

  try {
    const fresh = await isSubgraphFreshEnough();
    if (fresh) {
      // Subgraph is the source of truth for indexed identities — return results directly.
      const fromSubgraph = await searchBySubgraphIndex(q, { excludeWallet, limit });
      const merged = new Map<string, PatientDirectoryEntry>([
        ...Array.from(prefill.entries()),
        ...fromSubgraph.map((r) => [r.walletAddress, r] as const),
      ]);
      if (merged.size > 0) {
        return Array.from(merged.values()).slice(0, limit).filter((row) => !isBlockedWallet(row.walletAddress));
      }
      // Subgraph returned nothing — fall back to events scan.
    }
  } catch {
    // fallback below
  }

  // On-chain events fallback — verify results since they come from raw event args.
  const fallback = await searchByOnChainEvents(
    q,
    { excludeWallet, limit, lookbackBlocks },
    prefill
  );
  const verified = await verifyCandidatesByOnChainIdentity(fallback.slice(0, limit));
  return verified.filter((row) => !isBlockedWallet(row.walletAddress));
}
