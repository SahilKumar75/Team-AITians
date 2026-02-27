import { ethers } from "ethers";
import { getIdentityContract } from "@/lib/blockchain";
import { catFromIPFSNode, isIPFSNodeConfigured } from "@/lib/ipfs-node";
import { fetchFromPinataGateway } from "@/lib/pinata-server";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export interface IndexedJourney {
  id: string;
  tokenNumber: string;
  visitType: string;
  chiefComplaint?: string;
  departmentIds?: string[];
  departmentNames?: string[];
  allottedDoctorWallet?: string;
  allottedDoctorName?: string;
  status: string;
  startedAt: string;
  progressPercent: number;
  hospital: { id: string; name: string; code: string; city: string };
  patient: { walletAddress: string; fullName: string };
  checkpoints: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
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

async function listPatientProfiles(): Promise<Array<{ wallet: string; profile: Record<string, unknown> }>> {
  const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "";
  if (!identityAddress) return [];

  const contract = getIdentityContract();
  const provider = (contract.runner as { provider?: ethers.Provider } | null)?.provider;
  if (!provider) return [];

  const latest = await provider.getBlockNumber();
  const lookbackBlocks = Math.max(1000, Number(process.env.HOSPITAL_DIRECTORY_LOOKBACK_BLOCKS || 500000));
  const fromBlock = Math.max(0, latest - lookbackBlocks);
  const events = await queryIdentityEventsAdaptive(contract, fromBlock, latest);

  const out = new Map<string, { wallet: string; profile: Record<string, unknown> }>();

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
    if (role.toLowerCase() !== "patient") continue;

    const wallet = asString(rec.wallet).toLowerCase();
    const lockACid = asString(rec.lockACid);
    if (!wallet || !lockACid) continue;
    if (isBlockedWallet(wallet)) continue;

    let lockPayload: unknown;
    try {
      lockPayload = await fetchJsonByCidServer(lockACid);
    } catch {
      continue;
    }
    const lockObj = asRecord(lockPayload);
    const profileCid = asString(lockObj?.profileCid);
    if (!profileCid) continue;

    let envelopeOrProfile: unknown;
    try {
      envelopeOrProfile = await fetchJsonByCidServer(profileCid);
    } catch {
      continue;
    }
    const envelopeObj = asRecord(envelopeOrProfile);
    if (!envelopeObj) continue;
    const profile = asRecord(envelopeObj.profile) ?? envelopeObj;
    out.set(wallet, { wallet, profile });
  }

  return Array.from(out.values());
}

function toJourney(
  patientWallet: string,
  patientName: string,
  raw: Record<string, unknown>,
  fallbackHospitalId = "",
  fallbackHospitalName = ""
): IndexedJourney | null {
  const id = asString(raw.journeyId, asString(raw.id));
  if (!id) return null;

  const startedAtRaw = raw.startedAt;
  const startedAt =
    typeof startedAtRaw === "number"
      ? new Date(startedAtRaw).toISOString()
      : asString(startedAtRaw, new Date().toISOString());

  const hospitalId = asString(raw.hospitalId, fallbackHospitalId);
  const hospitalName = asString(raw.hospitalName, fallbackHospitalName || "Hospital");
  const departmentIds = asStringArray(raw.departmentIds);
  const departmentNames = asStringArray(raw.departmentNames);
  const checkpoints = Array.isArray(raw.checkpoints) ? raw.checkpoints : [];
  const doctorWalletRaw = asString(raw.allottedDoctorWallet, asString(raw.doctorWallet));
  const doctorWallet = isBlockedWallet(doctorWalletRaw) ? "" : doctorWalletRaw;
  const doctorName = doctorWallet ? asString(raw.allottedDoctorName, asString(raw.doctorName)) : "";

  return {
    id,
    tokenNumber: asString(raw.tokenNumber, `T${id.slice(-6)}`),
    visitType: asString(raw.visitType, "opd"),
    chiefComplaint: asString(raw.chiefComplaint),
    departmentIds,
    departmentNames,
    allottedDoctorWallet: doctorWallet,
    allottedDoctorName: doctorName,
    status: asString(raw.status, "active"),
    startedAt,
    progressPercent: asNumber(raw.progressPercent, 0),
    hospital: {
      id: hospitalId,
      name: hospitalName,
      code: asString(raw.hospitalCode, "HOSP"),
      city: asString(raw.hospitalCity, ""),
    },
    patient: {
      walletAddress: patientWallet,
      fullName: patientName,
    },
    checkpoints,
  };
}

export async function listHospitalJourneysFromIdentityRegistry(hospitalId: string): Promise<IndexedJourney[]> {
  const normalizedHospitalId = hospitalId.trim().toLowerCase();
  if (!normalizedHospitalId) return [];

  const profiles = await listPatientProfiles();
  const byId = new Map<string, IndexedJourney>();
  const cache = readSyncCache();

  // We need to fetch synced IPFS payloads concurrently to keep list fast
  const syncPromises: Promise<{ id: string; syncedPayload: unknown }>[] = [];

  profiles.forEach(({ wallet, profile }) => {
    const patientName = asString(profile.fullName, asString(profile.name, "Patient"));
    const historyRaw = Array.isArray(profile.journeyHistory) ? profile.journeyHistory : [];
    historyRaw.forEach((entry) => {
      const obj = asRecord(entry);
      if (!obj) return;
      const hId = asString(obj.hospitalId).trim().toLowerCase();
      if (hId !== normalizedHospitalId) return;
      const journey = toJourney(wallet, patientName, obj, normalizedHospitalId, asString(obj.hospitalName));
      if (!journey) return;

      byId.set(journey.id, journey);

      if (cache[journey.id] && cache[journey.id].cid) {
        syncPromises.push(
          fetchJsonByCidServer(cache[journey.id].cid)
            .then(payload => ({ id: journey.id, syncedPayload: payload }))
            .catch(() => ({ id: journey.id, syncedPayload: null }))
        );
      }
    });
  });

  const syncedResults = await Promise.all(syncPromises);
  for (const { id, syncedPayload } of syncedResults) {
    if (!syncedPayload) continue;
    const syncedObj = asRecord(syncedPayload);
    if (!syncedObj) continue;

    const baseJourney = byId.get(id);
    if (baseJourney) {
      const merged = toJourney(
        baseJourney.patient.walletAddress,
        baseJourney.patient.fullName,
        { ...baseJourney, ...syncedObj },
        baseJourney.hospital.id,
        baseJourney.hospital.name
      );
      if (merged) byId.set(id, merged);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export async function listAllJourneysFromIdentityRegistry(): Promise<IndexedJourney[]> {
  const profiles = await listPatientProfiles();
  const byId = new Map<string, IndexedJourney>();
  const cache = readSyncCache();

  const syncPromises: Promise<{ id: string; syncedPayload: unknown }>[] = [];

  profiles.forEach(({ wallet, profile }) => {
    const patientName = asString(profile.fullName, asString(profile.name, "Patient"));
    const historyRaw = Array.isArray(profile.journeyHistory) ? profile.journeyHistory : [];
    historyRaw.forEach((entry) => {
      const obj = asRecord(entry);
      if (!obj) return;
      const journey = toJourney(wallet, patientName, obj, asString(obj.hospitalId), asString(obj.hospitalName));
      if (!journey) return;

      byId.set(journey.id, journey);

      if (cache[journey.id] && cache[journey.id].cid) {
        syncPromises.push(
          fetchJsonByCidServer(cache[journey.id].cid)
            .then(payload => ({ id: journey.id, syncedPayload: payload }))
            .catch(() => ({ id: journey.id, syncedPayload: null }))
        );
      }
    });
  });

  const syncedResults = await Promise.all(syncPromises);
  for (const { id, syncedPayload } of syncedResults) {
    if (!syncedPayload) continue;
    const syncedObj = asRecord(syncedPayload);
    if (!syncedObj) continue;

    const baseJourney = byId.get(id);
    if (baseJourney) {
      const merged = toJourney(
        baseJourney.patient.walletAddress,
        baseJourney.patient.fullName,
        { ...baseJourney, ...syncedObj },
        baseJourney.hospital.id,
        baseJourney.hospital.name
      );
      if (merged) byId.set(id, merged);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

import fs from "fs";
import path from "path";

// Cache file to store the latest CIDs synced by doctors
const CACHE_FILE = path.join(process.cwd(), ".journey-sync-cache.json");

function readSyncCache(): Record<string, { cid: string }> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read journey sync cache:", error);
  }
  return {};
}

export async function getJourneyByIdFromIdentityRegistry(journeyId: string): Promise<IndexedJourney | null> {
  const q = journeyId.trim();
  if (!q) return null;

  const profiles = await listPatientProfiles();
  let baseJourney: IndexedJourney | null = null;
  let patientWallet = "";
  let patientName = "";

  for (const { wallet, profile } of profiles) {
    patientName = asString(profile.fullName, asString(profile.name, "Patient"));
    const historyRaw = Array.isArray(profile.journeyHistory) ? profile.journeyHistory : [];
    for (const entry of historyRaw) {
      const obj = asRecord(entry);
      if (!obj) continue;
      const id = asString(obj.journeyId, asString(obj.id));
      if (id !== q) continue;
      const journey = toJourney(wallet, patientName, obj, asString(obj.hospitalId), asString(obj.hospitalName));
      if (journey) {
        baseJourney = journey;
        patientWallet = wallet;
        break;
      }
    }
    if (baseJourney) break;
  }

  if (!baseJourney) return null;

  // Check if there is a newer synced version of this journey
  const cache = readSyncCache();
  if (cache[q] && cache[q].cid) {
    try {
      const syncedPayload = await fetchJsonByCidServer(cache[q].cid);
      const syncedObj = asRecord(syncedPayload);
      if (syncedObj) {
        // Merge the synced object over the base journey representation
        const mergedJourney = toJourney(
          patientWallet,
          patientName,
          { ...baseJourney, ...syncedObj },
          baseJourney.hospital.id,
          baseJourney.hospital.name
        );
        if (mergedJourney) return mergedJourney;
      }
    } catch (e) {
      console.error("Failed to fetch synced journey from IPFS:", e);
    }
  }

  return baseJourney;
}
