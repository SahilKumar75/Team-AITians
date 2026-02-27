/**
 * Client-only profile storage (localStorage keyed by wallet/email).
 * Used when NEXT_PUBLIC_USE_CLIENT_DATA=true (static export / fully decentralised).
 */
import { KEYS } from "./storage-keys";

// ─── Doctor ─────────────────────────────────────────────────────────────────

export interface DoctorProfileClient {
  name?: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  specialization?: string;
  qualification?: string;
  experience?: string;
  hospital?: string;
  city?: string;
  state?: string;
  pincode?: string;
  hospitalId?: string;
  departmentIds?: string[];
  departmentNames?: string;
  profilePicture?: string;
}

export interface DoctorProfileResponseClient {
  doctor: DoctorProfileClient | null;
}

export function getDoctorProfileClient(identifier?: string): DoctorProfileResponseClient {
  if (typeof window === "undefined" || !identifier) return { doctor: null };
  try {
    const raw = localStorage.getItem(KEYS.doctorProfile(identifier));
    if (!raw) return { doctor: null };
    const parsed = JSON.parse(raw) as DoctorProfileClient;
    return { doctor: { ...parsed, email: parsed.email ?? identifier } };
  } catch {
    return { doctor: null };
  }
}

export function updateDoctorProfileClient(
  identifier: string,
  data: Partial<DoctorProfileClient>
): { success: boolean } {
  if (typeof window === "undefined") return { success: false };
  try {
    const existing = getDoctorProfileClient(identifier).doctor ?? {};
    const next = { ...existing, ...data, email: data.email ?? existing.email ?? identifier };
    localStorage.setItem(KEYS.doctorProfile(identifier), JSON.stringify(next));
    return { success: true };
  } catch {
    return { success: false };
  }
}

// ─── Patient ───────────────────────────────────────────────────────────────

export interface PatientStatusResponseClient {
  walletAddress: string | null;
  isRegisteredOnChain?: boolean;
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  currentMedications: string | null;
  previousSurgeries: string | null;
  height: string | null;
  weight: string | null;
  profilePicture: string | null;
  lastDoctorsSeen?: unknown[];
  familySharingPrefs?: unknown;
}

const emptyPatientStatus = (wallet: string | null): PatientStatusResponseClient => ({
  walletAddress: wallet,
  isRegisteredOnChain: !!wallet,
  fullName: null,
  dateOfBirth: null,
  gender: null,
  bloodGroup: null,
  phone: null,
  address: null,
  city: null,
  state: null,
  pincode: null,
  emergencyName: null,
  emergencyRelation: null,
  emergencyPhone: null,
  allergies: null,
  chronicConditions: null,
  currentMedications: null,
  previousSurgeries: null,
  height: null,
  weight: null,
  profilePicture: null,
});

function readFirstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const joined = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean).join(", ");
      if (joined) return joined;
    }
  }
  return null;
}

export function getPatientStatusClient(wallet?: string | null): PatientStatusResponseClient {
  if (typeof window === "undefined") return emptyPatientStatus(wallet ?? null);
  const w = (wallet ?? "").trim() || null;
  if (!w) return emptyPatientStatus(null);
  try {
    const raw = localStorage.getItem(KEYS.patientProfile(w));
    if (!raw) return emptyPatientStatus(w);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...emptyPatientStatus(w),
      fullName: (parsed.fullName as string) ?? (parsed.name as string) ?? null,
      dateOfBirth: (parsed.dateOfBirth as string) ?? null,
      gender: (parsed.gender as string) ?? null,
      bloodGroup: (parsed.bloodGroup as string) ?? null,
      phone: (parsed.phone as string) ?? null,
      address: (parsed.address as string) ?? null,
      city: (parsed.city as string) ?? null,
      state: (parsed.state as string) ?? null,
      pincode: (parsed.pincode as string) ?? null,
      emergencyName: (parsed.emergencyName as string) ?? null,
      emergencyRelation: (parsed.emergencyRelation as string) ?? null,
      emergencyPhone: (parsed.emergencyPhone as string) ?? null,
      allergies: readFirstString(parsed, ["allergies", "allergy", "knownAllergies", "allergyDetails"]),
      chronicConditions: readFirstString(parsed, [
        "chronicConditions",
        "conditions",
        "medicalConditions",
        "healthConditions",
        "chronicCondition",
        "diseases",
      ]),
      currentMedications: readFirstString(parsed, [
        "currentMedications",
        "medications",
        "currentMedication",
        "medicationList",
        "medicine",
        "meds",
      ]),
      previousSurgeries: (parsed.previousSurgeries as string) ?? null,
      height: (parsed.height as string) ?? null,
      weight: (parsed.weight as string) ?? null,
      profilePicture: (parsed.profilePicture as string) ?? null,
      lastDoctorsSeen: (parsed.lastDoctorsSeen as unknown[]) ?? undefined,
      familySharingPrefs: (parsed.familySharingPrefs as unknown) ?? undefined,
    };
  } catch {
    return emptyPatientStatus(w);
  }
}

export function updatePatientProfileClient(
  wallet: string,
  data: Partial<PatientStatusResponseClient>
): { success: boolean; message?: string } {
  if (typeof window === "undefined") return { success: false };
  try {
    const existing = getPatientStatusClient(wallet);
    const next = {
      walletAddress: wallet,
      isRegisteredOnChain: existing.isRegisteredOnChain,
      fullName: data.fullName ?? existing.fullName,
      dateOfBirth: data.dateOfBirth ?? existing.dateOfBirth,
      gender: data.gender ?? existing.gender,
      bloodGroup: data.bloodGroup ?? existing.bloodGroup,
      phone: data.phone ?? existing.phone,
      address: data.address ?? existing.address,
      city: data.city ?? existing.city,
      state: data.state ?? existing.state,
      pincode: data.pincode ?? existing.pincode,
      emergencyName: data.emergencyName ?? existing.emergencyName,
      emergencyRelation: data.emergencyRelation ?? existing.emergencyRelation,
      emergencyPhone: data.emergencyPhone ?? existing.emergencyPhone,
      allergies: data.allergies ?? existing.allergies,
      chronicConditions: data.chronicConditions ?? existing.chronicConditions,
      currentMedications: data.currentMedications ?? existing.currentMedications,
      previousSurgeries: data.previousSurgeries ?? existing.previousSurgeries,
      height: data.height ?? existing.height,
      weight: data.weight ?? existing.weight,
      profilePicture: data.profilePicture ?? existing.profilePicture,
      lastDoctorsSeen: data.lastDoctorsSeen ?? existing.lastDoctorsSeen,
      familySharingPrefs: data.familySharingPrefs ?? existing.familySharingPrefs,
    };
    localStorage.setItem(KEYS.patientProfile(wallet), JSON.stringify(next));
    return { success: true };
  } catch {
    return { success: false };
  }
}
