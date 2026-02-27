/**
 * Patient feature — model (types).
 * UI/profile shape used by patient portal and journey; domain types from lib/types.
 */
import type { LastDoctorSeen, FamilySharingPrefs } from "@/lib/types";

/** Patient profile data as used in patient portal / forms (View layer shape). */
export interface PatientProfileData {
  name: string;
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
  profilePicture?: string;
  lastDoctorsSeen?: LastDoctorSeen[];
  familySharingPrefs?: FamilySharingPrefs;
}

/** API response shape for GET /api/patient/status */
export interface PatientStatusResponse {
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
  lastDoctorsSeen?: LastDoctorSeen[];
  familySharingPrefs?: FamilySharingPrefs;
}

export type { LastDoctorSeen, FamilySharingPrefs } from "@/lib/types";
