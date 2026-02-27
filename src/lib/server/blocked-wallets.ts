const BLOCKED_WALLET_VALUES = [
  "0xd7751ac333e8ea10f161249d306de18f795d1689",
  "0x001cf6c0b41f523018b61a7738931adde0f5accb",
  "0xfe7af03b297c9ddcfc7374bfac2f76b21093689a",
  "0xf93ecaae5a00e694ecc1ee9e94a0bdd0471e4c7f",
  "0x2cc00e63292849ed72540420623370f4db9e6ef5",
] as const;

export const BLOCKED_WALLETS = new Set(BLOCKED_WALLET_VALUES.map((value) => value.toLowerCase()));

export function normalizeWalletAddress(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isBlockedWallet(value: unknown): boolean {
  const normalized = normalizeWalletAddress(value);
  return !!normalized && BLOCKED_WALLETS.has(normalized);
}

export function isBlockedHospitalId(value: unknown): boolean {
  const normalized = normalizeWalletAddress(value);
  return !!normalized && BLOCKED_WALLETS.has(normalized);
}

export function filterBlockedByWallet<T>(
  rows: T[],
  getWallet: (row: T) => unknown
): T[] {
  return rows.filter((row) => !isBlockedWallet(getWallet(row)));
}
