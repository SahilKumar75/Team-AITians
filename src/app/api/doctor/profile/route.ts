import { NextRequest, NextResponse } from "next/server";
import { asString, loadProfileFromIdentity, resolveIdentity } from "@/lib/server/identity-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    const identifier = request.nextUrl.searchParams.get("identifier");
    const key = wallet || identifier;
    if (!key) return NextResponse.json({ doctor: null });

    const { identity } = await resolveIdentity(key);
    if (!identity || identity.role.toLowerCase() !== "doctor") {
      return NextResponse.json({ doctor: null });
    }
    const { profile } = await loadProfileFromIdentity(identity);
    if (!profile) return NextResponse.json({ doctor: null });

    return NextResponse.json({
      doctor: {
        ...profile,
        walletAddress: asString(profile.walletAddress, identity.walletAddress),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load doctor profile" },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: "Doctor profile updates must be client-signed and written via on-chain lock update.",
  }, { status: 400 });
}
