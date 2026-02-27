/**
 * WebAuthn helpers for Lock B fast login (same device).
 * Create credential after password login; get assertion before decrypting Lock B.
 */

function getRpId(): string {
  if (typeof window === "undefined") return "localhost";
  const host = window.location.hostname;
  return host === "127.0.0.1" ? "localhost" : host;
}

/** Create a WebAuthn credential for the identifier (call after password login). */
export async function createWebAuthnCredential(identifier: string): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return null;
  try {
    const userId = new TextEncoder().encode(identifier.slice(0, 64));
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({
      publicKey: {
        rp: { name: "Swasthya Sanchar", id: getRpId() },
        user: {
          id: userId,
          name: identifier,
          displayName: identifier,
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          userVerification: "required",
          residentKey: "preferred",
        },
        challenge,
        timeout: 60000,
      },
    });
    if (!cred || !("rawId" in cred)) return null;
    return (cred as PublicKeyCredential).rawId;
  } catch {
    return null;
  }
}

/** Get WebAuthn assertion (prove same device); returns true if user verified. */
export async function getWebAuthnAssertion(credentialId: ArrayBuffer): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const result = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: credentialId }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!result && "rawId" in result;
  } catch {
    return false;
  }
}
