/**
 * Journey feature — model (types).
 * Re-export domain types; add API request/response shapes.
 */
export type { Session, Visit, Order } from "@/lib/types";

/** Request body for POST /api/journey */
export interface CreateJourneyRequest {
  hospitalId: string;
  visitType?: string;
  chiefComplaint?: string;
  departmentIds: string[];
  allottedDoctorWallet?: string;
}

/** Journey as returned by API (single visit / current app shape). */
export interface JourneyApiResponse {
  id: string;
  tokenNumber: string;
  visitType: string;
  chiefComplaint?: string;
  departmentIds?: string[];
  allottedDoctorWallet?: string;
  status: string;
  startedAt: string;
  progressPercent: number;
  currentCheckpointId?: string;
  hospital: { id: string; name: string; code: string; city: string };
  checkpoints: unknown[];
}
