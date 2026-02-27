import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getAccessGrantsForPatient, getAccessManifestCidForPatient } from "@/lib/blockchain";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";
import { hasSubgraphDirectory, listAccessGrantsForPatientFromSubgraph } from "@/lib/subgraph-directory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(t);
        resolve(value);
      },
      (error) => {
        clearTimeout(t);
        reject(error);
      }
    );
  });
}

type PermissionGrant = {
  doctorAddress: string;
  recordId: string;
  encDekIpfsCid: string;
  doctorName?: string;
  specialization?: string;
  hospital?: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function listDoctorWalletsFromManifest(
  origin: string,
  cid: string,
  patientAddress: string
): Promise<Array<{ doctorAddress: string; doctorName?: string; specialization?: string; hospital?: string }>> {
  if (!cid) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const res = await fetch(`${origin}/api/ipfs/fetch/${encodeURIComponent(cid)}`, {
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!res.ok) return [];
  const json = (await res.json()) as { keys?: Record<string, unknown>; doctors?: Record<string, unknown> };
  const keys = json?.keys && typeof json.keys === "object" ? Object.keys(json.keys) : [];
  const doctorsMeta =
    json?.doctors && typeof json.doctors === "object"
      ? (json.doctors as Record<string, unknown>)
      : {};
  const patient = patientAddress.toLowerCase();
  const wallets = Array.from(new Set(keys
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.startsWith("0x") && k.length === 42 && k !== patient && !isBlockedWallet(k))));
  return wallets.map((wallet) => {
    const metaRaw = doctorsMeta[wallet];
    const metaObj =
      metaRaw && typeof metaRaw === "object" ? (metaRaw as Record<string, unknown>) : null;
    return {
      doctorAddress: wallet,
      doctorName: asString(metaObj?.name),
      specialization: asString(metaObj?.specialization),
      hospital: asString(metaObj?.hospital),
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const patientAddress = (request.nextUrl.searchParams.get("patientAddress") || "").trim();
    const forceRefresh = request.nextUrl.searchParams.get("forceRefresh") === "1";
    if (!patientAddress) return NextResponse.json({ success: true, permissions: [] });

    // Fastest path: read patient's current access manifest pointer and resolve doctor keys.
    // This avoids heavy event scans for common page loads.
    let manifestResolved = false;
    let grants: PermissionGrant[] = [];
    if (!forceRefresh) {
      try {
        const manifestCid = await withTimeout(getAccessManifestCidForPatient(patientAddress), 3500);
        if (manifestCid) {
          const doctorsFromManifest = await withTimeout(
            listDoctorWalletsFromManifest(request.nextUrl.origin, manifestCid, patientAddress),
            4000
          );
          grants = doctorsFromManifest.map((doc) => ({
            doctorAddress: doc.doctorAddress,
            recordId: `manifest-${doc.doctorAddress}`,
            encDekIpfsCid: manifestCid,
            doctorName: doc.doctorName,
            specialization: doc.specialization,
            hospital: doc.hospital,
          }));
          manifestResolved = true;
        }
      } catch {
        manifestResolved = false;
      }
    }

    // Secondary fast path: use subgraph index.
    // On-chain reconciliation remains available via forceRefresh=1.
    let subgraphResolved = false;

    if (!manifestResolved && hasSubgraphDirectory()) {
      try {
        const fromSubgraph = await withTimeout(listAccessGrantsForPatientFromSubgraph(patientAddress), 5000);
        grants = fromSubgraph.map((g) => ({
          doctorAddress: g.doctorAddress,
          recordId: g.recordId,
          encDekIpfsCid: g.encDekIpfsCid,
        }));
        subgraphResolved = true;
      } catch {
        subgraphResolved = false;
      }
    }

    // If neither fast path returns data, do a bounded chain reconciliation.
    // This avoids false-empty permission lists when index lags or points to another contract.
    const shouldReconcileWithChain =
      forceRefresh || (!manifestResolved && (!subgraphResolved || grants.length === 0));

    // For explicit refreshes, allow a longer timeout.
    if (shouldReconcileWithChain) {
      const timeoutMs = forceRefresh ? 25000 : 15000;
      try {
        const chainGrants = await withTimeout(
          getAccessGrantsForPatient(patientAddress, { forceRefresh }),
          timeoutMs
        );
        grants = chainGrants.map((g) => ({
          doctorAddress: g.doctorAddress,
          recordId: g.recordId,
          encDekIpfsCid: g.encDekIpfsCid,
        }));
      } catch {
        // Keep subgraph results (if any) instead of failing or blocking the page.
        if (grants.length === 0) {
          console.warn("[patient/permissions] Chain reconciliation timed out; returning empty permissions.");
        } else {
          console.warn("[patient/permissions] Chain refresh timed out; returning indexed permissions.");
        }
      }
    }

    const dedup = new Map<
      string,
      {
        doctorAddress: string;
        recordIds: string[];
        encDekIpfsCid: string;
        doctorName?: string;
        specialization?: string;
        hospital?: string;
      }
    >();
    grants.forEach((g) => {
      const key = g.doctorAddress.toLowerCase();
      if (isBlockedWallet(key)) return;
      if (!dedup.has(key)) {
        dedup.set(key, {
          doctorAddress: g.doctorAddress,
          recordIds: [g.recordId],
          encDekIpfsCid: g.encDekIpfsCid,
          doctorName: asString(g.doctorName),
          specialization: asString(g.specialization),
          hospital: asString(g.hospital),
        });
      } else {
        const existing = dedup.get(key)!;
        existing.recordIds.push(g.recordId);
        if (!asString(existing.doctorName) && asString(g.doctorName)) existing.doctorName = asString(g.doctorName);
        if (!asString(existing.specialization) && asString(g.specialization)) existing.specialization = asString(g.specialization);
        if (!asString(existing.hospital) && asString(g.hospital)) existing.hospital = asString(g.hospital);
      }
    });
    return NextResponse.json({
      success: true,
      permissions: Array.from(dedup.values()),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load permissions", permissions: [] },
      { status: 500 }
    );
  }
}
