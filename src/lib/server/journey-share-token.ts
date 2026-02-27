import crypto from "crypto";

function getSecret(): string {
  return process.env.JOURNEY_SHARE_SECRET || "dev-share-secret-change-me";
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function createJourneyShareToken(journeyId: string, ttlMinutes = 180): string {
  const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const payload = JSON.stringify({ j: journeyId, exp });
  const payloadB64 = base64url(payload);
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyJourneyShareToken(token: string, journeyId: string): boolean {
  if (!token || !token.includes(".")) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expected = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { j?: string; exp?: number };
    if (payload.j !== journeyId) return false;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

