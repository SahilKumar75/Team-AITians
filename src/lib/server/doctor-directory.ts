import { ethers } from "ethers";
import { fetchIdentity, fetchIdentityByWallet, getIdentityContract, isAddressVerifiedClinician } from "@/lib/blockchain";
import { catFromIPFSNode, isIPFSNodeConfigured } from "@/lib/ipfs-node";
import { fetchFromPinataGateway } from "@/lib/pinata-server";
import { listDoctorsByWalletsFromSubgraph, searchDoctorsFromSubgraph } from "@/lib/subgraph-directory";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export interface DoctorDirectoryEntry {
  id: string;
  walletAddress: string;
  name: string;
  specialization: string;
  hospital: string;
  hospitalId: string;
  email: string;
  phone: string;
  departmentIds: string[];
}

function toDoctorEntryFromIndexed(indexed: {
  id: string;
  walletAddress: string;
  name?: string;
  specialization?: string;
  hospital?: string;
  hospitalId?: string;
  email?: string;
  phone?: string;
}): DoctorDirectoryEntry {
  const wallet = indexed.walletAddress.toLowerCase();
  return {
    id: indexed.id || `doctor-${wallet}`,
    walletAddress: wallet,
    name: indexed.name || "Doctor",
    specialization: indexed.specialization || "Verified clinician",
    hospital: indexed.hospital || "On-chain identity",
    hospitalId: (indexed.hospitalId || "").trim().toLowerCase(),
    email: indexed.email || "",
    phone: indexed.phone || "",
    departmentIds: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isPhoneLikeQuery(query: string): boolean {
  return /^\+?[0-9()\-\s]{6,}$/.test(query);
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

async function fetchJsonByCidServer(cid: string): Promise<unknown> {
  const parse = (buffer: ArrayBuffer) => {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    return JSON.parse(text) as unknown;
  };

  if (isIPFSNodeConfigured()) {
    try {
      const fromNode = await catFromIPFSNode(cid);
      return parse(fromNode);
    } catch {
      // fallback to gateway below
    }
  }

  const fromGateway = await fetchFromPinataGateway(cid);
  return parse(fromGateway);
}

function matchesQuery(doc: DoctorDirectoryEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    doc.walletAddress.toLowerCase().includes(q) ||
    doc.name.toLowerCase().includes(q) ||
    doc.email.toLowerCase().includes(q) ||
    doc.phone.toLowerCase().includes(q) ||
    doc.specialization.toLowerCase().includes(q) ||
    doc.hospital.toLowerCase().includes(q)
  );
}

function matchesHospital(
  doc: DoctorDirectoryEntry,
  normalizedHospitalId: string,
  normalizedHospitalName: string
): boolean {
  if (!normalizedHospitalId && !normalizedHospitalName) return true;
  const docHospitalId = doc.hospitalId.trim().toLowerCase();
  const docHospitalName = doc.hospital.trim().toLowerCase();

  const idMatch = !!normalizedHospitalId && (
    docHospitalId === normalizedHospitalId ||
    docHospitalName === normalizedHospitalId
  );

  const nameMatch = !!normalizedHospitalName && (
    docHospitalName === normalizedHospitalName ||
    docHospitalId === normalizedHospitalName ||
    docHospitalName.includes(normalizedHospitalName) ||
    normalizedHospitalName.includes(docHospitalName)
  );

  return idMatch || nameMatch;
}

async function buildDoctorFromIdentity(identity: {
  walletAddress: string;
  lockACid: string;
  title?: string;
}): Promise<DoctorDirectoryEntry | null> {
  const wallet = identity.walletAddress.toLowerCase();
  if (isBlockedWallet(wallet)) return null;
  const lockACid = identity.lockACid;
  if (!wallet || !lockACid) return null;

  let profile: Record<string, unknown> = {};
  try {
    const lockPayload = await fetchJsonByCidServer(lockACid);
    const lockObj = asRecord(lockPayload);
    const profileCid = asString(lockObj?.profileCid);
    if (profileCid) {
      const envelopeOrProfile = await fetchJsonByCidServer(profileCid);
      const envelopeObj = asRecord(envelopeOrProfile);
      profile = asRecord(envelopeObj?.profile) ?? envelopeObj ?? {};
    }
  } catch {
    // Keep profile empty; caller can still use minimal on-chain identity.
  }

  const departmentIds = Array.isArray(profile.departmentIds)
    ? (profile.departmentIds as unknown[]).filter((d): d is string => typeof d === "string")
    : [];

  return {
    id: `doctor-${wallet}`,
    walletAddress: wallet,
    name: asString(profile.fullName, asString(profile.name, identity.title || "Doctor")),
    specialization: asString(profile.specialization, "Verified clinician"),
    hospital: asString(profile.hospital, "On-chain identity"),
    hospitalId: asString(profile.hospitalId).trim().toLowerCase(),
    email: asString(profile.email),
    phone: asString(profile.phone),
    departmentIds,
  };
}

export async function listDoctorsFromIdentityRegistry(opts?: {
  hospitalId?: string;
  hospitalName?: string;
  query?: string;
  wallets?: string[];
  lookbackBlocks?: number;
}): Promise<DoctorDirectoryEntry[]> {
  const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "";
  if (!identityAddress) return [];

  const lookbackBlocks = Math.max(1000, opts?.lookbackBlocks ?? Number(process.env.HOSPITAL_DIRECTORY_LOOKBACK_BLOCKS || 500000));
  const normalizedHospitalId = (opts?.hospitalId || "").trim().toLowerCase();
  const normalizedHospitalName = (opts?.hospitalName || "").trim().toLowerCase();
  const query = (opts?.query || "").trim();
  const phoneLikeQuery = isPhoneLikeQuery(query);
  const wallets = Array.isArray(opts?.wallets) ? opts!.wallets : [];
  const uniqueWallets = Array.from(
    new Set(
      wallets
        .map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
        .filter((w) => !!w && ethers.isAddress(w) && !isBlockedWallet(w))
    )
  );

  // Wallet-scoped path must run first; this is used by patient doctor search.
  // It avoids broad subgraph scans and makes "visited doctors" search deterministic and fast.
  if (uniqueWallets.length > 0) {
    const out = new Map<string, DoctorDirectoryEntry>();
    let subgraphFetched = false;
    const subgraphFoundWallets = new Set<string>();
    try {
      const indexed = await listDoctorsByWalletsFromSubgraph(uniqueWallets);
      subgraphFetched = true;
      indexed.forEach((doc) => {
        const mapped = toDoctorEntryFromIndexed(doc);
        subgraphFoundWallets.add(mapped.walletAddress.toLowerCase());
        if (isBlockedWallet(mapped.walletAddress)) return;
        if (!matchesHospital(mapped, normalizedHospitalId, normalizedHospitalName)) return;
        if (!matchesQuery(mapped, query)) return;
        out.set(mapped.walletAddress.toLowerCase(), mapped);
      });
    } catch {
      subgraphFetched = false;
      // continue with chain fallback only when subgraph is unavailable
    }

    // When subgraph responded, only do chain fallback for wallets not indexed yet.
    // Wallets already found in the subgraph are returned directly — no extra chain/IPFS verification.
    if (subgraphFetched) {
      const walletsNotInSubgraph = uniqueWallets.filter((w) => !subgraphFoundWallets.has(w));
      for (const wallet of walletsNotInSubgraph) {
        let identity: Awaited<ReturnType<typeof fetchIdentityByWallet>> | null = null;
        try {
          identity = await fetchIdentityByWallet(wallet);
        } catch {
          identity = null;
        }
        if (!identity || identity.role.toLowerCase() !== "doctor") continue;
        const clinicianVerified = await isAddressVerifiedClinician(wallet);
        if (!clinicianVerified) continue;
        const doc = await buildDoctorFromIdentity(identity);
        if (!doc) continue;
        if (!matchesHospital(doc, normalizedHospitalId, normalizedHospitalName)) continue;
        if (!matchesQuery(doc, query)) continue;
        out.set(doc.walletAddress.toLowerCase(), doc);
      }
      return Array.from(out.values());
    }

    // Subgraph unavailable — fall back to full chain lookup for all wallets.
    for (const wallet of uniqueWallets) {
      if (out.has(wallet)) continue;
      let identity: Awaited<ReturnType<typeof fetchIdentityByWallet>> | null = null;
      try {
        identity = await fetchIdentityByWallet(wallet);
      } catch {
        identity = null;
      }
      if (!identity || identity.role.toLowerCase() !== "doctor") continue;
      const clinicianVerified = await isAddressVerifiedClinician(wallet);
      if (!clinicianVerified) continue;
      const doc = await buildDoctorFromIdentity(identity);
      if (!doc) continue;
      if (!matchesHospital(doc, normalizedHospitalId, normalizedHospitalName)) continue;
      if (!matchesQuery(doc, query)) continue;
      out.set(doc.walletAddress.toLowerCase(), doc);
    }
    return Array.from(out.values());
  }

  // Fast path: when query is an identifier, resolve directly from registry and avoid full event scans.
  if (query) {
    const identity = await fetchIdentity(query);
    if (identity && identity.role.toLowerCase() === "doctor" && !isBlockedWallet(identity.walletAddress)) {
      const doctor = await buildDoctorFromIdentity(identity);
      if (!doctor) return [];
      if (!matchesHospital(doctor, normalizedHospitalId, normalizedHospitalName)) return [];
      return matchesQuery(doctor, query) ? [doctor] : [];
    }
  }

  if (query && !phoneLikeQuery) {
    try {
      const indexed = await searchDoctorsFromSubgraph(query);
      const mapped = indexed
        .map((row) => toDoctorEntryFromIndexed(row))
        .filter((row) => !isBlockedWallet(row.walletAddress))
        .filter((row) => matchesHospital(row, normalizedHospitalId, normalizedHospitalName))
        .filter((row) => matchesQuery(row, query));
      // Subgraph search should be returned directly without per-result chain verification.
      if (mapped.length > 0) return mapped;
    } catch {
      // fallback to on-chain scan
    }
  }

  const contract = getIdentityContract();
  const provider = (contract.runner as { provider?: ethers.Provider } | null)?.provider;
  if (!provider) return [];

  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - lookbackBlocks);
  const events = await queryIdentityEventsAdaptive(contract, fromBlock, latest);

  const byWallet = new Map<string, DoctorDirectoryEntry>();

  for (const ev of events) {
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
    if (role.toLowerCase() !== "doctor") continue;

    const wallet = asString(rec.wallet).toLowerCase();
    const lockACid = asString(rec.lockACid);
    if (!wallet || !lockACid) continue;
    if (isBlockedWallet(wallet)) continue;
    const clinicianVerified = await isAddressVerifiedClinician(wallet);
    if (!clinicianVerified) continue;

    const doc = await buildDoctorFromIdentity({
      walletAddress: wallet,
      lockACid,
      title: asString(rec.title),
    });
    if (!doc) continue;

    if (!matchesHospital(doc, normalizedHospitalId, normalizedHospitalName)) continue;

    if (!matchesQuery(doc, query)) continue;
    byWallet.set(wallet, doc);
  }

  return Array.from(byWallet.values()).filter((row) => !isBlockedWallet(row.walletAddress));
}
