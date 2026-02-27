/**
 * Brotli compression (ARCHITECTURE.md) — 40–60% smaller IPFS payloads.
 * Uses brotli-wasm; works in browser and Node (Next API routes).
 */

type BrotliModule = {
  compress: (buf: Uint8Array, options?: { quality?: number }) => Uint8Array;
  decompress: (buf: Uint8Array) => Uint8Array;
};

let _brotli: BrotliModule | null = null;

async function getBrotli(): Promise<BrotliModule> {
  if (_brotli) return _brotli;
  const mod = await import("brotli-wasm");
  const raw = (mod as { default?: BrotliModule | Promise<BrotliModule> }).default ?? mod;
  _brotli = (await Promise.resolve(raw)) as BrotliModule;
  return _brotli;
}

/** Compress bytes with Brotli. Quality 6 is a good default (1–11). */
export async function compress(
  data: Uint8Array,
  options?: { quality?: number }
): Promise<Uint8Array> {
  const brotli = await getBrotli();
  return brotli.compress(data, options ?? { quality: 6 });
}

/** Decompress Brotli bytes. */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const brotli = await getBrotli();
  return brotli.decompress(data);
}
