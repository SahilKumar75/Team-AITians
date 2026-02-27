/**
 * Patient document upload (ARCHITECTURE.md).
 * Pins to our own IPFS node (IPFS_API_URL). No Pinata.
 */

import { NextRequest, NextResponse } from "next/server";
import { addToIPFSNode, isIPFSNodeConfigured } from "@/lib/ipfs-node";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const ipfsConfigured = isIPFSNodeConfigured();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "document";
    const description = (formData.get("description") as string) || "";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing or invalid 'file'." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    let cid: string;
    if (ipfsConfigured) {
      cid = await addToIPFSNode(file);
    } else {
      return NextResponse.json(
        { error: "IPFS is not configured. Set IPFS_API_URL to a reachable node." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      cid,
      fileName: file.name,
      category,
      description,
    });
  } catch (e) {
    console.error("Patient upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
