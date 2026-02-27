import { NextResponse } from "next/server";
import { listHospitalJourneysFromIdentityRegistry } from "@/lib/server/journey-directory";
import { isBlockedHospitalId, isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Stub: returns active journeys for a hospital.
 * In decentralised design, journey list comes from Helia; this is for UI wiring.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: hospitalId } = await params;
  if (!hospitalId) {
    return NextResponse.json({ error: "Missing hospital id" }, { status: 400 });
  }
  if (isBlockedHospitalId(hospitalId)) {
    return NextResponse.json({ hospitalId, journeys: [], source: "identity-registry" });
  }
  try {
    const journeys = (await listHospitalJourneysFromIdentityRegistry(hospitalId)).filter(
      (row) => !isBlockedWallet(row.patient?.walletAddress)
    );
    return NextResponse.json({
      hospitalId,
      journeys,
      source: "identity-registry",
    });
  } catch (error) {
    return NextResponse.json(
      {
        hospitalId,
        journeys: [],
        error: error instanceof Error ? error.message : "Failed to load journeys",
      },
      { status: 500 }
    );
  }
}
