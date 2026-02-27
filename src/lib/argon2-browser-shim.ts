/**
 * Argon2id key derivation (browser only). Dynamic import to avoid Next.js bundling WASM on server.
 * Used by crypto-identity for Lock A when version >= 3.
 */

export type Argon2HashResult = { hash: Uint8Array };

async function loadArgon2(): Promise<{
  hash: (opts: {
    pass: string | Uint8Array;
    salt: Uint8Array;
    time?: number;
    mem?: number;
    hashLen?: number;
    parallelism?: number;
    type?: number;
  }) => Promise<Argon2HashResult>;
  ArgonType?: { Argon2id: number };
}> {
  if (typeof window === "undefined") throw new Error("Argon2 only in browser");
  const mod = await import("argon2-browser");
  return mod as unknown as Awaited<ReturnType<typeof loadArgon2>>;
}

/** Argon2id: time=2, mem=65536 KiB (64MB), hashLen=32. Returns 32-byte key. */
export async function argon2idDerive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const argon2 = await loadArgon2();
  const type = argon2.ArgonType?.Argon2id ?? 2;
  const result = await argon2.hash({
    pass: new TextEncoder().encode(password),
    salt,
    time: 2,
    mem: 65536,
    hashLen: 32,
    parallelism: 1,
    type,
  });
  return result.hash;
}
