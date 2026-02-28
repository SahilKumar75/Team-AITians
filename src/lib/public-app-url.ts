const DEFAULT_PUBLIC_BASE_URL = "https://team-aitians-74x8ajno-sahilkumar75.ipfs.4everland.app";

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isLocalOrigin(origin: string): boolean {
  return (
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("[::1]") ||
    origin.startsWith("http://localhost")
  );
}

export function getPublicBaseUrl(): string {
  // In browser, prefer the actual runtime origin (4EVERLAND deployment URL),
  // so generated NFC/QR links always match the currently served site.
  if (typeof window !== "undefined" && window.location?.origin) {
    const runtimeOrigin = normalizeBaseUrl(window.location.origin);
    if (runtimeOrigin && !isLocalOrigin(runtimeOrigin)) {
      return runtimeOrigin;
    }
  }

  const configured =
    process.env.NEXT_PUBLIC_EMERGENCY_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";

  if (configured.trim()) {
    return normalizeBaseUrl(configured);
  }

  return DEFAULT_PUBLIC_BASE_URL;
}

export function buildEmergencyUrl(id: string): string {
  return `${getPublicBaseUrl()}/emergency/${encodeURIComponent(id)}`;
}
