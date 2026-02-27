import { NextRequest, NextResponse } from "next/server";
import { createJourneyShareToken } from "@/lib/server/journey-share-token";

/** For static export: one placeholder so build succeeds. */
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const url = request.nextUrl;
  const origin = url.origin || "https://example.com";
  const ttlMinutes = typeof body?.ttlMinutes === "number" ? Math.max(5, Math.min(1440, body.ttlMinutes)) : 180;
  const token = createJourneyShareToken(id, ttlMinutes);
  const shareUrl = `${origin}/journey/track/${id}?share=${encodeURIComponent(token)}`;
  return NextResponse.json({ shareUrl, success: true, expiresInMinutes: ttlMinutes });
}
