const DEFAULT_PUBLIC_BACKEND_BASE_URL = "https://swathya-sanchar.vercel.app";

function normalizeOrigin(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isIpfsStaticHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.includes(".ipfs.") || host.includes(".4everland.app");
}

export function getPublicApiBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
    "";

  if (configured.trim()) {
    return normalizeOrigin(configured);
  }

  if (typeof window !== "undefined" && isIpfsStaticHost(window.location.hostname)) {
    return DEFAULT_PUBLIC_BACKEND_BASE_URL;
  }

  return "";
}

export function withPublicApiBase(path: string): string {
  if (!path.startsWith("/api/")) return path;
  const base = getPublicApiBaseUrl();
  return base ? `${base}${path}` : path;
}
