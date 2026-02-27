import { NextRequest, NextResponse } from "next/server";
import { listDoctorsFromIdentityRegistry } from "@/lib/server/doctor-directory";
import { isBlockedHospitalId } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const hospitalId = (request.nextUrl.searchParams.get("hospitalId") || "").trim().toLowerCase();
    const hospitalName = (request.nextUrl.searchParams.get("hospitalName") || "").trim().toLowerCase();
    const query = (request.nextUrl.searchParams.get("query") || "").trim();
    if (!hospitalId && !hospitalName) {
      return NextResponse.json(
        { success: false, doctors: [], error: "Missing hospital context (hospitalId or hospitalName required)." },
        { status: 400 }
      );
    }
    if (isBlockedHospitalId(hospitalId)) {
      return NextResponse.json(
        { success: false, doctors: [], error: "Hospital account is blocked from directory results." },
        { status: 403 }
      );
    }

    const doctors = await listDoctorsFromIdentityRegistry({ hospitalId, hospitalName, query });
    return NextResponse.json({ success: true, doctors, source: "identity-registry" });
  } catch (error) {
    return NextResponse.json(
      { success: false, doctors: [], error: error instanceof Error ? error.message : "Failed to load doctors" },
      { status: 500 }
    );
  }
}
