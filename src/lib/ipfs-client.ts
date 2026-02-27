
// Client-side IPFS wrapper:
// - Uploads encrypted blobs to our own API (pins on server)
// - Fetches blobs from our own API (faster/reliable) or public gateway (fallback)

const API_BASE = '/api/ipfs';
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs/';

/**
 * Uploads a JSON object or File to IPFS via our server API.
 * Returns the CID string.
 */
export async function uploadToIpfs(data: object | File): Promise<string> {
    const formData = new FormData();

    if (data instanceof File) {
        formData.append('file', data);
    } else {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        formData.append('file', blob);
    }

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        throw new Error(`IPFS Upload Failed: ${res.statusText}`);
    }

    const { cid } = await res.json();
    return cid;
}

/**
 * Fetches JSON data from IPFS by CID.
 * Tries our API first (fast), falls back to public gateway.
 */
export async function fetchJsonFromIpfs<T>(cid: string): Promise<T> {
    try {
        // Try our API first (cached/local)
        const res = await fetch(`${API_BASE}/fetch/${cid}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn(`Local IPFS fetch failed for ${cid}, trying gateway...`, e);
    }

    // Fallback to public gateway
    const gatewayRes = await fetch(`${PUBLIC_GATEWAY}${cid}`);
    if (!gatewayRes.ok) {
        throw new Error(`IPFS Fetch Failed: ${gatewayRes.statusText}`);
    }
    return await gatewayRes.json();
}
