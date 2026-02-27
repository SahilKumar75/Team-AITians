import { NextResponse } from "next/server";
import { getIdentityContract } from "@/lib/blockchain";
import { listHospitalsFromIdentityRegistry } from "@/lib/hospital-directory";
import { catFromIPFSNode, isIPFSNodeConfigured } from "@/lib/ipfs-node";
import { fetchFromPinataGateway } from "@/lib/pinata-server";
import { listHospitalsFromSubgraph } from "@/lib/subgraph-directory";
import { isBlockedHospitalId } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const HOSPITAL_LIST_CACHE_TTL_MS = Math.max(10_000, Number(process.env.HOSPITAL_LIST_CACHE_TTL_MS || 60_000));

let hospitalsCache:
  | {
      expiresAt: number;
      includeDepartments: boolean;
      payload: { hospitals: unknown[]; source: string };
    }
  | null = null;

async function fetchJsonByCidServer(cid: string): Promise<unknown> {
  const parse = (buffer: ArrayBuffer) => {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    return JSON.parse(text) as unknown;
  };

  if (isIPFSNodeConfigured()) {
    try {
      const fromNode = await catFromIPFSNode(cid);
      return parse(fromNode);
    } catch {
      // Fallback to gateway below
    }
  }

  const fromGateway = await fetchFromPinataGateway(cid);
  return parse(fromGateway);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDepartments = searchParams.get("departments") === "true";
    const now = Date.now();
    if (
      hospitalsCache &&
      hospitalsCache.includeDepartments === includeDepartments &&
      hospitalsCache.expiresAt > now
    ) {
      const res = NextResponse.json(hospitalsCache.payload);
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }

    const indexed = await listHospitalsFromSubgraph();
    const indexedFiltered = indexed.filter((h) => !isBlockedHospitalId(h.id));
    if (indexedFiltered.length > 0 && !includeDepartments) {
      const payload = {
        hospitals: indexedFiltered.map((h) => ({
          id: h.id,
          name: h.name,
          code: h.code || "HOSP",
          city: h.city || "",
          state: h.state || "",
          type: h.type || "General",
          departments: [],
        })),
        source: "subgraph",
      };
      hospitalsCache = { expiresAt: now + HOSPITAL_LIST_CACHE_TTL_MS, includeDepartments, payload };
      const res = NextResponse.json(payload);
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }

    const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "";
    if (identityAddress) {
      const contract = getIdentityContract();
      const hospitals = await listHospitalsFromIdentityRegistry({
        identityContract: contract,
        fetchJsonByCid: fetchJsonByCidServer,
        lookbackBlocks: Number(process.env.HOSPITAL_DIRECTORY_LOOKBACK_BLOCKS || 500000),
      });
      const hospitalsFiltered = hospitals.filter((h) => !isBlockedHospitalId(h.id));
      if (hospitalsFiltered.length > 0) {
        if (indexedFiltered.length > 0) {
          const byId = new Map(hospitalsFiltered.map((h) => [String(h.id).toLowerCase(), h]));
          const merged = indexedFiltered.map((h) => {
            const chain = byId.get(String(h.id).toLowerCase());
            return chain || {
              id: h.id,
              name: h.name,
              code: h.code || "HOSP",
              city: h.city || "",
              state: h.state || "",
              type: h.type || "General",
              departments: [],
            };
          });
          const payload = { hospitals: merged, source: "subgraph+identity-registry" };
          hospitalsCache = { expiresAt: now + HOSPITAL_LIST_CACHE_TTL_MS, includeDepartments, payload };
          const res = NextResponse.json(payload);
          res.headers.set("Cache-Control", "no-store, max-age=0");
          return res;
        }
        const payload = { hospitals: hospitalsFiltered, source: "identity-registry" };
        hospitalsCache = { expiresAt: now + HOSPITAL_LIST_CACHE_TTL_MS, includeDepartments, payload };
        const res = NextResponse.json(payload);
        res.headers.set("Cache-Control", "no-store, max-age=0");
        return res;
      }
    }

    const payload = {
      hospitals: indexedFiltered.map((h) => ({
        id: h.id,
        name: h.name,
        code: h.code || "HOSP",
        city: h.city || "",
        state: h.state || "",
        type: h.type || "General",
        departments: [],
      })),
      source: "subgraph",
    };
    hospitalsCache = { expiresAt: now + HOSPITAL_LIST_CACHE_TTL_MS, includeDepartments, payload };
    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (error) {
    console.error("Failed to load hospital directory:", error);
    return NextResponse.json({ hospitals: [] });
  }
}
