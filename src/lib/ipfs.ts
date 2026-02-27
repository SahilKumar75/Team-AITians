/**
 * IPFS client: always use our backend API.
 * Backend decides provider: self-hosted node (IPFS_API_URL) or Pinata (PINATA_JWT).
 */

/**
 * Upload a file to IPFS via backend API.
 */
export async function uploadToIPFS(file: File): Promise<string> {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    throw new Error(`File size exceeds 10MB limit. Got ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }
  const ALLOWED_TYPES = ["application/pdf", "application/json", "image/jpeg", "image/png", "image/jpg", "application/octet-stream"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} not allowed. Use PDF, JPG, PNG, or JSON.`);
  }

  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/ipfs/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText || "Upload failed");
  }
  const data = (await res.json()) as { cid: string };
  return data.cid;
}

/**
 * Upload JSON to IPFS via backend API.
 */
export async function uploadJSON(data: object): Promise<string> {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const file = new File([blob], "data.json", { type: "application/json" });
  return uploadToIPFS(file);
}

/**
 * URL for an IPFS hash, always through our API route.
 */
export function getIPFSUrl(hash: string): string {
  if (!hash) throw new Error("IPFS hash is required");
  return `/api/ipfs/fetch/${hash}`;
}

export async function fetchFromIPFS(hash: string): Promise<Blob> {
  const url = `/api/ipfs/fetch/${hash}`;
  const response = await fetch(url);
  if (!response.ok) {
    let details = response.statusText;
    try {
      const err = (await response.json()) as { error?: string };
      if (err?.error) details = err.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(`Failed to fetch from IPFS: ${details}`);
  }
  return response.blob();
}

export async function fetchJSONFromIPFS(hash: string): Promise<unknown> {
  const url = `/api/ipfs/fetch/${hash}`;
  const response = await fetch(url);
  if (!response.ok) {
    let details = response.statusText;
    try {
      const err = (await response.json()) as { error?: string };
      if (err?.error) details = err.error;
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(`Failed to fetch JSON from IPFS: ${details}`);
  }
  return response.json();
}

/** True when client can call the backend API route. */
export function isIPFSConfigured(): boolean {
  return true;
}
