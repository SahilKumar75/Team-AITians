/**
 * Fetch content by CID (ARCHITECTURE.md).
 * Uses our own IPFS node (IPFS_API_URL) or Pinata gateway server-side.
 */

import { NextRequest, NextResponse } from "next/server";

import { catFromIPFSNode, isIPFSNodeConfigured } from "@/lib/ipfs-node";
import { fetchFromPinataGateway, isPinataConfigured } from "@/lib/pinata-server";

export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;
  if (!cid) {
    return NextResponse.json({ error: "Missing CID" }, { status: 400 });
  }

  const hasNode = isIPFSNodeConfigured();
  const hasPinata = isPinataConfigured();
  if (!hasNode && !hasPinata) {
    return NextResponse.json(
      { error: "IPFS not configured. Set IPFS_API_URL (self-hosted) or PINATA_JWT (Pinata)." },
      { status: 503 }
    );
  }

  const errors: string[] = [];

  if (hasNode) {
    try {
      const buffer = await catFromIPFSNode(cid);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
        },
      });
    } catch (e) {
      errors.push(`node: ${e instanceof Error ? e.message : "fetch failed"}`);
    }
  }

  if (hasPinata) {
    try {
      const buffer = await fetchFromPinataGateway(cid);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
        },
      });
    } catch (e) {
      errors.push(`pinata: ${e instanceof Error ? e.message : "fetch failed"}`);
    }
  }

  const message = errors.length > 0 ? errors.join(" | ") : "Fetch failed";
  console.error("IPFS fetch error:", message);
  return NextResponse.json({ error: message }, { status: 502 });
}
