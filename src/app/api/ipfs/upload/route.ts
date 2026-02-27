/**
 * Server-side IPFS pin (ARCHITECTURE.md).
 * Uses our own IPFS node (IPFS_API_URL) or Pinata (PINATA_JWT) server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { addToIPFSNode, isIPFSNodeConfigured } from "@/lib/ipfs-node";
import { isPinataConfigured, pinFileToPinata } from "@/lib/pinata-server";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const hasNode = isIPFSNodeConfigured();
  const hasPinata = isPinataConfigured();
  if (!hasNode && !hasPinata) {
    return NextResponse.json(
      { error: "IPFS not configured. Set IPFS_API_URL (self-hosted) or PINATA_JWT (Pinata)." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing or invalid 'file' in form data." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    const errors: string[] = [];

    if (hasNode) {
      try {
        const cid = await addToIPFSNode(file);
        return NextResponse.json({ cid });
      } catch (e) {
        errors.push(`node: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }

    if (hasPinata) {
      try {
        const cid = await pinFileToPinata(file);
        return NextResponse.json({ cid });
      } catch (e) {
        errors.push(`pinata: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }

    return NextResponse.json(
      { error: errors.join(" | ") || "Upload failed" },
      { status: 502 }
    );
  } catch (e) {
    console.error("IPFS upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
