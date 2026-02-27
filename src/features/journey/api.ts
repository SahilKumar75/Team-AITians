/**
 * Journey feature — Model (API client).
 * When NEXT_PUBLIC_USE_CLIENT_DATA=true, uses client-data (localStorage) (no /api calls).
 */
import type { CreateJourneyRequest } from "./model";
import type { JourneyApiResponse } from "./model";
import { useClientData } from "@/lib/client-data";
import {
  createJourneyClient,
  getJourneyAnyClient,
  getJourneyClient,
  getJourneysClient,
  updateJourneyClient,
} from "@/lib/client-data";

const BASE = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";

export async function createJourney(
  body: CreateJourneyRequest,
  patientWallet?: string | null
): Promise<{ journey: JourneyApiResponse }> {
  if (patientWallet && typeof window !== "undefined" && useClientData()) {
    return createJourneyClient(patientWallet, body);
  }
  const res = await fetch(`${BASE}/api/journey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to start journey");
  return data;
}

export async function getJourney(
  journeyId: string,
  patientWallet?: string | null
): Promise<{ journey: JourneyApiResponse }> {
  if (typeof window !== "undefined" && useClientData()) {
    const out = patientWallet
      ? await getJourneyClient(journeyId, patientWallet)
      : await getJourneyAnyClient(journeyId);
    if (out) return out;
    throw new Error("Journey not found");
  }
  const res = await fetch(`${BASE}/api/journey/${journeyId}`);
  if (!res.ok) throw new Error("Failed to fetch journey");
  return res.json();
}

export async function getJourneys(
  status?: string,
  patientWallet?: string | null
): Promise<{ journeys: JourneyApiResponse[] }> {
  if (typeof window !== "undefined" && useClientData()) {
    const local = await getJourneysClient(patientWallet ?? null, status);
    return local;
  }
  const qsParts: string[] = [];
  if (status) qsParts.push(`status=${encodeURIComponent(status)}`);
  if (patientWallet) qsParts.push(`patientAddress=${encodeURIComponent(patientWallet)}`);
  const qs = qsParts.length > 0 ? `?${qsParts.join("&")}` : "";
  const res = await fetch(`${BASE}/api/journey${qs}`);
  if (!res.ok) return { journeys: [] };
  return res.json();
}

export async function updateJourney(
  journeyId: string,
  patch: Partial<JourneyApiResponse>,
  patientWallet?: string | null
): Promise<{ journey: JourneyApiResponse }> {
  if (patientWallet && typeof window !== "undefined") {
    const out = await updateJourneyClient(patientWallet, journeyId, patch);
    if (!out) throw new Error("Journey not found");
    return out as { journey: JourneyApiResponse };
  }
  const res = await fetch(`${BASE}/api/journey/${journeyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update journey");
  return data;
}
