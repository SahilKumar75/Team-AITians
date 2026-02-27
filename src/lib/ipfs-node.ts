/**
 * IPFS via our own node (ARCHITECTURE.md).
 * No Pinata. Use IPFS_API_URL (e.g. Kubo at http://localhost:5001 or your Helia HTTP gateway).
 */

const IPFS_API_URL = (process.env.IPFS_API_URL || "").replace(/\/$/, "");

export function isIPFSNodeConfigured(): boolean {
  return !!IPFS_API_URL;
}

/**
 * Add a file to our IPFS node (Kubo /api/v0/add compatible).
 * Returns CID. Use from API routes only (server-side).
 */
export async function addToIPFSNode(file: File): Promise<string> {
  if (!IPFS_API_URL) {
    throw new Error("IPFS_API_URL not set. Configure your IPFS node.");
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${IPFS_API_URL}/api/v0/add`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IPFS add failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { Hash?: string; Name?: string };
  if (!data.Hash) {
    throw new Error("IPFS add response missing Hash");
  }
  return data.Hash;
}

/**
 * Add raw bytes (e.g. encrypted blob). Kubo accepts file with filename.
 */
export async function addBytesToIPFSNode(bytes: Uint8Array, filename = "blob"): Promise<string> {
  if (!IPFS_API_URL) {
    throw new Error("IPFS_API_URL not set.");
  }
  const blob = new Blob([bytes as BufferSource]);
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch(`${IPFS_API_URL}/api/v0/add`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IPFS add failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { Hash?: string };
  if (!data.Hash) throw new Error("IPFS add response missing Hash");
  return data.Hash;
}

/**
 * Fetch content by CID from our node (Kubo /api/v0/cat).
 */
export async function catFromIPFSNode(cid: string): Promise<ArrayBuffer> {
  if (!IPFS_API_URL) {
    throw new Error("IPFS_API_URL not set.");
  }
  const url = `${IPFS_API_URL}/api/v0/cat?arg=${encodeURIComponent(cid)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IPFS cat failed: ${res.status}`);
  }
  return res.arrayBuffer();
}
