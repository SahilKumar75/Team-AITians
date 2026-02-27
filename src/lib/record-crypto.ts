/**
 * Record-level encryption utilities (MRC architecture).
 *
 * Each medical record gets a unique DEK (Data Encryption Key).
 * The file is encrypted with DEK (AES-256-GCM) before uploading to IPFS.
 * The DEK itself is stored encrypted per authorized user.
 */

const ALG = "AES-GCM";
const IV_LEN = 12;
const TAG_LEN = 128;
const KEY_LEN = 256;

// ─── DEK Lifecycle ───────────────────────────────────────────────────────────

/** Generate a random AES-256-GCM Data Encryption Key for a single record. */
export async function generateDEK(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: ALG, length: KEY_LEN },
        true, // extractable so we can export/wrap
        ["encrypt", "decrypt"]
    );
}

/** Export a DEK to raw bytes (for wrapping / encrypting per-user). */
export async function exportDEK(dek: CryptoKey): Promise<Uint8Array> {
    const raw = await crypto.subtle.exportKey("raw", dek);
    return new Uint8Array(raw);
}

/** Import raw bytes back into a CryptoKey. */
export async function importDEK(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        raw as BufferSource,
        { name: ALG, length: KEY_LEN },
        true,
        ["encrypt", "decrypt"]
    );
}

// ─── File Encryption ─────────────────────────────────────────────────────────

/** Encrypt a File with a DEK. Returns IV + ciphertext as a single blob. */
export async function encryptFile(file: File, dek: CryptoKey): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const plaintext = await file.arrayBuffer();

    const ciphertext = await crypto.subtle.encrypt(
        { name: ALG, iv: iv as BufferSource, tagLength: TAG_LEN },
        dek,
        plaintext
    );

    // Prepend IV (12 bytes) + ciphertext
    const result = new Uint8Array(IV_LEN + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), IV_LEN);
    return result;
}

/** Decrypt an encrypted blob (IV + ciphertext) back to a decoded Blob. */
export async function decryptFile(
    encrypted: Uint8Array,
    dek: CryptoKey,
    mimeType = "application/octet-stream"
): Promise<Blob> {
    const iv = encrypted.slice(0, IV_LEN);
    const ciphertext = encrypted.slice(IV_LEN);

    const plaintext = await crypto.subtle.decrypt(
        { name: ALG, iv: iv as BufferSource, tagLength: TAG_LEN },
        dek,
        ciphertext as BufferSource
    );

    return new Blob([plaintext], { type: mimeType });
}

// ─── DEK Wrapping (per-user) ─────────────────────────────────────────────────

/**
 * Wrap (encrypt) a DEK with a password-derived key for a specific user.
 * This allows each authorized user to decrypt the DEK with their password.
 * 
 * For the initial implementation, we use a simpler approach:
 * The DEK is encrypted with a key derived from the user's wallet address + a salt.
 */
export async function wrapDEKForUser(
    dek: CryptoKey,
    userWalletAddress: string
): Promise<{ iv: string; wrappedKey: string; salt: string }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const enc = new TextEncoder();

    // Derive a wrapping key from the wallet address
    const baseKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(userWalletAddress.toLowerCase()),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
        baseKey,
        KEY_LEN
    );
    const wrapKey = await crypto.subtle.importKey(
        "raw",
        bits,
        { name: ALG, length: KEY_LEN },
        false,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const dekRaw = await exportDEK(dek);
    const wrapped = await crypto.subtle.encrypt(
        { name: ALG, iv: iv as BufferSource, tagLength: TAG_LEN },
        wrapKey,
        dekRaw as BufferSource
    );

    const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...Array.from(u)));
    return {
        iv: toB64(iv),
        wrappedKey: toB64(new Uint8Array(wrapped)),
        salt: toB64(salt),
    };
}

/**
 * Unwrap (decrypt) a DEK that was wrapped for a specific user.
 */
export async function unwrapDEKForUser(
    wrapped: { iv: string; wrappedKey: string; salt: string },
    userWalletAddress: string
): Promise<CryptoKey> {
    const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
    const enc = new TextEncoder();

    const salt = fromB64(wrapped.salt);
    const iv = fromB64(wrapped.iv);
    const wrappedKey = fromB64(wrapped.wrappedKey);

    // Re-derive the wrapping key
    const baseKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(userWalletAddress.toLowerCase()),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
        baseKey,
        KEY_LEN
    );
    const wrapKey = await crypto.subtle.importKey(
        "raw",
        bits,
        { name: ALG, length: KEY_LEN },
        false,
        ["decrypt"]
    );

    const dekRaw = await crypto.subtle.decrypt(
        { name: ALG, iv: iv as BufferSource, tagLength: TAG_LEN },
        wrapKey,
        wrappedKey as BufferSource
    );

    return importDEK(new Uint8Array(dekRaw));
}
