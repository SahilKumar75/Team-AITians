/**
 * Client journey storage with Helia(IPFS) payloads + local CID index cache.
 * Source of truth: IPFS payload (when available). Local storage keeps CID index and snapshot cache.
 */
import { KEYS } from "./storage-keys";
import type { JourneyApiResponse } from "@/features/journey/model";
import { addBytesToHelia, getFileFromHelia, isHeliaAvailable } from "@/lib/helia";

const defaultHospital = { id: "", name: "", code: "", city: "" };

interface JourneyIndexEntry {
  id: string;
  cid?: string;
  journey?: JourneyApiResponse;
  status?: string;
  startedAt?: string;
}

function listJourneyWallets(): string[] {
  if (typeof window === "undefined") return [];
  const out = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const prefix = "swathya_journeys_";
    if (!key.startsWith(prefix)) continue;
    const wallet = key.slice(prefix.length);
    if (wallet) out.add(wallet);
  }
  return Array.from(out);
}

function readIndex(wallet: string): JourneyIndexEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.journeys(wallet));
    if (!raw) return [];
    const arr = JSON.parse(raw) as JourneyIndexEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeIndex(wallet: string, entries: JourneyIndexEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEYS.journeys(wallet), JSON.stringify(entries));
  } catch {
    // ignore cache write failures
  }
}

async function writeJourneyToHelia(journey: JourneyApiResponse): Promise<string | null> {
  if (!isHeliaAvailable()) return null;
  try {
    const payload = new TextEncoder().encode(JSON.stringify(journey));
    return await addBytesToHelia(payload, `${journey.id}.json`);
  } catch {
    return null;
  }
}

async function readJourneyFromHelia(cid: string): Promise<JourneyApiResponse | null> {
  try {
    const bytes = await getFileFromHelia(cid);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as JourneyApiResponse;
    return parsed;
  } catch {
    return null;
  }
}

export async function getJourneysClient(
  wallet: string | null,
  status?: string
): Promise<{ journeys: JourneyApiResponse[] }> {
  if (typeof window === "undefined" || !wallet) return { journeys: [] };
  const entries = readIndex(wallet);
  const resolved = await Promise.all(
    entries.map(async (entry) => {
      if (entry.cid) {
        const remote = await readJourneyFromHelia(entry.cid);
        if (remote) return { ...entry, journey: remote, status: remote.status, startedAt: remote.startedAt };
      }
      return entry;
    })
  );
  writeIndex(wallet, resolved);
  const all = resolved
    .map((e) => e.journey)
    .filter((j): j is JourneyApiResponse => Boolean(j))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  if (!status || status === "all") return { journeys: all };
  return { journeys: all.filter((j) => j.status === status) };
}

export async function getAllJourneysClient(status?: string): Promise<{ journeys: JourneyApiResponse[] }> {
  const wallets = listJourneyWallets();
  const all: JourneyApiResponse[] = [];
  for (const wallet of wallets) {
    const out = await getJourneysClient(wallet, status);
    all.push(...out.journeys);
  }
  // De-duplicate by id in case indexes overlap
  const dedup = new Map<string, JourneyApiResponse>();
  all.forEach((j) => {
    if (!dedup.has(j.id)) dedup.set(j.id, j);
  });
  return {
    journeys: Array.from(dedup.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    ),
  };
}

export async function getJourneyAnyClient(
  journeyId: string
): Promise<{ journey: JourneyApiResponse } | null> {
  const out = await getAllJourneysClient();
  const found = out.journeys.find((j) => j.id === journeyId);
  return found ? { journey: found } : null;
}

export async function getHospitalJourneysClient(hospitalId: string): Promise<{ journeys: JourneyApiResponse[] }> {
  const out = await getAllJourneysClient("active");
  return {
    journeys: out.journeys.filter((j) => (j.hospital?.id || "").toLowerCase() === hospitalId.toLowerCase()),
  };
}

function normalizeJourneyPatch(existing: JourneyApiResponse, patch: Partial<JourneyApiResponse>): JourneyApiResponse {
  const updated = { ...existing, ...patch };
  const checkpoints = Array.isArray(updated.checkpoints) ? (updated.checkpoints as Array<Record<string, unknown>>) : [];
  const inProgress =
    checkpoints.find((c) => c.status === "in_progress") ||
    checkpoints.find((c) => c.status === "in_queue");
  const firstPending = checkpoints.find((c) => c.status === "pending");

  if (inProgress && typeof inProgress.id === "string") {
    updated.currentCheckpointId = inProgress.id;
  } else if (firstPending && typeof firstPending.id === "string") {
    updated.currentCheckpointId = firstPending.id;
  } else {
    updated.currentCheckpointId = undefined;
  }

  const total = Math.max(checkpoints.length, 1);
  const completed = checkpoints.filter((c) => c.status === "completed").length;
  const computedProgress = Math.round((completed / total) * 100);
  updated.progressPercent = Number.isFinite(computedProgress) ? computedProgress : (updated.progressPercent || 0);
  updated.status = updated.progressPercent >= 100 ? "completed" : "active";

  return updated;
}

export async function getJourneyClient(
  journeyId: string,
  wallet: string | null
): Promise<{ journey: JourneyApiResponse } | null> {
  const { journeys } = await getJourneysClient(wallet);
  const j = journeys.find((x) => x.id === journeyId);
  if (!j) return null;
  return { journey: j };
}

export async function createJourneyClient(
  wallet: string,
  body: {
    hospitalId: string;
    visitType?: string;
    chiefComplaint?: string;
    departmentIds?: string[];
    allottedDoctorWallet?: string;
  }
): Promise<{ journey: JourneyApiResponse }> {
  const id = `journey-${Date.now()}`;
  const hospitalId = body.hospitalId || "";
  const hospital = { ...defaultHospital, id: hospitalId, name: hospitalId ? `Hospital ${hospitalId}` : "" };
  const departmentIds = Array.isArray(body.departmentIds) ? body.departmentIds : [];
  const checkpoints = departmentIds.map((deptId, index) => ({
    id: `${id}-cp-${index + 1}`,
    sequence: index + 1,
    status: index === 0 ? "in_queue" : "pending",
    department: {
      id: deptId,
      name: `Department ${deptId}`,
      code: deptId.toUpperCase(),
      type: "consultation",
      floor: 1,
      avgServiceTime: 10,
      currentQueue: 0,
      maxCapacity: 20,
    },
  }));
  const journey: JourneyApiResponse = {
    id,
    tokenNumber: `T${String(Date.now()).slice(-6)}`,
    visitType: body.visitType || "opd",
    chiefComplaint: body.chiefComplaint ?? "",
    departmentIds,
    allottedDoctorWallet: body.allottedDoctorWallet,
    status: "active",
    startedAt: new Date().toISOString(),
    progressPercent: 0,
    currentCheckpointId: checkpoints[0]?.id,
    hospital,
    checkpoints,
  };

  const cid = await writeJourneyToHelia(journey);
  const entries = readIndex(wallet);
  entries.unshift({
    id: journey.id,
    cid: cid ?? undefined,
    journey,
    status: journey.status,
    startedAt: journey.startedAt,
  });
  writeIndex(wallet, entries);
  return { journey };
}

export async function updateJourneyClient(
  wallet: string,
  journeyId: string,
  patch: Partial<JourneyApiResponse>
): Promise<{ journey: JourneyApiResponse } | null> {
  const entries = readIndex(wallet);
  let idx = entries.findIndex((x) => x.id === journeyId);

  let existing: JourneyApiResponse | null = null;
  if (idx >= 0) {
    existing = entries[idx].journey ?? (entries[idx].cid ? await readJourneyFromHelia(entries[idx].cid) : null);
  }

  if (!existing) {
    try {
      const BASE = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";
      const res = await fetch(`${BASE}/api/journey/${journeyId}`);
      if (res.ok) {
        const data = await res.json();
        existing = data.journey;
      }
    } catch {
      // ignore
    }
  }

  if (!existing) return null;

  const updated = normalizeJourneyPatch(existing, patch);
  const cid = await writeJourneyToHelia(updated);

  // Sync the new CID to the server so the patient can see the updates
  if (cid) {
    try {
      const BASE = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";
      await fetch(`${BASE}/api/journey/${updated.id}/sync`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newCid: cid,
          doctorWallet: wallet,
        }),
      });
    } catch (err) {
      console.error("Failed to sync updated journey CID to server:", err);
    }
  }

  const newEntry = {
    id: updated.id,
    cid: cid ?? (idx >= 0 ? entries[idx].cid : undefined),
    journey: updated,
    status: updated.status,
    startedAt: updated.startedAt,
  };

  if (idx < 0) {
    entries.unshift(newEntry);
  } else {
    entries[idx] = newEntry;
  }

  writeIndex(wallet, entries);
  return { journey: updated };
}

export async function updateJourneyAnyClient(
  journeyId: string,
  patch: Partial<JourneyApiResponse>
): Promise<{ journey: JourneyApiResponse } | null> {
  const wallets = listJourneyWallets();
  for (const wallet of wallets) {
    const entries = readIndex(wallet);
    if (entries.some((e) => e.id === journeyId)) {
      return await updateJourneyClient(wallet, journeyId, patch);
    }
  }

  // If not found in a local wallet index, fall back to updateJourneyClient which 
  // tries to fetch from API and save it to an unknown wallet local store
  return await updateJourneyClient("unknown-wallet", journeyId, patch);
}

