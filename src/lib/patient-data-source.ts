"use client";

import { getPatientStatus, updatePatientProfile } from "@/features/patient/api";
import { loadRoleProfileFromChain } from "@/lib/role-profile-registry";
import {
  readPatientProfileCache,
  writePatientProfileCache,
} from "@/lib/patient-profile-storage";

export interface UnifiedPatientProfile {
  walletAddress: string;
  isRegisteredOnChain: boolean;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  previousSurgeries: string;
  height: string;
  weight: string;
  profilePicture: string;
  familySharingPrefs?: { shareJourneyByDefault?: boolean; shareRecordsWithFamily?: boolean };
  lastDoctorsSeen?: Array<{
    doctorWallet: string;
    doctorName?: string;
    hospitalId?: string;
    departmentId?: string;
    lastSeenAt?: number;
  }>;
}

const UNIFIED_PROFILE_CACHE_TTL_MS = Math.max(5000, Number(process.env.NEXT_PUBLIC_UNIFIED_PROFILE_CACHE_TTL_MS || 20000));
const unifiedProfileCache = new Map<string, { expiresAt: number; value: UnifiedPatientProfile }>();
const unifiedProfileInflight = new Map<string, Promise<UnifiedPatientProfile>>();

function normText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pickText(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const joined = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean).join(", ");
      if (joined) return joined;
    }
  }
  return "";
}

function toUnifiedProfile(raw: Record<string, unknown>, wallet: string, email: string): UnifiedPatientProfile {
  return {
    walletAddress: normText(raw.walletAddress) || wallet,
    isRegisteredOnChain: Boolean(raw.isRegisteredOnChain) || !!wallet,
    fullName: normText(raw.fullName) || normText(raw.name) || email.split("@")[0] || "Patient",
    dateOfBirth: normText(raw.dateOfBirth),
    gender: normText(raw.gender),
    bloodGroup: normText(raw.bloodGroup),
    phone: normText(raw.phone),
    email: normText(raw.email) || email,
    address: normText(raw.address) || normText(raw.streetAddress),
    city: normText(raw.city),
    state: normText(raw.state),
    pincode: normText(raw.pincode),
    emergencyName: normText(raw.emergencyName),
    emergencyRelation: normText(raw.emergencyRelation),
    emergencyPhone: normText(raw.emergencyPhone),
    allergies: pickText(raw, ["allergies", "allergy", "knownAllergies", "allergyDetails"]),
    chronicConditions: pickText(raw, [
      "chronicConditions",
      "conditions",
      "medicalConditions",
      "healthConditions",
      "chronicCondition",
      "diseases",
    ]),
    currentMedications: pickText(raw, [
      "currentMedications",
      "medications",
      "currentMedication",
      "medicationList",
      "medicine",
      "meds",
    ]),
    previousSurgeries: normText(raw.previousSurgeries),
    height: normText(raw.height),
    weight: normText(raw.weight),
    profilePicture: normText(raw.profilePicture),
    familySharingPrefs: raw.familySharingPrefs as UnifiedPatientProfile["familySharingPrefs"] | undefined,
    lastDoctorsSeen: Array.isArray(raw.lastDoctorsSeen)
      ? (raw.lastDoctorsSeen as UnifiedPatientProfile["lastDoctorsSeen"])
      : [],
  };
}

function invalidateUnifiedProfileCacheByWallet(wallet: string): void {
  const prefix = `${wallet.toLowerCase()}|`;
  Array.from(unifiedProfileCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) unifiedProfileCache.delete(key);
  });
  Array.from(unifiedProfileInflight.keys()).forEach((key) => {
    if (key.startsWith(prefix)) unifiedProfileInflight.delete(key);
  });
}

export async function loadUnifiedPatientProfile(wallet: string, email: string): Promise<UnifiedPatientProfile> {
  const key = `${wallet.toLowerCase()}|${email.toLowerCase()}`;
  const now = Date.now();
  const cachedHit = unifiedProfileCache.get(key);
  if (cachedHit && cachedHit.expiresAt > now) return cachedHit.value;

  const inflight = unifiedProfileInflight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    const [apiRaw, cached] = await Promise.all([
      getPatientStatus(wallet) as unknown as Promise<Record<string, unknown>>,
      Promise.resolve((readPatientProfileCache(wallet) ?? {}) as Record<string, unknown>),
    ]);
    const api = apiRaw as Record<string, unknown>;

    // Always load chain/IPFS — it is the cross-device source of truth.
    // Never skip it based on what the API returned, because the API may
    // itself be serving device-local or stale cached data.
    let chainProfile: Record<string, unknown> = {};
    try {
      chainProfile = (await loadRoleProfileFromChain(email, wallet)) ?? {};
    } catch {
      chainProfile = {};
    }

    // Merge priority: API (lowest) → localStorage (latest local edits) → chain/IPFS (highest).
    // Chain data remains authoritative, while local cache avoids stale API snapshots
    // overriding recently edited fields before sync settles.
    const merged: Record<string, unknown> = {
      ...api,
      ...cached,
      ...chainProfile, // chain/IPFS is authoritative and always wins
      walletAddress: wallet,
      isRegisteredOnChain: true,
      email,
    };

    const normalized = toUnifiedProfile(merged, wallet, email);
    writePatientProfileCache(wallet, normalized as unknown as Record<string, unknown>);
    unifiedProfileCache.set(key, {
      expiresAt: Date.now() + UNIFIED_PROFILE_CACHE_TTL_MS,
      value: normalized,
    });
    return normalized;
  })();

  unifiedProfileInflight.set(key, task);
  try {
    return await task;
  } finally {
    unifiedProfileInflight.delete(key);
  }
}

export async function saveUnifiedPatientProfile(
  wallet: string,
  patch: Record<string, unknown>
): Promise<{ success: boolean; message?: string }> {
  invalidateUnifiedProfileCacheByWallet(wallet);
  const cached = (readPatientProfileCache(wallet) ?? {}) as Record<string, unknown>;
  const next = {
    ...cached,
    ...patch,
    walletAddress: wallet,
    isRegisteredOnChain: true,
  };
  writePatientProfileCache(wallet, next);
  const result = await updatePatientProfile(
    next as unknown as Parameters<typeof updatePatientProfile>[0],
    wallet
  );
  invalidateUnifiedProfileCacheByWallet(wallet);
  return result;
}
