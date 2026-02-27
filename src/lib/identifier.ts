/**
 * Identifier = email OR phone (ARCHITECTURE.md).
 * Single field for login/register; normalized for storage and on-chain hash.
 */

/** Normalize for consistent hashing and storage. Email: lowercase trim. Phone: digits only (E.164-style). */
export function normalizeIdentifier(input: string): string {
  const s = input.trim();
  if (s.includes("@")) {
    return s.toLowerCase();
  }
  return s.replace(/\D/g, "") || s;
}

export function isEmail(s: string): boolean {
  return s.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function isPhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/** Validate identifier is either a valid email or a valid phone. */
export function isValidIdentifier(s: string): boolean {
  const t = s.trim();
  return isEmail(t) || isPhone(t);
}

/** Emergency contact: must be a phone number (digits, 10–15). */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(-15);
}

export function isValidPhone(s: string): boolean {
  const n = normalizePhone(s);
  return n.length >= 10 && n.length <= 15;
}
