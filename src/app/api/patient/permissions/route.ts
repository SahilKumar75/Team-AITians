import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getAccessGrantsForPatient } from "@/lib/blockchain";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const patientAddress = (request.nextUrl.searchParams.get("patientAddress") || "").trim();
    if (!patientAddress) return NextResponse.json({ success: true, permissions: [] });
    const grants = await getAccessGrantsForPatient(patientAddress);
    const dedup = new Map<string, { doctorAddress: string; recordIds: string[]; encDekIpfsCid: string }>();
    grants.forEach((g) => {
      const key = g.doctorAddress.toLowerCase();
      if (isBlockedWallet(key)) return;
      if (!dedup.has(key)) {
        dedup.set(key, { doctorAddress: g.doctorAddress, recordIds: [g.recordId], encDekIpfsCid: g.encDekIpfsCid });
      } else {
        dedup.get(key)!.recordIds.push(g.recordId);
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
