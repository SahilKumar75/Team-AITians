/**
 * Hospital feature — Model (API client).
 * When NEXT_PUBLIC_USE_CLIENT_DATA=true, uses static client-data (no /api calls).
 */
import type { HospitalsResponse } from "./model";
import { useClientData } from "@/lib/client-data";
import { getHospitalsClient, getHospitalJourneysClient } from "@/lib/client-data";

const BASE = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";

export async function getHospitals(options?: { departments?: boolean }): Promise<HospitalsResponse> {
  if (typeof window !== "undefined" && useClientData()) {
    return getHospitalsClient(options);
  }
  const qs = options?.departments ? "?departments=true" : "";
  const res = await fetch(`${BASE}/api/hospitals-list${qs}`);
  if (!res.ok) throw new Error("Failed to fetch hospitals");
  return res.json();
}

export async function getHospitalJourneys(hospitalId: string): Promise<{ journeys: unknown[] }> {
  if (typeof window !== "undefined") {
    const local = await getHospitalJourneysClient(hospitalId);
    if (local.journeys.length > 0 || useClientData()) return local;
  }
  const res = await fetch(`${BASE}/api/hospitals/${hospitalId}/journeys`);
  if (!res.ok) return { journeys: [] };
  return res.json();
}
