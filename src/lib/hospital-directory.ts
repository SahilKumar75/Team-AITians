import { ethers } from "ethers";
import { isBlockedHospitalId, isBlockedWallet } from "@/lib/server/blocked-wallets";

export interface HospitalDirectoryDepartment {
  id: string;
  name: string;
  code?: string;
  type: string;
  floor: number;
  wing?: string;
  avgServiceTime: number;
  currentQueue: number;
  maxCapacity: number;
  doctorIds?: string[];
  openDays?: number[];
}

export interface HospitalDirectoryEntry {
  id: string;
  name: string;
  code: string;
  city: string;
  state?: string;
  type?: string;
  address?: string;
  departments?: HospitalDirectoryDepartment[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isTimeoutLikeError(error: unknown): boolean {
  const e = error as { code?: number | string; message?: string; error?: { code?: number | string; message?: string } };
  const code = e?.error?.code ?? e?.code;
  const msg = `${e?.error?.message || ""} ${e?.message || ""}`.toLowerCase();
  return code === -32002 || msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout");
}

async function queryIdentityEventsAdaptive(
  identityContract: ethers.Contract,
  fromBlock: number,
  toBlock: number
): Promise<ethers.EventLog[]> {
  const filter = identityContract.filters.IdentityRegistered();
  try {
    return (await identityContract.queryFilter(filter, fromBlock, toBlock)) as ethers.EventLog[];
  } catch (error) {
    const span = toBlock - fromBlock;
    if (!isTimeoutLikeError(error) || span <= 1500) throw error;
    const mid = Math.floor((fromBlock + toBlock) / 2);
    const left = await queryIdentityEventsAdaptive(identityContract, fromBlock, mid);
    const right = await queryIdentityEventsAdaptive(identityContract, mid + 1, toBlock);
    return [...left, ...right];
  }
}

function toDepartmentList(value: unknown): HospitalDirectoryDepartment[] {
  if (!Array.isArray(value)) return [];
  const out: HospitalDirectoryDepartment[] = [];
  value.forEach((raw, idx) => {
    const obj = asRecord(raw);
    if (!obj) return;
    out.push({
      id: asString(obj.id, `dept-${idx + 1}`),
      name: asString(obj.name, `Department ${idx + 1}`),
      code: asString(obj.code) || undefined,
      type: asString(obj.type, "consultation"),
      floor: asNumber(obj.floor, 1),
      wing: asString(obj.wing) || undefined,
      avgServiceTime: asNumber(obj.avgServiceTime, 10),
      currentQueue: asNumber(obj.currentQueue, 0),
      maxCapacity: asNumber(obj.maxCapacity, 20),
      doctorIds: Array.isArray(obj.doctorIds) ? (obj.doctorIds as string[]) : undefined,
      openDays: Array.isArray(obj.openDays) ? (obj.openDays as number[]) : undefined,
    });
  });
  return out;
}

function toHospital(
  wallet: string,
  profile: Record<string, unknown>
): HospitalDirectoryEntry | null {
  if (isBlockedWallet(wallet)) return null;
  const name = asString(profile.name);
  if (!name) return null;
  const id = asString(profile.hospitalId, wallet.toLowerCase());
  if (isBlockedHospitalId(id)) return null;
  return {
    id,
    name,
    code: asString(profile.code, "HOSP"),
    city: asString(profile.city),
    state: asString(profile.state) || undefined,
    type: asString(profile.type) || undefined,
    address: asString(profile.address) || undefined,
    departments: toDepartmentList(profile.departments),
  };
}

export async function listHospitalsFromIdentityRegistry(opts: {
  identityContract: ethers.Contract;
  fetchJsonByCid: (cid: string) => Promise<unknown>;
  lookbackBlocks?: number;
}): Promise<HospitalDirectoryEntry[]> {
  const { identityContract, fetchJsonByCid } = opts;
  const lookbackBlocks = Math.max(1000, opts.lookbackBlocks ?? 400000);

  const provider = (identityContract.runner as { provider?: ethers.Provider } | null)?.provider;
  if (!provider) return [];

  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - lookbackBlocks);
  const events = await queryIdentityEventsAdaptive(identityContract, fromBlock, latest);

  const byId = new Map<string, HospitalDirectoryEntry>();

  console.log(`[HospitalDirectory] Found ${events.length} IdentityRegistered events (blocks ${fromBlock}–${latest})`);

  for (const ev of events) {
    const args = (ev as { args?: unknown[] }).args;
    const idHash = (args?.[0] as string) || "";
    if (!idHash) continue;

    let identity: unknown;
    try {
      identity = await identityContract.getIdentity(idHash);
    } catch (err) {
      console.warn(`[HospitalDirectory] getIdentity(${idHash}) failed:`, err);
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
    if (role.toLowerCase() !== "hospital") continue;

    console.log(`[HospitalDirectory] Found hospital-role identity: wallet=${asString(rec.wallet)}, lockACid=${asString(rec.lockACid)}`);

    const wallet = asString(rec.wallet).toLowerCase();
    const lockACid = asString(rec.lockACid);
    if (!wallet || !lockACid) {
      console.warn(`[HospitalDirectory] Skipped: missing wallet or lockACid`);
      continue;
    }
    if (isBlockedWallet(wallet)) {
      console.warn(`[HospitalDirectory] Skipped: wallet ${wallet} is blocked`);
      continue;
    }

    let lockPayload: unknown;
    try {
      lockPayload = await fetchJsonByCid(lockACid);
    } catch (err) {
      console.warn(`[HospitalDirectory] Failed to fetch lockA CID ${lockACid}:`, err);
      continue;
    }
    const lockObj = asRecord(lockPayload);
    const profileCid = asString(lockObj?.profileCid);
    if (!profileCid) {
      console.warn(`[HospitalDirectory] lockA JSON has no profileCid. Keys:`, lockObj ? Object.keys(lockObj) : "null");
      continue;
    }

    let envelopeOrProfile: unknown;
    try {
      envelopeOrProfile = await fetchJsonByCid(profileCid);
    } catch (err) {
      console.warn(`[HospitalDirectory] Failed to fetch profile CID ${profileCid}:`, err);
      continue;
    }
    const envelopeObj = asRecord(envelopeOrProfile);
    if (!envelopeObj) {
      console.warn(`[HospitalDirectory] Profile CID ${profileCid} returned non-object`);
      continue;
    }
    const profile = asRecord(envelopeObj.profile) ?? envelopeObj;

    const hospital = toHospital(wallet, profile);
    if (!hospital) {
      console.warn(`[HospitalDirectory] toHospital returned null for wallet=${wallet}. Profile keys:`, Object.keys(profile));
      continue;
    }
    console.log(`[HospitalDirectory] ✅ Added hospital: ${hospital.name} (${hospital.id})`);
    byId.set(hospital.id, hospital);
  }

  return Array.from(byId.values())
    .filter((row) => !isBlockedHospitalId(row.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}
