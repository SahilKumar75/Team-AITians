const DEFAULT_PUBLIC_BASE_URL = "https://team-aitians-74x8ajno-sahilkumar75.ipfs.4everland.app";

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getPublicBaseUrl(): string {
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
