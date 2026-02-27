import { NextRequest, NextResponse } from "next/server";
import { getJourneyByIdFromIdentityRegistry } from "@/lib/server/journey-directory";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const journey = await getJourneyByIdFromIdentityRegistry(id);
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }
    if (isBlockedWallet(journey.patient?.walletAddress)) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }
    return NextResponse.json({ journey, source: "identity-registry" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load journey" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const patch = (await request.json()) as Record<string, unknown>;
    return NextResponse.json(
      {
        success: false,
        error:
          "Journey updates must be client-signed and written to profile/IPFS + on-chain pointer. Server PUT is read-only.",
        patch,
      },
      { status: 400 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to update journey" }, { status: 500 });
  }
}
