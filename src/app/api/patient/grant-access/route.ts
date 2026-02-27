import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error:
        "Access grants must be client-signed on HealthRegistry (grantRecordAccess) with DEK manifest CID.",
    },
    { status: 400 }
  );
}
