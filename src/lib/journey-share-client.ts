import { uploadToIPFS, fetchFromIPFS } from "@/lib/ipfs";

export interface FamilyJourneySharePayload {
  journeyId: string;
  hospitalName: string;
  tokenNumber: string;
  progressPercent: number;
  status: string;
  startedAt: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientRelation?: string;
  checkpoints: Array<{
    name: string;
    status: string;
    floor?: number;
    queuePosition?: number;
    estimatedWaitMinutes?: number;
    updatedAt?: string;
  }>;
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function encryptPayload(payload: FamilyJourneySharePayload): Promise<{ encrypted: Uint8Array; key: Uint8Array }> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return { encrypted: out, key: keyBytes };
}

async function decryptPayload(encrypted: Uint8Array, keyBytes: Uint8Array): Promise<FamilyJourneySharePayload> {
  const iv = new Uint8Array(12);
  iv.set(encrypted.slice(0, 12));
  const cipher = new Uint8Array(encrypted.length - 12);
  cipher.set(encrypted.slice(12));
  const keyRaw = new Uint8Array(keyBytes.length);
  keyRaw.set(keyBytes);
  const key = await crypto.subtle.importKey("raw", keyRaw.buffer, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher.buffer);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(plain))) as FamilyJourneySharePayload;
}

export async function createFamilyJourneyShareLink(
  payload: FamilyJourneySharePayload,
  origin: string,
  ttlMinutes = 180
): Promise<string> {
  const { encrypted, key } = await encryptPayload(payload);
  const encryptedCopy = new Uint8Array(encrypted.length);
  encryptedCopy.set(encrypted);
  const file = new File([encryptedCopy.buffer], `family-journey-${payload.journeyId}.bin`, {
    type: "application/octet-stream",
  });
  const cid = await uploadToIPFS(file);
  const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const k = toBase64Url(key);
  return `${origin}/journey/track/${payload.journeyId}?cid=${encodeURIComponent(cid)}&k=${encodeURIComponent(k)}&exp=${exp}`;
}

export async function readFamilyJourneySharePayload(
  cid: string,
  keyB64Url: string,
  exp?: number | null
): Promise<FamilyJourneySharePayload> {
  if (exp && Math.floor(Date.now() / 1000) > exp) {
    throw new Error("This shared link has expired.");
  }
  const blob = await fetchFromIPFS(cid);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const keyBytes = fromBase64Url(keyB64Url);
  return decryptPayload(bytes, keyBytes);
}
