/**
 * Doctor feature — model (types).
 * UI/profile shape used by doctor portal; domain types from lib/types.
 */

/** Doctor profile data as used in doctor portal / forms (View layer shape). Aligns with Doctor (lib/types) + docs. */
export interface DoctorProfileData {
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  specialization: string;
  qualification: string;
  experience: string;
  hospital: string;
  city: string;
  state: string;
  walletAddress: string;
  isAuthorized: boolean;
  profilePicture?: string;
  /** Clinician title (Doctor, Surgeon, Nurse, etc.) — from lib/types. */
  title?: string;
  hospitalId?: string;
  departmentIds?: string[];
  availability?: string;
  currentQueue?: number;
}

/** API response shape for GET /api/doctor/profile */
export interface DoctorProfileResponse {
  doctor: {
    name: string;
    email?: string;
    phone?: string;
    pincode?: string;
    licenseNumber: string;
    specialization?: string;
    qualification?: string;
    experience?: string;
    hospital?: string;
    city?: string;
    state?: string;
    title?: string;
    hospitalId?: string;
    departmentIds?: string[];
    departmentNames?: string;
    profilePicture?: string;
    availability?: string;
    currentQueue?: number;
  } | null;
}

export type { Doctor } from "@/lib/types";
