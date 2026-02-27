import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { asString, loadProfileFromIdentity, resolveIdentity } from "@/lib/server/identity-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Hospital profile is resolved from on-chain/IPFS role profile on client side.
 * This route remains a neutral fallback for non-client-data contexts.
 */
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    const identifier = request.nextUrl.searchParams.get("identifier");
    const key = wallet || identifier;
    if (!key) return NextResponse.json({ hospital: null });

    const { identity } = await resolveIdentity(key);
    if (!identity || identity.role.toLowerCase() !== "hospital") {
      return NextResponse.json({ hospital: null });
    }
    const { profile } = await loadProfileFromIdentity(identity);
    if (!profile) return NextResponse.json({ hospital: null });
    return NextResponse.json({
      hospital: {
        ...profile,
        walletAddress: asString(profile.walletAddress, identity.walletAddress),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load hospital profile" },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: "Hospital profile updates must be client-signed and written via on-chain lock update." },
    { status: 400 }
  );
}
