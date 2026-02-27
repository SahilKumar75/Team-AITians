/**
 * Client-only data layer for static export / fully decentralised mode.
 * When NEXT_PUBLIC_USE_CLIENT_DATA=true, use these instead of /api/*.
 */
export { useClientData } from "./use-client-data";
export {
  getDoctorProfileClient,
  updateDoctorProfileClient,
  getPatientStatusClient,
  updatePatientProfileClient,
  type DoctorProfileResponseClient,
  type PatientStatusResponseClient,
} from "./profile";
export {
  getHospitalsClient,
  STATIC_HOSPITALS,
} from "./hospitals";
export {
  getJourneysClient,
  getAllJourneysClient,
  getJourneyClient,
  getJourneyAnyClient,
  createJourneyClient,
  updateJourneyClient,
  updateJourneyAnyClient,
  getHospitalJourneysClient,
} from "./journey";
export { listRecordsClient, type RecordClient } from "./records";
export { KEYS } from "./storage-keys";
export {
  getDoctorDashboardClient,
  getDoctorSearchClient,
  getDoctorPatientsClient,
  getVoiceNotesClient,
  getVoiceNoteClient,
  updateVoiceNoteStatusClient,
  createVoiceSoapNoteClient,
  getPatientPermissionsClient,
  getPatientDoctorsSearchClient,
  grantAccessClient,
  getHealthInsightsClient,
  getVoiceIntentClient,
  notifyEmergencyClient,
  getEmergencyClient,
  getLanguageClient,
  setLanguageClient,
} from "./stubs";
