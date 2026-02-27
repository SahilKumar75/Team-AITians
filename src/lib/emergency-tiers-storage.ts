const TIER_STORAGE_PREFIX = "swasthya_emergency_tiers_";

export function loadTiers(key: string): { tier1: boolean; tier2: boolean } {
  if (typeof window === "undefined") return { tier1: false, tier2: false };
  try {
    const raw = localStorage.getItem(TIER_STORAGE_PREFIX + key);
    if (!raw) return { tier1: false, tier2: false };
    const o = JSON.parse(raw);
    return { tier1: !!o.tier1, tier2: !!o.tier2 };
  } catch {
    return { tier1: false, tier2: false };
  }
}

export function saveTiers(key: string, tier1: boolean, tier2: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIER_STORAGE_PREFIX + key, JSON.stringify({ tier1, tier2 }));
  } catch {
    /* ignore */
  }
}
