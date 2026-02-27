import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error:
        "Patient profile updates must be client-signed and saved via IPFS + on-chain LockA update.",
    },
    { status: 400 }
  );
}
