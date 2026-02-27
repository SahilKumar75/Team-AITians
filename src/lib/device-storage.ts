/**
 * Device storage for Lock B (ARCHITECTURE.md).
 * IndexedDB: device key + Lock B entries. WebAuthn used for fast login.
 */

import { openDB } from "idb";

const DB_NAME = "swasthya-device";
const DB_VERSION = 2;
const STORE_LOCK_B = "lockB";
const STORE_DEVICE_KEY = "deviceKey";
const STORE_WEBAUTHN = "webauthn";
const DEVICE_KEY_ID = "default";

function base64UrlToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_LOCK_B)) {
        db.createObjectStore(STORE_LOCK_B, { keyPath: "identifierKey" });
      }
      if (!db.objectStoreNames.contains(STORE_DEVICE_KEY)) {
        db.createObjectStore(STORE_DEVICE_KEY, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_WEBAUTHN)) {
        db.createObjectStore(STORE_WEBAUTHN, { keyPath: "identifierKey" });
      }
    },
  });
}

export async function getDeviceKey(): Promise<CryptoKey | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await getDB();
    const row = await db.get(STORE_DEVICE_KEY, DEVICE_KEY_ID);
    if (!row?.jwk) return null;
    return crypto.subtle.importKey(
      "jwk",
      row.jwk as JsonWebKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

export async function createAndStoreDeviceKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  if (typeof window !== "undefined") {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    const db = await getDB();
    await db.put(STORE_DEVICE_KEY, { id: DEVICE_KEY_ID, jwk });
  }
  return key;
}

/** Store Lock B for identifier (encrypted priv key with device key). identifierKey = normalized identifier hash. */
export async function storeLockB(
  identifierKey: string,
  encryptedPayload: ArrayBuffer
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await getDB();
  await db.put(STORE_LOCK_B, {
    identifierKey,
    payload: encryptedPayload,
    updatedAt: Date.now(),
  });
}

/** Retrieve Lock B encrypted payload for identifier. */
export async function getLockB(identifierKey: string): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await getDB();
    const row = await db.get(STORE_LOCK_B, identifierKey);
    return row?.payload ?? null;
  } catch {
    return null;
  }
}

const IV_LEN = 12;
const TAG_LEN = 128;

/** Encrypt plaintext with device key (AES-GCM). */
export async function encryptWithDeviceKey(plaintext: ArrayBuffer | string): Promise<ArrayBuffer> {
  const key = await getDeviceKey();
  if (!key) throw new Error("No device key. Use createAndStoreDeviceKey first.");
  const data = typeof plaintext === "string" ? new TextEncoder().encode(plaintext) : plaintext;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LEN },
    key,
    data
  );
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return out.buffer;
}

/** Decrypt Lock B payload with device key. */
export async function decryptWithDeviceKey(ivAndCipher: ArrayBuffer): Promise<string> {
  const key = await getDeviceKey();
  if (!key) throw new Error("No device key.");
  const arr = new Uint8Array(ivAndCipher);
  const iv = arr.slice(0, IV_LEN);
  const cipher = arr.slice(IV_LEN);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LEN },
    key,
    cipher as BufferSource
  );
  return new TextDecoder().decode(dec);
}

/** Store WebAuthn credential ID for identifier (for Lock B fast login). */
export async function storeWebAuthnCredentialId(
  identifierKey: string,
  credentialId: ArrayBuffer
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await getDB();
  await db.put(STORE_WEBAUTHN, {
    identifierKey,
    credentialIdB64: bufferToBase64Url(credentialId),
    updatedAt: Date.now(),
  });
}

/** Get WebAuthn credential ID for identifier, or null. */
export async function getWebAuthnCredentialId(
  identifierKey: string
): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await getDB();
    const row = await db.get(STORE_WEBAUTHN, identifierKey);
    if (!row?.credentialIdB64) return null;
    return base64UrlToBuffer(row.credentialIdB64);
  } catch {
    return null;
  }
}
