export const KEYS = {
  doctorProfile: (email: string) => `swathya_doctor_profile_${(email || "").toLowerCase()}`,
  patientProfile: (wallet: string) => `swathya_patient_profile_${(wallet || "").toLowerCase()}`,
  journeys: (wallet: string) => `swathya_journeys_${(wallet || "").toLowerCase()}`,
  language: "swathya_user_language",
  voiceNotes: (wallet: string) => `swathya_voice_notes_${(wallet || "").toLowerCase()}`,
} as const;
