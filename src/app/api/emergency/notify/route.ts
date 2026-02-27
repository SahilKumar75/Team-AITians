/**
 * Emergency ICE notification (ARCHITECTURE.md).
 * When Tier 1 or Tier 2 is triggered, call this to send SMS to patient's emergency contact.
 * Body: { patientAddress, hospitalName, tier?, emergencyPhone? }
 * If emergencyPhone not provided, resolve from identity/emergency profile (e.g. from chain or API).
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const notifyUrl = `${origin}/api/notify`;
    const body = await request.json();
    const { patientAddress, hospitalName, tier = "1", emergencyPhone, patientName } = body as {
      patientAddress?: string;
      hospitalName?: string;
      tier?: string;
      emergencyPhone?: string;
      patientName?: string;
    };

    if (!emergencyPhone) {
      return NextResponse.json(
        { error: "emergencyPhone required (or implement resolve from patientAddress)." },
        { status: 400 }
      );
    }

    const message =
      `Your contact ${patientName || "Patient"} was admitted in an emergency. Hospital: ${hospitalName || "Unknown"}. Time: ${new Date().toLocaleString()}.` +
      (tier === "2" ? " Unconscious protocol may apply." : "");

    const res = await fetch(notifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emergencyPhone, message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { error?: string }).error || "Notify failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ sent: true, ...data });
  } catch (e) {
    console.error("Emergency notify error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Notify failed" },
      { status: 500 }
    );
  }
}
