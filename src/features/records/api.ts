/**
 * Records feature — Model (API client).
 * When NEXT_PUBLIC_USE_CLIENT_DATA=true, reads from HealthRegistry directly.
 * Otherwise, reads from /api/records (chain-backed).
 */
import { useClientData } from "@/lib/client-data";
import { listRecordsClient } from "@/lib/client-data";

const BASE = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";

export async function listRecords(params?: { patientAddress?: string }): Promise<{ records: unknown[] }> {
  if (useClientData()) {
    return params?.patientAddress
      ? await listRecordsClient(params.patientAddress)
      : { records: [] };
  }

  const qs = params?.patientAddress
    ? `?patientAddress=${encodeURIComponent(params.patientAddress)}`
    : "";
  try {
    const res = await fetch(`${BASE}/api/records${qs}`);
    if (res.ok) {
      const json = await res.json();
      return { records: json.records ?? [] };
    }
    return { records: [] };
  } catch {
    return { records: [] };
  }
}
