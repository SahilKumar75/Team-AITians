/**
 * Client-only hospital directory from blockchain + IPFS.
 * No hardcoded hospital list.
 */
import { getIdentityContract } from "@/lib/blockchain";
import type { HospitalsResponse } from "@/features/hospital/model";
import { listHospitalsFromIdentityRegistry } from "@/lib/hospital-directory";
import { listHospitalsFromSubgraph } from "@/lib/subgraph-directory";

const GATEWAYS = [
  (process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/$/, ""),
  "https://ipfs.io",
];

async function fetchJsonByCidClient(cid: string): Promise<unknown> {
  let lastError: unknown;
  for (const gateway of GATEWAYS) {
    try {
      const res = await fetch(`${gateway}/ipfs/${encodeURIComponent(cid)}`);
      if (!res.ok) throw new Error(`Gateway ${gateway} failed: ${res.status}`);
      return (await res.json()) as unknown;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to fetch CID JSON from gateways");
}

export const STATIC_HOSPITALS: HospitalsResponse = { hospitals: [] };

export async function getHospitalsClient(_options?: { departments?: boolean }): Promise<HospitalsResponse> {
  try {
    const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "";
    if (identityAddress) {
      const contract = getIdentityContract();
      const hospitals = await listHospitalsFromIdentityRegistry({
        identityContract: contract,
        fetchJsonByCid: fetchJsonByCidClient,
        lookbackBlocks: Number(process.env.NEXT_PUBLIC_HOSPITAL_DIRECTORY_LOOKBACK_BLOCKS || 500000),
      });
      if (hospitals.length > 0) return { hospitals };
    }

    const indexed = await listHospitalsFromSubgraph();
    if (indexed.length > 0) {
      return {
        hospitals: indexed.map((h) => ({
          id: h.id,
          name: h.name,
          code: h.code || "HOSP",
          city: h.city || "",
          state: h.state,
          type: h.type || "General",
          departments: [],
        })),
      };
    }
    return STATIC_HOSPITALS;
  } catch (error) {
    console.error("Client hospital directory load failed:", error);
    return STATIC_HOSPITALS;
  }
}
