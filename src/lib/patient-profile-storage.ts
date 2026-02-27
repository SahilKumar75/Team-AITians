import { KEYS } from "@/lib/client-data/storage-keys";

const legacyPatientProfileKey = (wallet: string) => `patient_profile_${wallet}`;

function normalizeWallet(wallet: string): string {
  return (wallet || "").toLowerCase();
}

export function readPatientProfileCache(wallet: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const w = normalizeWallet(wallet);
  if (!w) return null;

  try {
    const primary = localStorage.getItem(KEYS.patientProfile(w));
    if (primary) return JSON.parse(primary) as Record<string, unknown>;

    const legacy = localStorage.getItem(legacyPatientProfileKey(w));
    if (legacy) return JSON.parse(legacy) as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

export function writePatientProfileCache(wallet: string, profile: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = normalizeWallet(wallet);
  if (!w) return;

  const payload = JSON.stringify(profile);
  try {
    localStorage.setItem(KEYS.patientProfile(w), payload);
    // Keep legacy key for routes that still read old key names.
    localStorage.setItem(legacyPatientProfileKey(w), payload);
  } catch {
    // ignore
  }
}

export function seedDevBypassPatientProfile(wallet: string): Record<string, unknown> {
  const seeded = {
    ...(readPatientProfileCache(wallet) ?? {}),
    walletAddress: wallet,
  };
  writePatientProfileCache(wallet, seeded);
  return seeded;
}
