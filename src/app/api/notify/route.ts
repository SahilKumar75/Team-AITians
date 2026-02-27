/**
 * Emergency SMS/WhatsApp notification (ARCHITECTURE.md).
 * Fast2SMS free tier. Call when Tier 1/2 or unconscious protocol triggers.
 */

import { NextRequest, NextResponse } from "next/server";

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2";

export async function POST(request: NextRequest) {
  if (!FAST2SMS_API_KEY) {
    return NextResponse.json(
      { error: "FAST2SMS_API_KEY not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { to, message } = body as { to?: string; message?: string };
    if (!to || !message) {
      return NextResponse.json(
        { error: "Missing 'to' (phone) or 'message'." },
        { status: 400 }
      );
    }

    const res = await fetch(FAST2SMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: FAST2SMS_API_KEY,
      },
      body: JSON.stringify({
        route: "q",
        message,
        numbers: to.replace(/\D/g, "").slice(-10), // 10 digits
        flash: 0,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { return?: boolean };
    if (!res.ok) {
      return NextResponse.json(
        { error: "Fast2SMS request failed", details: data },
        { status: res.status }
      );
    }
    return NextResponse.json({ sent: data.return ?? true });
  } catch (e) {
    console.error("Notify error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Notify failed" },
      { status: 500 }
    );
  }
}
