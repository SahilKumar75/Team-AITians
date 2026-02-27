/**
 * Server-side Pinata adapter.
 * Keeps JWT server-only and supports upload/fetch behind /api/ipfs/* routes.
 */
import { Agent } from "undici";

const PINATA_JWT = process.env.PINATA_JWT || "";
const PRIMARY_PINATA_GATEWAY = (process.env.PINATA_GATEWAY || "").replace(/\/$/, "");
const PUBLIC_PINATA_GATEWAY = (process.env.NEXT_PUBLIC_PINATA_GATEWAY || "").replace(/\/$/, "");
const EXTRA_GATEWAYS = (process.env.IPFS_FALLBACK_GATEWAYS || "")
  .split(",")
  .map((g) => g.trim().replace(/\/$/, ""))
  .filter(Boolean);
const PINATA_ALLOW_INSECURE_TLS = process.env.PINATA_ALLOW_INSECURE_TLS === "true";
const PINATA_DISPATCHER = PINATA_ALLOW_INSECURE_TLS
  ? new Agent({ connect: { rejectUnauthorized: false } })
  : undefined;
const PINATA_CACHE_TTL_MS = Math.max(5_000, Number(process.env.PINATA_GATEWAY_CACHE_TTL_MS || 120_000));
const PINATA_CACHE_MAX = Math.max(50, Number(process.env.PINATA_GATEWAY_CACHE_MAX || 400));
const PINATA_RETRIES = Math.max(0, Number(process.env.PINATA_GATEWAY_RETRIES || 2));
const PINATA_RETRY_BASE_MS = Math.max(100, Number(process.env.PINATA_GATEWAY_RETRY_BASE_MS || 500));
const PINATA_FETCH_TIMEOUT_MS = Math.max(1500, Number(process.env.IPFS_FETCH_TIMEOUT_MS || 4500));
const IPFS_FETCH_TOTAL_TIMEOUT_MS = Math.max(3000, Number(process.env.IPFS_FETCH_TOTAL_TIMEOUT_MS || 9000));

type RequestInitWithDispatcher = RequestInit & { dispatcher?: Agent };
type BufferCacheEntry = { expiresAt: number; value: ArrayBuffer; touchedAt: number };
const cidBufferCache = new Map<string, BufferCacheEntry>();
const inflightByCid = new Map<string, Promise<ArrayBuffer>>();

function cloneArrayBuffer(buf: ArrayBuffer): ArrayBuffer {
  return buf.slice(0);
}

function getCacheEntry(cid: string): ArrayBuffer | null {
  const now = Date.now();
  const hit = cidBufferCache.get(cid);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    cidBufferCache.delete(cid);
    return null;
  }
  hit.touchedAt = now;
  return cloneArrayBuffer(hit.value);
}

function setCacheEntry(cid: string, value: ArrayBuffer): void {
  const now = Date.now();
  cidBufferCache.set(cid, {
    expiresAt: now + PINATA_CACHE_TTL_MS,
    touchedAt: now,
    value: cloneArrayBuffer(value),
  });
  if (cidBufferCache.size <= PINATA_CACHE_MAX) return;
  const entries = Array.from(cidBufferCache.entries()).sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  const removeCount = cidBufferCache.size - PINATA_CACHE_MAX;
  for (let i = 0; i < removeCount; i++) {
    cidBufferCache.delete(entries[i][0]);
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getGatewayCandidates(): string[] {
  const defaults = [
    "https://gateway.pinata.cloud",
    "https://ipfs.io",
    "https://cloudflare-ipfs.com",
    "https://dweb.link",
  ];
  const ordered = [
    PRIMARY_PINATA_GATEWAY,
    PUBLIC_PINATA_GATEWAY,
    ...defaults,
    ...EXTRA_GATEWAYS,
  ].filter(Boolean);
  return Array.from(new Set(ordered));
}

function shouldAttachPinataAuth(gateway: string): boolean {
  try {
    const host = new URL(gateway).hostname.toLowerCase();
    return host.includes("pinata.cloud") || host.endsWith("mypinata.cloud");
  } catch {
    return false;
  }
}

async function pinataFetch(input: string, init?: RequestInit, timeoutMs = PINATA_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...(init || {}),
      signal: controller.signal,
      dispatcher: PINATA_DISPATCHER,
    } as RequestInitWithDispatcher);
  } catch (error) {
    const err = error as {
      message?: string;
      cause?: { message?: string; code?: string };
      name?: string;
    };
    if (err?.name === "AbortError") {
      throw new Error(`Pinata request timed out after ${timeoutMs}ms`);
    }
    const code = err?.cause?.code ? ` (${err.cause.code})` : "";
    const causeMessage = err?.cause?.message ? `: ${err.cause.message}` : "";
    throw new Error(`Pinata request failed${code}${causeMessage || `: ${err?.message || "unknown error"}`}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function isPinataConfigured(): boolean {
  return !!PINATA_JWT;
}

export function isPinataGatewayConfigured(): boolean {
  return getGatewayCandidates().length > 0;
}

export async function pinFileToPinata(file: File): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT not set.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: file.name || "upload.bin",
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        fileType: file.type || "application/octet-stream",
        fileSize: String(file.size ?? 0),
      },
    })
  );

  const res = await pinataFetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { IpfsHash?: string };
  if (!data.IpfsHash) {
    throw new Error("Pinata response missing IpfsHash");
  }
  return data.IpfsHash;
}

export async function fetchFromPinataGateway(cid: string): Promise<ArrayBuffer> {
  const gateways = getGatewayCandidates();
  if (gateways.length === 0) {
    throw new Error("IPFS gateway not configured.");
  }
  const normalizedCid = (cid || "").trim();
  if (!normalizedCid) {
    throw new Error("CID is required.");
  }
  const cached = getCacheEntry(normalizedCid);
  if (cached) return cached;

  const inflight = inflightByCid.get(normalizedCid);
  if (inflight) {
    const shared = await inflight;
    return cloneArrayBuffer(shared);
  }

  const promise = (async () => {
    const gatewayErrors: string[] = [];
    const startedAt = Date.now();
    for (const gateway of gateways) {
      if (Date.now() - startedAt >= IPFS_FETCH_TOTAL_TIMEOUT_MS) {
        gatewayErrors.push("global-timeout");
        break;
      }
      const headers: HeadersInit =
        PINATA_JWT && shouldAttachPinataAuth(gateway)
          ? { Authorization: `Bearer ${PINATA_JWT}` }
          : {};

      let lastError = "";
      for (let attempt = 0; attempt <= PINATA_RETRIES; attempt++) {
        if (Date.now() - startedAt >= IPFS_FETCH_TOTAL_TIMEOUT_MS) {
          lastError = `timed out after ${IPFS_FETCH_TOTAL_TIMEOUT_MS}ms`;
          break;
        }
        try {
          const res = await pinataFetch(
            `${gateway}/ipfs/${encodeURIComponent(normalizedCid)}`,
            { headers },
            PINATA_FETCH_TIMEOUT_MS
          );
          if (res.ok) {
            const arr = await res.arrayBuffer();
            setCacheEntry(normalizedCid, arr);
            return arr;
          }

          const body = await res.text().catch(() => "");
          lastError = `${res.status}${body ? ` ${body.slice(0, 160)}` : ""}`;
          if (attempt >= PINATA_RETRIES || !shouldRetryStatus(res.status)) {
            break;
          }

          const retryAfter = Number(res.headers.get("retry-after") || "");
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : PINATA_RETRY_BASE_MS * Math.pow(2, attempt);
          await sleep(backoff);
        } catch (error) {
          lastError = error instanceof Error ? error.message : "request failed";
          if (attempt >= PINATA_RETRIES) break;
          await sleep(PINATA_RETRY_BASE_MS * Math.pow(2, attempt));
        }
      }
      gatewayErrors.push(`${gateway}: ${lastError || "fetch failed"}`);
    }
    throw new Error(`IPFS gateway fetch failed: ${gatewayErrors.join(" | ")}`);
  })();

  inflightByCid.set(normalizedCid, promise);
  try {
    const arr = await promise;
    return cloneArrayBuffer(arr);
  } finally {
    inflightByCid.delete(normalizedCid);
  }
}
