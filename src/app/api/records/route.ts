import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getPatientRecordIds, getRecordMetadata } from "@/lib/blockchain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const patientAddress = (request.nextUrl.searchParams.get("patientAddress") || "").trim();
    if (!patientAddress) return NextResponse.json({ records: [] });

    const ids = await getPatientRecordIds(patientAddress);
    const rows = await Promise.all(ids.map((id) => getRecordMetadata(id)));
    const records = rows
      .map((r, idx) => ({ id: ids[idx], ...r }))
      .filter((r) => r && r.active)
      .map((r) => ({
        id: r!.id,
        fileCid: r!.fileCid,
        recordHash: r!.fileCid,
        patient: r!.patient,
        uploader: r!.uploader,
        fileType: r!.fileType,
        timestamp: r!.timestamp,
        active: r!.active,
      }));

    return NextResponse.json({ records });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch records" },
      { status: 500 }
    );
  }
}
