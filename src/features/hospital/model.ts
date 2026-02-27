/**
 * Hospital feature — model (types).
 * Re-export domain types; add API response shapes if needed.
 */
export type { Hospital, Department, DayOfWeek } from "@/lib/types";

/** API response shape for GET /api/hospitals */
export interface HospitalsResponse {
  hospitals: Array<{
    id: string;
    name: string;
    code: string;
    city: string;
    state?: string;
    type?: string;
    departments?: Array<{
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
    }>;
  }>;
}
