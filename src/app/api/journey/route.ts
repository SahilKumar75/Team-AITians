import { NextRequest, NextResponse } from "next/server";
import { listAllJourneysFromIdentityRegistry, listHospitalJourneysFromIdentityRegistry } from "@/lib/server/journey-directory";
import { isBlockedHospitalId, isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const hospitalId = (searchParams.get("hospitalId") || "").trim();
  const patientAddress = (searchParams.get("patientAddress") || "").trim().toLowerCase();
  try {
    if (isBlockedHospitalId(hospitalId) || isBlockedWallet(patientAddress)) {
      return NextResponse.json({ journeys: [] });
    }
    const journeysRaw = hospitalId
      ? await listHospitalJourneysFromIdentityRegistry(hospitalId)
      : await listAllJourneysFromIdentityRegistry();
    const byPatient = patientAddress
      ? journeysRaw.filter((j) => (j.patient?.walletAddress || "").toLowerCase() === patientAddress)
      : journeysRaw;
    const visible = byPatient.filter((j) => !isBlockedWallet(j.patient?.walletAddress));
    const filtered =
      status === "all" ? visible : visible.filter((j) => j.status.toLowerCase() === status.toLowerCase());
    return NextResponse.json({ journeys: filtered });
  } catch (error) {
    return NextResponse.json(
      { journeys: [], error: error instanceof Error ? error.message : "Failed to load journeys" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(
      {
        success: false,
        error:
          "Journey creation must be client-signed and written to profile/IPFS + on-chain pointer. Server POST is read-only.",
        body,
      },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json({ error: "Failed to start journey" }, { status: 500 });
  }
}
