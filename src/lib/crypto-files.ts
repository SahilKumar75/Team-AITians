/**
 * Per-document envelope encryption (ARCHITECTURE.md).
 * Each file has a DEK; sharing = giving doctor encrypted DEK, not the file.
 */

const ALG = "AES-GCM";
const KEY_LEN = 256;
const IV_LEN = 12;
const TAG_LEN = 128;

/** Generate a random DEK (Data Encryption Key) for one file. */
export async function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALG, length: KEY_LEN },
    true,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt bytes with DEK (AES-256-GCM). Returns iv + ciphertext (tag appended). */
export async function encryptWithDEK(
  dek: CryptoKey,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALG, iv, tagLength: TAG_LEN },
    dek,
    plaintext as BufferSource
  );
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.length);
  return out;
}

/** Decrypt bytes with DEK. */
export async function decryptWithDEK(
  dek: CryptoKey,
  ivPlusCiphertext: Uint8Array
): Promise<Uint8Array> {
  if (ivPlusCiphertext.length < IV_LEN) {
    throw new Error("Payload too short");
  }
  const iv = ivPlusCiphertext.slice(0, IV_LEN);
  const ciphertext = ivPlusCiphertext.slice(IV_LEN);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: ALG, iv, tagLength: TAG_LEN },
      dek,
      ciphertext as BufferSource
    )
  );
}

/** Export DEK as raw key bytes (for encrypting with recipient public key). */
export async function exportDEKRaw(dek: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", dek);
}

/** Import DEK from raw key bytes. */
export async function importDEKFromRaw(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: ALG, length: KEY_LEN },
    true,
    ["encrypt", "decrypt"]
  );
}
