/**
 * When true, the app uses client-only data (localStorage, chain, Helia) and does not call /api/*.
 * Set NEXT_PUBLIC_USE_CLIENT_DATA=true for static export / fully decentralised builds.
 */
export function useClientData(): boolean {
  if (typeof window === "undefined") return false;
  // Default to live API mode. Opt-in client-data only when explicitly enabled.
  return process.env.NEXT_PUBLIC_USE_CLIENT_DATA === "true";
}
