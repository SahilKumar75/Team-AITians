/**
 * Client-side IPFS via Helia (ARCHITECTURE.md, DATA_STORAGE_AND_JOURNEY.md).
 * Helia runs in the browser only; no server that pins. Encrypted blobs (files, etc.)
 * are published and fetched from the client. No Pinata; no backend pinning.
 */

import type { CID } from "multiformats/cid";

const DB_NAME_BLOCKSTORE = "swathya-helia-blocks";
const DB_NAME_DATASTORE = "swathya-helia-data";

type HeliaNode = Awaited<ReturnType<typeof createHelia>>;
type UnixFS = Awaited<ReturnType<typeof getUnixFS>>;

let heliaPromise: Promise<{ helia: HeliaNode; fs: UnixFS } | null> | null = null;

async function createHelia() {
  const [{ createHelia: create }, { IDBBlockstore }, { IDBDatastore }] =
    await Promise.all([
      import("helia"),
      import("blockstore-idb"),
      import("datastore-idb"),
    ]);
  const blockstore = new IDBBlockstore(DB_NAME_BLOCKSTORE);
  const datastore = new IDBDatastore(DB_NAME_DATASTORE);
  await blockstore.open();
  await datastore.open();
  // Type assertion: IDB* stores are compatible at runtime; duplicate interface versions in deps cause TS errors.
  return create({
    blockstore: blockstore as unknown as Parameters<typeof create>[0]["blockstore"],
    datastore: datastore as unknown as Parameters<typeof create>[0]["datastore"],
  });
}

async function getUnixFS(helia: HeliaNode) {
  const { unixfs } = await import("@helia/unixfs");
  return unixfs(helia);
}

/**
 * Get the singleton Helia node and UnixFS. Browser only; returns null on server.
 */
export async function getHelia(): Promise<{
  helia: HeliaNode;
  fs: UnixFS;
} | null> {
  if (typeof window === "undefined") return null;
  if (heliaPromise == null) {
    heliaPromise = (async () => {
      try {
        const helia = await createHelia();
        const fs = await getUnixFS(helia);
        return { helia, fs };
      } catch (e) {
        console.error("Helia init failed:", e);
        heliaPromise = null;
        return null;
      }
    })();
  }
  return heliaPromise;
}

/**
 * Add a file to IPFS via API (browser). Returns the CID string.
 */
export async function addFileToHelia(
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/ipfs/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload to IPFS API");
  }

  const { cid } = await res.json();
  return cid;
}

/**
 * Add raw bytes (e.g. encrypted blob) to IPFS via API. Returns the CID string.
 */
export async function addBytesToHelia(
  bytes: Uint8Array,
  filename = "blob"
): Promise<string> {
  const file = new File([new Blob([bytes as any])], filename, { type: "application/octet-stream" });
  return addFileToHelia(file);
}

/**
 * Fetch content by CID from IPFS via API. Returns the raw bytes.
 */
export async function getFileFromHelia(cidStr: string): Promise<Uint8Array> {
  const res = await fetch(`/api/ipfs/fetch?cid=${encodeURIComponent(cidStr)}`);
  if (!res.ok) throw new Error("Failed to fetch from IPFS API");
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Whether Helia can run (browser environment).
 */
export function isHeliaAvailable(): boolean {
  return typeof window !== "undefined";
}
