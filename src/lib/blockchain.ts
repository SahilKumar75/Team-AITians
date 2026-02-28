import { ethers, Signer } from 'ethers';
import { normalizeIdentifier } from './identifier';
import { isBlockedWallet } from './server/blocked-wallets';
import {
    getEncDekCidForRecordGranteeFromSubgraph,
    hasSubgraphDirectory,
    listAccessGrantsForPatientFromSubgraph,
    listGrantedPatientWalletsForDoctorFromSubgraph,
    listRecordsUploadedByDoctorFromSubgraph,
} from './subgraph-directory';

// ─── Environment ─────────────────────────────────────────────────────────────
const RPC_URL = process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || '80002');
const IDENTITY_REGISTRY = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || '';
const HEALTH_REGISTRY = process.env.NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS || '';
const LOGS_CHUNK_SIZE = Number(
    process.env.NEXT_PUBLIC_RPC_LOGS_CHUNK_SIZE || process.env.RPC_LOGS_CHUNK_SIZE || 0
);
const LOGS_LOOKBACK_BLOCKS = Math.max(
    100,
    Number(process.env.NEXT_PUBLIC_RPC_LOGS_LOOKBACK_BLOCKS || process.env.RPC_LOGS_LOOKBACK_BLOCKS || 300000)
);
const ACCESS_EVENTS_LOOKBACK_BLOCKS = Math.max(
    LOGS_LOOKBACK_BLOCKS,
    Number(
        process.env.NEXT_PUBLIC_ACCESS_EVENTS_LOOKBACK_BLOCKS ||
        process.env.ACCESS_EVENTS_LOOKBACK_BLOCKS ||
        120000
    )
);
const ACCESS_EVENTS_CHUNK_SIZE = Math.max(
    100,
    Number(
        process.env.NEXT_PUBLIC_ACCESS_EVENTS_CHUNK_SIZE ||
        process.env.ACCESS_EVENTS_CHUNK_SIZE ||
        2000
    )
);
const RECENT_UPLOAD_RECONCILE_BLOCKS = Math.max(
    100,
    Number(
        process.env.NEXT_PUBLIC_RECENT_UPLOAD_RECONCILE_BLOCKS ||
        process.env.RECENT_UPLOAD_RECONCILE_BLOCKS ||
        5000
    )
);
const HEALTH_REGISTRY_START_BLOCK = Number(
    process.env.NEXT_PUBLIC_HEALTH_REGISTRY_START_BLOCK || process.env.HEALTH_REGISTRY_START_BLOCK || -1
);
const IDENTITY_CACHE_TTL_MS = Math.max(3000, Number(process.env.IDENTITY_CACHE_TTL_MS || 30000));
const ACCESS_CACHE_TTL_MS = Math.max(3000, Number(process.env.ACCESS_CACHE_TTL_MS || 15000));

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const isValidAddress = (value: string | null | undefined): value is string =>
    typeof value === "string" && ethers.isAddress(value);
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[1-9A-HJ-NP-Za-km-z]{20,})$/;

/** Architecture guardrail: on-chain string pointers must be CIDs (or empty when optional). */
export function isLikelyCid(value: string | null | undefined): boolean {
    return typeof value === "string" && CID_RE.test(value.trim());
}

/** True when HealthRegistry contract is set and not the zero address (so on-chain upload will work). */
export function isHealthRegistryConfigured(): boolean {
    const addr = process.env.NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS || HEALTH_REGISTRY || '';
    return !!addr && addr.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
}

// ─── Minimal ABIs (Manual - No compilation required) ─────────────────────────

const IDENTITY_ABI = [
    "function register(bytes32 idHash, string lockA, string lockC, bytes32 recHash, string emerCid, bytes32 role, bytes32 licHash) external",
    "function getIdentity(bytes32 idHash) external view returns (tuple(string lockACid, string lockCCid, bytes32 recoveryKeyHash, string emergencyCid, address wallet, bytes32 role, bytes32 licenseHash, bool exists, string title))",
    "function walletToIdentifier(address wallet) external view returns (bytes32)",
    "function updateLockA(bytes32 idHash, string newLockA) external",
    "function setTitle(bytes32 idHash, string title) external",
    "function addGuardian(address guardian) external",
    "function removeGuardian(address guardian) external",
    "function getGuardians(address patient) external view returns (address[])",
    "event IdentityRegistered(bytes32 indexed identifierHash, address indexed wallet, bytes32 role)"
];

const HEALTH_ABI = [
    "function verifier() external view returns (address)",
    "function registerPatient() external",
    "function registerDoctor() external",
    "function registerHospital() external",
    "function addRecord(address patient, string fileCid, bytes32 fileType) external returns (bytes32)",
    "function grantAccess(bytes32 recordId, address grantee, string encDekIpfsCid, string newManifestCid) external",
    "function doctorGrantAccess(bytes32 recordId, address patient, address grantee, string encDekIpfsCid, string newManifestCid) external",
    "function revokeAccess(bytes32 recordId, address grantee, string newManifestCid) external",
    "function accessManifestCid(address patient) external view returns (string)",
    "function getPatientRecords(address patient) external view returns (bytes32[])",
    "function getRecord(bytes32 recordId) external view returns (tuple(string fileCid, address patient, address uploader, bytes32 fileType, uint256 timestamp, bool active))",
    "event RecordAdded(bytes32 indexed recordId, address indexed patient, address indexed uploader, string fileCid)",
    "event AccessGranted(bytes32 indexed recordId, address indexed grantee, string encDekIpfsCid)",
    "event AccessRevoked(bytes32 indexed recordId, address indexed grantee)",
    "event AccessManifestUpdated(address indexed patient, string newManifestCid)"
];

const VERIFIER_ABI = [
    "function isVerified(address entity) external view returns (bool)",
];

const identityByIdentifierCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof fetchIdentity>> }>();
const identityByIdentifierInflight = new Map<string, Promise<Awaited<ReturnType<typeof fetchIdentity>>>>();
const identityByWalletCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof fetchIdentityByWallet>> }>();
const identityByWalletInflight = new Map<string, Promise<Awaited<ReturnType<typeof fetchIdentityByWallet>>>>();
const patientRecordIdsCache = new Map<string, { expiresAt: number; value: string[] }>();
const patientAccessCache = new Map<string, { expiresAt: number; value: { doctorAddress: string; recordId: string; encDekIpfsCid: string }[] }>();
const doctorGrantedPatientsCache = new Map<string, { expiresAt: number; value: { patient: string; recordId: string; timestamp?: number }[] }>();
const clinicianVerifiedCache = new Map<string, { expiresAt: number; value: boolean }>();
const CLINICIAN_VERIFIED_TTL_MS = Math.max(5000, Number(process.env.CLINICIAN_VERIFIED_TTL_MS || 60000));
const RPC_QUERY_RETRIES = Math.max(0, Number(process.env.RPC_QUERY_RETRIES || 2));
const RPC_RETRY_BASE_DELAY_MS = Math.max(100, Number(process.env.RPC_RETRY_BASE_DELAY_MS || 300));

// ─── Blockchain Interaction ──────────────────────────────────────────────────

export const getProvider = () => new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);

export const getIdentityContract = (signerOrProvider?: ethers.Signer | ethers.Provider) => {
    return new ethers.Contract(
        IDENTITY_REGISTRY,
        IDENTITY_ABI,
        signerOrProvider || getProvider()
    );
};

export const getHealthContract = (signerOrProvider?: ethers.Signer | ethers.Provider) => {
    return new ethers.Contract(
        HEALTH_REGISTRY,
        HEALTH_ABI,
        signerOrProvider || getProvider()
    );
};

function isTimeoutLikeError(error: unknown): boolean {
    if (!error) return false;
    const e = error as { code?: number | string; message?: string; error?: { code?: number | string; message?: string } };
    const code = e?.error?.code ?? e?.code;
    const msg = `${e?.error?.message || ''} ${e?.message || ''}`.toLowerCase();
    return (
        code === -32002 ||
        code === "TIMEOUT" ||
        msg.includes("timed out") ||
        msg.includes("timeout") ||
        msg.includes("etimedout") ||
        msg.includes("504")
    );
}

function isNetworkLikeError(error: unknown): boolean {
    if (!error) return false;
    const e = error as { code?: number | string; message?: string; error?: { code?: number | string; message?: string } };
    const codeRaw = e?.error?.code ?? e?.code;
    const code = typeof codeRaw === "string" ? codeRaw.toUpperCase() : codeRaw;
    const msg = `${e?.error?.message || ''} ${e?.message || ''}`.toLowerCase();
    return (
        code === "EHOSTUNREACH" ||
        code === "ENETUNREACH" ||
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND" ||
        msg.includes("socket hang up") ||
        msg.includes("network error") ||
        msg.includes("failed to fetch")
    );
}

function isRetryableRpcError(error: unknown): boolean {
    return isTimeoutLikeError(error) || isNetworkLikeError(error);
}

function rpcErrorCode(error: unknown): string {
    const e = error as { code?: number | string; error?: { code?: number | string } };
    const code = e?.error?.code ?? e?.code;
    if (typeof code === "string" || typeof code === "number") return String(code);
    return "unknown";
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseInsufficientFundsMessage(raw: string): string {
    const lowered = raw.toLowerCase();
    if (!lowered.includes("insufficient funds")) return "";

    // Ethers often returns: balance X, tx cost Y, overshot Z
    const balanceMatch = raw.match(/balance\s+(\d+)/i);
    const costMatch = raw.match(/tx cost\s+(\d+)/i);
    const overshotMatch = raw.match(/overshot\s+(\d+)/i);
    try {
        const balance = balanceMatch ? ethers.formatEther(BigInt(balanceMatch[1])) : null;
        const cost = costMatch ? ethers.formatEther(BigInt(costMatch[1])) : null;
        const shortfall = overshotMatch ? ethers.formatEther(BigInt(overshotMatch[1])) : null;
        if (balance && cost) {
            return `Insufficient POL for gas. Balance ${balance} POL, required about ${cost} POL${shortfall ? ` (short by ${shortfall} POL)` : ""}.`;
        }
    } catch {
        // fallback below
    }
    return "Insufficient POL for gas in the signer wallet.";
}

function getDefaultLogsChunkSize(): number {
    if (Number.isFinite(LOGS_CHUNK_SIZE) && LOGS_CHUNK_SIZE > 0) {
        return Math.floor(LOGS_CHUNK_SIZE);
    }
    if ((RPC_URL || "").toLowerCase().includes("alchemy.com")) {
        // Alchemy free-tier enforces very small eth_getLogs ranges.
        return 10;
    }
    return 2000;
}

function isEthGetLogsRangeLimitError(error: unknown): boolean {
    const e = error as { message?: string; error?: { message?: string } } | null;
    const raw = `${e?.message || ""} ${e?.error?.message || ""}`.toLowerCase();
    return raw.includes("eth_getlogs") && raw.includes("block range");
}

async function queryFilterRangeAdaptive(
    contract: ethers.Contract,
    filter: ReturnType<ethers.Contract["filters"][keyof ethers.Contract["filters"]]>,
    fromBlock: number,
    toBlock: number,
    attempt = 0
): Promise<ethers.EventLog[]> {
    try {
        return (await contract.queryFilter(filter, fromBlock, toBlock)) as ethers.EventLog[];
    } catch (error) {
        if (isRetryableRpcError(error) && attempt < RPC_QUERY_RETRIES) {
            await sleep(RPC_RETRY_BASE_DELAY_MS * (attempt + 1));
            return queryFilterRangeAdaptive(contract, filter, fromBlock, toBlock, attempt + 1);
        }
        const span = toBlock - fromBlock;
        if (!isTimeoutLikeError(error) || span <= 1500) throw error;
        const mid = Math.floor((fromBlock + toBlock) / 2);
        const left = await queryFilterRangeAdaptive(contract, filter, fromBlock, mid, 0);
        const right = await queryFilterRangeAdaptive(contract, filter, mid + 1, toBlock, 0);
        return [...left, ...right];
    }
}

async function queryFilterChunked(
    contract: ethers.Contract,
    filter: ReturnType<ethers.Contract["filters"][keyof ethers.Contract["filters"]]>,
    opts?: { fromBlock?: number; toBlock?: number; chunkSize?: number }
): Promise<ethers.EventLog[]> {
    const provider = (contract.runner as { provider?: ethers.Provider } | null)?.provider;
    if (!provider) {
        return (await contract.queryFilter(filter)) as ethers.EventLog[];
    }

    const latest = opts?.toBlock ?? (await provider.getBlockNumber());
    // If fromBlock is explicitly provided, honor it as-is.
    // Otherwise, default to a bounded recent lookback window.
    let configuredStart = opts?.fromBlock;
    if (configuredStart === undefined) {
        configuredStart = Math.max(0, latest - LOGS_LOOKBACK_BLOCKS);
        // Allow HEALTH_REGISTRY_START_BLOCK to override if it's more recent.
        if (Number.isFinite(HEALTH_REGISTRY_START_BLOCK) && HEALTH_REGISTRY_START_BLOCK > configuredStart) {
            configuredStart = HEALTH_REGISTRY_START_BLOCK;
        }
    }

    const from = Math.max(0, configuredStart);
    if (from > latest) return [];

    const configuredChunk = opts?.chunkSize ?? getDefaultLogsChunkSize();
    const chunk = Math.max(1, Number.isFinite(configuredChunk) ? Math.floor(configuredChunk) : 1);
    const out: ethers.EventLog[] = [];
    for (let start = from; start <= latest; start += chunk) {
        const end = Math.min(latest, start + chunk - 1);
        let part: ethers.EventLog[] = [];
        try {
            part = await queryFilterRangeAdaptive(contract, filter, start, end);
        } catch (error) {
            console.warn(
                `[queryFilterChunked] Chunk ${start}-${end} failed (code=${rpcErrorCode(error)}).`
            );
            if (isEthGetLogsRangeLimitError(error) && chunk > 10) {
                console.warn(`[queryFilterChunked] Falling back to smaller chunks...`);
                part = await queryFilterChunked(contract, filter, {
                    fromBlock: start,
                    toBlock: end,
                    chunkSize: 10,
                });
            } else {
                throw error;
            }
        }
        out.push(...part);
    }
    return out;
}

function getAccessEventsFromBlock(latestBlock: number): number {
    const lookbackStart = Math.max(0, latestBlock - ACCESS_EVENTS_LOOKBACK_BLOCKS);
    if (!Number.isFinite(HEALTH_REGISTRY_START_BLOCK) || HEALTH_REGISTRY_START_BLOCK < 0) {
        return lookbackStart;
    }
    return Math.max(lookbackStart, Math.floor(HEALTH_REGISTRY_START_BLOCK));
}

function normalizeRecordFileType(raw: unknown): string {
    const fileType = typeof raw === "string" ? raw.trim() : "";
    if (!fileType) return "";
    if (/^0x[0-9a-fA-F]{64}$/.test(fileType)) {
        try {
            const decoded = ethers.decodeBytes32String(fileType).trim();
            return decoded || fileType;
        } catch {
            return fileType;
        }
    }
    return fileType;
}

/**
 * Checks if a user (email OR phone) is already registered on-chain.
 * Returns the Identity struct if found, or null.
 * Identifier is normalized (email lowercase, phone digits only) before hashing.
 */
export async function fetchIdentity(identifier: string) {
    const norm = normalizeIdentifier(identifier);
    if (!norm) return null;
    const cacheKey = norm.toLowerCase();
    const now = Date.now();
    const cached = identityByIdentifierCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value;
    const inflight = identityByIdentifierInflight.get(cacheKey);
    if (inflight) return inflight;

    const task = (async () => {
        const contract = getIdentityContract();
        const idHash = ethers.keccak256(ethers.toUtf8Bytes(norm));
        try {
            const identity = await contract.getIdentity(idHash);
            if (!identity.exists) {
                identityByIdentifierCache.set(cacheKey, { expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS, value: null });
                return null;
            }

            const value = {
                identifierHash: idHash,
                lockACid: identity.lockACid,
                lockCCid: identity.lockCCid,
                recoveryKeyHash: identity.recoveryKeyHash,
                emergencyCid: identity.emergencyCid,
                walletAddress: identity.wallet,
                role: ethers.decodeBytes32String(identity.role), // e.g. "patient"
                licenseHash: identity.licenseHash,
                title: identity.title ?? "", // e.g. "Surgeon", "Nurse" (optional)
            };
            identityByIdentifierCache.set(cacheKey, { expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS, value });
            return value;
        } catch (e) {
            console.error("Failed to fetch identity:", e);
            return null;
        }
    })();

    identityByIdentifierInflight.set(cacheKey, task);
    try {
        return await task;
    } finally {
        identityByIdentifierInflight.delete(cacheKey);
    }
}

/** Fetch identity by wallet address using IdentityRegistry.walletToIdentifier mapping. */
export async function fetchIdentityByWallet(walletAddress: string) {
    if (!IDENTITY_REGISTRY || !isValidAddress(walletAddress)) return null;
    const normalized = walletAddress.toLowerCase();
    const now = Date.now();
    const cached = identityByWalletCache.get(normalized);
    if (cached && cached.expiresAt > now) return cached.value;
    const inflight = identityByWalletInflight.get(normalized);
    if (inflight) return inflight;

    const task = (async () => {
        try {
            const contract = getIdentityContract();
            const idHash = await contract.walletToIdentifier(walletAddress);
            if (!idHash || idHash === ethers.ZeroHash) {
                identityByWalletCache.set(normalized, { expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS, value: null });
                return null;
            }
            const identity = await contract.getIdentity(idHash);
            if (!identity?.exists) {
                identityByWalletCache.set(normalized, { expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS, value: null });
                return null;
            }
            const value = {
                identifierHash: idHash,
                lockACid: identity.lockACid,
                lockCCid: identity.lockCCid,
                recoveryKeyHash: identity.recoveryKeyHash,
                emergencyCid: identity.emergencyCid,
                walletAddress: identity.wallet,
                role: ethers.decodeBytes32String(identity.role),
                licenseHash: identity.licenseHash,
                title: identity.title ?? "",
            };
            identityByWalletCache.set(normalized, { expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS, value });
            return value;
        } catch (e) {
            console.error("Failed to fetch identity by wallet:", e);
            return null;
        }
    })();

    identityByWalletInflight.set(normalized, task);
    try {
        return await task;
    } finally {
        identityByWalletInflight.delete(normalized);
    }
}

export async function getGuardiansOnChain(patientAddress: string): Promise<string[]> {
    if (!IDENTITY_REGISTRY || !isValidAddress(patientAddress)) return [];
    try {
        const contract = getIdentityContract();
        const guardians = await contract.getGuardians(patientAddress);
        return Array.isArray(guardians) ? guardians.map((g) => String(g).toLowerCase()) : [];
    } catch (e) {
        console.error("Failed to fetch guardians:", e);
        return [];
    }
}

export async function addGuardianOnChain(
    signer: Signer,
    guardianAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!IDENTITY_REGISTRY) return { success: false, error: "IdentityRegistry contract not configured." };
    if (!isValidAddress(guardianAddress)) return { success: false, error: "Invalid guardian wallet address." };
    try {
        const contract = getIdentityContract(signer);
        const tx = await contract.addGuardian(guardianAddress);
        const receipt = await tx.wait();
        return { success: true, txHash: receipt.hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("addGuardianOnChain error:", e);
        return { success: false, error: msg };
    }
}

export async function removeGuardianOnChain(
    signer: Signer,
    guardianAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!IDENTITY_REGISTRY) return { success: false, error: "IdentityRegistry contract not configured." };
    if (!isValidAddress(guardianAddress)) return { success: false, error: "Invalid guardian wallet address." };
    try {
        const contract = getIdentityContract(signer);
        const tx = await contract.removeGuardian(guardianAddress);
        const receipt = await tx.wait();
        return { success: true, txHash: receipt.hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("removeGuardianOnChain error:", e);
        return { success: false, error: msg };
    }
}

/** Get record IDs for a patient from HealthRegistry (read-only). */
export async function getPatientRecordIds(
    patientAddress: string,
    opts?: { forceRefresh?: boolean }
): Promise<string[]> {
    if (!HEALTH_REGISTRY || !isValidAddress(patientAddress)) return [];
    const key = patientAddress.toLowerCase();
    const forceRefresh = opts?.forceRefresh === true;
    const now = Date.now();
    const cached = forceRefresh ? null : patientRecordIdsCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;
    try {
        const contract = getHealthContract();
        const ids = await contract.getPatientRecords(patientAddress);
        const value = Array.isArray(ids) ? ids.filter(Boolean) : [];
        patientRecordIdsCache.set(key, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, value });
        return value;
    } catch (e) {
        console.error("Failed to get patient records:", e);
        return [];
    }
}

/** Get a single record's metadata from HealthRegistry (read-only). */
export async function getRecordMetadata(recordId: string): Promise<{
    fileCid: string;
    patient: string;
    uploader: string;
    fileType: string;
    timestamp: number;
    active: boolean;
} | null> {
    if (!HEALTH_REGISTRY) return null;
    try {
        const contract = getHealthContract();
        const r = await contract.getRecord(recordId);
        if (!r || r.fileCid === "") return null;
        return {
            fileCid: r.fileCid,
            patient: r.patient,
            uploader: r.uploader,
            fileType: r.fileType ? ethers.decodeBytes32String(r.fileType) : "",
            timestamp: Number(r.timestamp ?? 0),
            active: Boolean(r.active),
        };
    } catch (e) {
        console.error("Failed to get record:", e);
        return null;
    }
}

// ─── Access Grant / Revoke ───────────────────────────────────────────────────

/**
 * Grant a doctor access to a specific record on-chain.
 * The patient (signer) must own the record.
 * Falls back gracefully with a friendly error when doctor is not verified by the IVerifier.
 */
export async function grantRecordAccess(
    signer: Signer,
    recordId: string,
    doctorAddress: string,
    encDekIpfsCid = '',
    newManifestCid = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!HEALTH_REGISTRY) {
        return { success: false, error: 'HealthRegistry contract not configured.' };
    }
    if (!isValidAddress(doctorAddress)) {
        return { success: false, error: 'Invalid grantee wallet address.' };
    }
    if (encDekIpfsCid && !isLikelyCid(encDekIpfsCid)) {
        return { success: false, error: 'Invalid DEK manifest CID. On-chain accepts only CID pointers.' };
    }
    if (!newManifestCid) {
        return { success: false, error: 'Missing access manifest CID. Re-upload and retry grant.' };
    }
    if (newManifestCid && !isLikelyCid(newManifestCid)) {
        return { success: false, error: 'Invalid access manifest CID. On-chain accepts only CID pointers.' };
    }
    try {
        const contract = getHealthContract(signer);
        const tx = await contract.grantAccess(recordId, doctorAddress, encDekIpfsCid, newManifestCid);
        const receipt = await tx.wait();
        const signerAddress = (await signer.getAddress().catch(() => "")).toLowerCase();
        if (signerAddress) {
            patientAccessCache.delete(signerAddress);
            patientRecordIdsCache.delete(signerAddress);
        }
        doctorGrantedPatientsCache.delete(doctorAddress.toLowerCase());
        return { success: true, txHash: receipt.hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const gasMsg = parseInsufficientFundsMessage(msg);
        if (gasMsg) {
            const signerAddr = await signer.getAddress().catch(() => "");
            return {
                success: false,
                error: `${gasMsg} Signer: ${signerAddr || "unknown address"}.`,
            };
        }
        // Provide user-friendly messages for common revert reasons
        if (msg.includes('Not your record')) {
            return { success: false, error: 'You do not own this record.' };
        }
        if (msg.includes('Not a verified clinician') || msg.includes('Grantee not a verified clinician')) {
            return { success: false, error: 'Doctor is not yet verified on-chain. Please ask them to complete verification.' };
        }
        if (msg.includes('Record inactive')) {
            return { success: false, error: 'This record is no longer active.' };
        }
        if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('action rejected')) {
            return { success: false, error: 'Transaction rejected in wallet.' };
        }
        console.error('grantRecordAccess error:', e);
        return { success: false, error: msg };
    }
}

/**
 * Doctor grants access to a record they just uploaded.
 */
export async function doctorGrantRecordAccess(
    signer: Signer,
    recordId: string,
    patientAddress: string,
    granteeAddress: string,
    encDekIpfsCid = '',
    newManifestCid = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!HEALTH_REGISTRY) {
        return { success: false, error: 'HealthRegistry contract not configured.' };
    }
    if (!isValidAddress(granteeAddress) || !isValidAddress(patientAddress)) {
        return { success: false, error: 'Invalid wallet address.' };
    }

    try {
        const contract = getHealthContract(signer);
        const tx = await contract.doctorGrantAccess(recordId, patientAddress, granteeAddress, encDekIpfsCid, newManifestCid);
        const receipt = await tx.wait();

        patientAccessCache.delete(patientAddress.toLowerCase());
        patientRecordIdsCache.delete(patientAddress.toLowerCase());

        return { success: true, txHash: receipt.hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const gasMsg = parseInsufficientFundsMessage(msg);
        if (gasMsg) {
            const signerAddr = await signer.getAddress().catch(() => "");
            return {
                success: false,
                error: `${gasMsg} Signer: ${signerAddr || "unknown address"}.`,
            };
        }

        if (msg.includes('Not the uploader')) {
            return { success: false, error: 'You did not upload this record.' };
        }
        if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('action rejected')) {
            return { success: false, error: 'Transaction rejected in wallet.' };
        }
        console.error('doctorGrantRecordAccess error:', e);
        return { success: false, error: msg };
    }
}

/** Check if an address is currently verified by HealthRegistry's configured verifier. */
export async function isAddressVerifiedClinician(address: string): Promise<boolean> {
    if (!HEALTH_REGISTRY || !isValidAddress(address)) return false;
    const key = address.toLowerCase();
    const now = Date.now();
    const cached = clinicianVerifiedCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;
    try {
        const provider = getProvider();
        const health = getHealthContract(provider);
        const verifierAddress: string = await health.verifier();
        if (!isValidAddress(verifierAddress)) {
            clinicianVerifiedCache.set(key, { expiresAt: Date.now() + CLINICIAN_VERIFIED_TTL_MS, value: false });
            return false;
        }
        const verifier = new ethers.Contract(verifierAddress, VERIFIER_ABI, provider);
        const result = Boolean(await verifier.isVerified(address));
        clinicianVerifiedCache.set(key, { expiresAt: Date.now() + CLINICIAN_VERIFIED_TTL_MS, value: result });
        return result;
    } catch {
        clinicianVerifiedCache.set(key, { expiresAt: Date.now() + CLINICIAN_VERIFIED_TTL_MS, value: false });
        return false;
    }
}

/**
 * Revoke a doctor's access to a record on-chain.
 */
export async function revokeRecordAccess(
    signer: Signer,
    recordId: string,
    doctorAddress: string,
    newManifestCid = ''
): Promise<{ success: boolean; txHash?: string; pending?: boolean; error?: string }> {
    if (!HEALTH_REGISTRY) {
        return { success: false, error: 'HealthRegistry contract not configured.' };
    }
    if (!isValidAddress(doctorAddress)) {
        return { success: false, error: 'Invalid grantee wallet address.' };
    }
    if (newManifestCid && !isLikelyCid(newManifestCid)) {
        return { success: false, error: 'Invalid access manifest CID. On-chain accepts only CID pointers.' };
    }
    try {
        const contract = getHealthContract(signer);
        const tx = await contract.revokeAccess(recordId, doctorAddress, newManifestCid);
        // Wait for confirmation with a 45s timeout.
        // On slow testnets (Polygon Amoy) mining can take a long time.
        // If timed out: tx was submitted — treat as pending success so the UI unblocks.
        const TX_CONFIRM_TIMEOUT_MS = 45_000;
        type ReceiptResult =
            | { ok: true; hash: string }
            | { ok: false; txHash: string };
        const result = await Promise.race<ReceiptResult>([
            tx.wait().then(r => ({ ok: true as const, hash: r!.hash })),
            new Promise<ReceiptResult>(resolve =>
                setTimeout(() => resolve({ ok: false, txHash: tx.hash }), TX_CONFIRM_TIMEOUT_MS)
            ),
        ]);
        const signerAddress = (await signer.getAddress().catch(() => '')).toLowerCase();
        if (signerAddress) {
            patientAccessCache.delete(signerAddress);
            patientRecordIdsCache.delete(signerAddress);
        }
        doctorGrantedPatientsCache.delete(doctorAddress.toLowerCase());
        if (!result.ok) {
            const pendingHash = (result as { ok: false; txHash: string }).txHash;
            console.warn(`revokeRecordAccess: tx ${pendingHash} submitted but not yet mined (timeout). Will confirm eventually.`);
            return { success: true, txHash: pendingHash, pending: true };
        }
        return { success: true, txHash: (result as { ok: true; hash: string }).hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const gasMsg = parseInsufficientFundsMessage(msg);
        if (gasMsg) {
            const signerAddr = await signer.getAddress().catch(() => "");
            return {
                success: false,
                error: `${gasMsg} Signer: ${signerAddr || "unknown address"}.`,
            };
        }
        console.error('revokeRecordAccess error:', e);
        return { success: false, error: msg };
    }
}

/**
 * Read all AccessGranted events where grantee = doctorAddress.
 * Returns a deduplicated list of patient addresses + record IDs.
 */
export async function getGrantedPatientsForDoctor(
    doctorAddress: string,
    opts?: { forceRefresh?: boolean }
): Promise<{ patient: string; recordId: string; timestamp?: number }[]> {
    if (!HEALTH_REGISTRY || !isValidAddress(doctorAddress)) return [];
    if (isBlockedWallet(doctorAddress)) return [];
    const cacheKey = doctorAddress.toLowerCase();
    const forceRefresh = opts?.forceRefresh === true;
    const now = Date.now();
    const cached = doctorGrantedPatientsCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > now) {
        return cached.value.filter((row) => !isBlockedWallet(row.patient));
    }
    const subgraphPatients = new Set<string>();
    try {
        if (hasSubgraphDirectory() && !forceRefresh) {
            const wallets = await listGrantedPatientWalletsForDoctorFromSubgraph(doctorAddress);
            wallets
                .filter((patient) => !isBlockedWallet(patient))
                .forEach((patient) => subgraphPatients.add(patient.toLowerCase()));
        }

        const provider = getProvider();
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = getAccessEventsFromBlock(latestBlock);
        const contract = getHealthContract(provider);
        // Filters: AccessGranted(recordId, grantee, encDekIpfsCid), AccessRevoked(recordId, grantee)
        const grantFilter = contract.filters.AccessGranted(null, doctorAddress, null);
        const revokeFilter = contract.filters.AccessRevoked(null, doctorAddress);
        const [grantEvents, revokeEvents] = await Promise.all([
            queryFilterChunked(contract, grantFilter, { fromBlock, chunkSize: ACCESS_EVENTS_CHUNK_SIZE }),
            queryFilterChunked(contract, revokeFilter, { fromBlock, chunkSize: ACCESS_EVENTS_CHUNK_SIZE }),
        ]);

        const latestByRecord = new Map<string, { granted: boolean; blockNumber: number; logIndex: number }>();
        const upsert = (recordId: string, granted: boolean, blockNumber: number, logIndex: number) => {
            const prev = latestByRecord.get(recordId);
            if (!prev || blockNumber > prev.blockNumber || (blockNumber === prev.blockNumber && logIndex > prev.logIndex)) {
                latestByRecord.set(recordId, { granted, blockNumber, logIndex });
            }
        };
        grantEvents.forEach((ev) => {
            if (!("args" in ev)) return;
            const recordId: string = ev.args[0];
            upsert(recordId, true, Number(ev.blockNumber || 0), Number((ev as { index?: number }).index ?? 0));
        });
        revokeEvents.forEach((ev) => {
            if (!("args" in ev)) return;
            const recordId: string = ev.args[0];
            upsert(recordId, false, Number(ev.blockNumber || 0), Number((ev as { index?: number }).index ?? 0));
        });

        const activeRecordIds = Array.from(latestByRecord.entries())
            .filter(([, meta]) => meta.granted)
            .map(([recordId]) => recordId);
        const seen = new Set<string>();
        const results: { patient: string; recordId: string; timestamp?: number }[] = [];
        for (const recordId of activeRecordIds) {
            // Look up the patient from the record
            try {
                const rec = await contract.getRecord(recordId);
                if (rec && rec.patient && !seen.has(rec.patient) && !isBlockedWallet(rec.patient)) {
                    seen.add(rec.patient);
                    results.push({
                        patient: rec.patient,
                        recordId,
                        timestamp: latestByRecord.get(recordId)?.blockNumber || 0,
                    });
                }
            } catch {
                // record may have been deactivated — skip
            }
        }
        subgraphPatients.forEach((patient) => {
            if (!patient || seen.has(patient) || isBlockedWallet(patient)) return;
            seen.add(patient);
            results.push({
                patient,
                // UI consumers only need a stable id when source is subgraph-only.
                recordId: `subgraph-grant-${patient}`,
                timestamp: undefined,
            });
        });
        doctorGrantedPatientsCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, value: results });
        return results;
    } catch (e) {
        console.error('getGrantedPatientsForDoctor error:', e);
        if (subgraphPatients.size > 0) {
            const fallback = Array.from(subgraphPatients)
                .filter((patient) => !isBlockedWallet(patient))
                .map((patient) => ({
                    patient,
                    recordId: `subgraph-grant-${patient}`,
                    timestamp: undefined,
                }));
            doctorGrantedPatientsCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, value: fallback });
            return fallback;
        }
        return [];
    }
}

/**
 * Find the DEK manifest CID for a specific record and user.
 * Queries AccessGranted events for (recordId, userAddress).
 */
export async function getRecordDEK(
    recordId: string,
    userAddress: string
): Promise<string | null> {
    if (!HEALTH_REGISTRY || !isValidAddress(userAddress)) return null;
    try {
        if (hasSubgraphDirectory()) {
            const fromSubgraph = await getEncDekCidForRecordGranteeFromSubgraph(recordId, userAddress);
            if (fromSubgraph) return fromSubgraph;
        }
        const contract = getHealthContract();
        const filter = contract.filters.AccessGranted(recordId, userAddress, null);
        const events = await queryFilterChunked(contract, filter);
        if (events.length > 0) {
            const ev = events[events.length - 1]; // Use latest grant
            if ("args" in ev) {
                return ev.args[2]; // encDekIpfsCid
            }
        }
        return null;
    } catch (e) {
        console.error('getRecordDEK error:', e);
        return null;
    }
}

/**
 * Get the latest access manifest CID pointer for a patient.
 * This is a cheap single contract read and useful as a fast permissions hint.
 */
export async function getAccessManifestCidForPatient(patientAddress: string): Promise<string> {
    if (!HEALTH_REGISTRY || !isValidAddress(patientAddress)) return "";
    try {
        const contract = getHealthContract();
        const cid = await contract.accessManifestCid(patientAddress);
        return typeof cid === "string" ? cid.trim() : "";
    } catch {
        return "";
    }
}

/**
 * Get all doctors who have been granted access by this patient.
 * Queries AccessGranted events for all records owned by the patient.
 */
export async function getAccessGrantsForPatient(
    patientAddress: string,
    opts?: { forceRefresh?: boolean }
): Promise<{ doctorAddress: string; recordId: string; encDekIpfsCid: string }[]> {
    if (!HEALTH_REGISTRY || !isValidAddress(patientAddress)) return [];
    if (isBlockedWallet(patientAddress)) return [];
    const cacheKey = patientAddress.toLowerCase();
    const now = Date.now();
    const forceRefresh = opts?.forceRefresh === true;
    const cached = patientAccessCache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > now) {
        return cached.value.filter((row) => !isBlockedWallet(row.doctorAddress));
    }
    const merged = new Map<string, { doctorAddress: string; recordId: string; encDekIpfsCid: string }>();
    try {
        if (hasSubgraphDirectory() && !forceRefresh) {
            const fromSubgraph = await listAccessGrantsForPatientFromSubgraph(patientAddress);
            fromSubgraph.forEach((row) => {
                if (!isValidAddress(row.doctorAddress)) return;
                if (isBlockedWallet(row.doctorAddress)) return;
                const key = `${row.recordId.toLowerCase()}|${row.doctorAddress.toLowerCase()}`;
                merged.set(key, {
                    doctorAddress: row.doctorAddress.toLowerCase(),
                    recordId: row.recordId,
                    encDekIpfsCid: row.encDekIpfsCid,
                });
            });
        }

        const recordIds = await getPatientRecordIds(patientAddress, { forceRefresh });
        const provider = getProvider();
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = getAccessEventsFromBlock(latestBlock);
        const contract = getHealthContract(provider);

        for (const rid of recordIds) {
            const grantFilter = contract.filters.AccessGranted(rid, null, null);
            const revokeFilter = contract.filters.AccessRevoked(rid, null);
            const [grantEvents, revokeEvents] = await Promise.all([
                queryFilterChunked(contract, grantFilter, { fromBlock, chunkSize: ACCESS_EVENTS_CHUNK_SIZE }),
                queryFilterChunked(contract, revokeFilter, { fromBlock, chunkSize: ACCESS_EVENTS_CHUNK_SIZE }),
            ]);

            const latestByDoctor = new Map<string, {
                granted: boolean;
                blockNumber: number;
                logIndex: number;
                encDekIpfsCid: string;
            }>();
            const upsert = (
                doctorAddress: string,
                granted: boolean,
                blockNumber: number,
                logIndex: number,
                encDekIpfsCid: string
            ) => {
                const prev = latestByDoctor.get(doctorAddress.toLowerCase());
                if (!prev || blockNumber > prev.blockNumber || (blockNumber === prev.blockNumber && logIndex > prev.logIndex)) {
                    latestByDoctor.set(doctorAddress.toLowerCase(), {
                        granted,
                        blockNumber,
                        logIndex,
                        encDekIpfsCid,
                    });
                }
            };

            grantEvents.forEach((ev) => {
                if (!("args" in ev)) return;
                const doctorAddress = String(ev.args[1] || "");
                if (!isValidAddress(doctorAddress)) return;
                if (isBlockedWallet(doctorAddress)) return;
                const encDekIpfsCid = String(ev.args[2] || "");
                upsert(
                    doctorAddress,
                    true,
                    Number(ev.blockNumber || 0),
                    Number((ev as { index?: number }).index ?? 0),
                    encDekIpfsCid
                );
            });
            revokeEvents.forEach((ev) => {
                if (!("args" in ev)) return;
                const doctorAddress = String(ev.args[1] || "");
                if (!isValidAddress(doctorAddress)) return;
                if (isBlockedWallet(doctorAddress)) return;
                upsert(
                    doctorAddress,
                    false,
                    Number(ev.blockNumber || 0),
                    Number((ev as { index?: number }).index ?? 0),
                    ""
                );
            });

            latestByDoctor.forEach((meta, doctorAddress) => {
                const key = `${rid.toLowerCase()}|${doctorAddress.toLowerCase()}`;
                if (!meta.granted || isBlockedWallet(doctorAddress)) {
                    merged.delete(key);
                    return;
                }
                merged.set(key, {
                    doctorAddress,
                    recordId: rid,
                    encDekIpfsCid: meta.encDekIpfsCid,
                });
            });
        }
        const value = Array.from(merged.values());
        patientAccessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, value });
        return value;
    } catch (e) {
        if (isRetryableRpcError(e)) {
            console.warn(`getAccessGrantsForPatient: RPC temporarily unavailable (code=${rpcErrorCode(e)}).`);
        } else {
            console.error('getAccessGrantsForPatient error:', e);
        }
        const fallback = Array.from(merged.values());
        if (fallback.length > 0) {
            patientAccessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS, value: fallback });
            return fallback;
        }
        return [];
    }
}

// ─── Doctor Registration & Record Upload ─────────────────────────────────────

/**
 * Register the doctor's wallet on HealthRegistry.
 * Must be called once before the doctor can upload records.
 */
export async function registerDoctorOnChain(
    signer: Signer
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!HEALTH_REGISTRY) {
        return { success: false, error: 'HealthRegistry contract not configured.' };
    }
    try {
        const contract = getHealthContract(signer);
        const tx = await contract.registerDoctor();
        const receipt = await tx.wait();
        return { success: true, txHash: receipt.hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const gasMsg = parseInsufficientFundsMessage(msg);
        if (gasMsg) {
            const signerAddr = await signer.getAddress().catch(() => "");
            return {
                success: false,
                error: `${gasMsg} Signer: ${signerAddr || "unknown address"}.`,
            };
        }
        if (msg.includes('Already registered')) {
            return { success: true }; // already registered is fine
        }
        console.error('registerDoctorOnChain error:', e);
        return { success: false, error: msg };
    }
}

/**
 * Register the patient's wallet on HealthRegistry.
 * Must be called once before records can be created for that patient.
 */
export async function registerPatientOnChain(
    signer: Signer
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!HEALTH_REGISTRY) {
        return { success: false, error: 'HealthRegistry contract not configured.' };
    }
    try {
        const contract = getHealthContract(signer);
        const tx = await contract.registerPatient();
        const receipt = await tx.wait();
        return { success: true, txHash: receipt.hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const gasMsg = parseInsufficientFundsMessage(msg);
        if (gasMsg) {
            const signerAddr = await signer.getAddress().catch(() => "");
            return {
                success: false,
                error: `${gasMsg} Signer: ${signerAddr || "unknown address"}.`,
            };
        }
        if (msg.includes('Already registered')) {
            return { success: true }; // idempotent success
        }
        console.error('registerPatientOnChain error:', e);
        return { success: false, error: msg };
    }
}

/**
 * Upload a medical record on-chain.
 * Calls HealthRegistry.addRecord(patientAddress, fileCid, fileType).
 * Returns the recordId from the RecordAdded event.
 */
export async function addRecordOnChain(
    signer: Signer,
    patientAddress: string,
    fileCid: string,
    fileType: string
): Promise<{ success: boolean; recordId?: string; txHash?: string; error?: string }> {
    if (!HEALTH_REGISTRY) {
        return { success: false, error: 'HealthRegistry contract not configured.' };
    }
    if (!isValidAddress(patientAddress)) {
        return { success: false, error: 'Invalid patient wallet address.' };
    }
    if (!isLikelyCid(fileCid)) {
        return { success: false, error: 'Invalid file CID. On-chain accepts only CID pointers.' };
    }
    try {
        const contract = getHealthContract(signer);
        const fileTypeBytes32 = ethers.encodeBytes32String(fileType.slice(0, 31));
        const tx = await contract.addRecord(patientAddress, fileCid, fileTypeBytes32);
        const receipt = await tx.wait();

        // Parse recordId from RecordAdded event
        let recordId: string | undefined;
        for (const log of receipt.logs || []) {
            try {
                const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
                if (parsed && parsed.name === 'RecordAdded') {
                    recordId = parsed.args[0]; // recordId
                    break;
                }
            } catch { /* not our event */ }
        }

        // Some RPC/providers can fail event decoding in specific receipts.
        // Derive deterministic fallback id from contract formula and verify by getRecord.
        if (!recordId) {
            try {
                const provider = (contract.runner as { provider?: ethers.Provider } | null)?.provider;
                const signerAddress = (await signer.getAddress()).toLowerCase();
                const block = provider ? await provider.getBlock(receipt.blockNumber) : null;
                const ts = Number(block?.timestamp ?? 0);
                if (ts > 0) {
                    const fallbackId = ethers.keccak256(
                        ethers.solidityPacked(
                            ["address", "string", "uint256", "address"],
                            [patientAddress, fileCid, ts, signerAddress]
                        )
                    );
                    const rec = await contract.getRecord(fallbackId);
                    if (rec && String(rec.fileCid || "") === fileCid) {
                        recordId = fallbackId;
                    }
                }
            } catch {
                // keep undefined and return explicit error below
            }
        }

        if (!recordId) {
            return {
                success: false,
                txHash: receipt.hash,
                error: "Record tx mined but recordId could not be resolved from logs.",
            };
        }

        return { success: true, recordId, txHash: receipt.hash };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const gasMsg = parseInsufficientFundsMessage(msg);
        if (gasMsg) {
            const signerAddr = await signer.getAddress().catch(() => "");
            return {
                success: false,
                error: `${gasMsg} Signer: ${signerAddr || "unknown address"}.`,
            };
        }
        if (msg.includes('Not a registered doctor') || msg.includes('Only registered doctors')) {
            return { success: false, error: 'You must register as a doctor on-chain first.' };
        }
        if (msg.includes('Patient not registered')) {
            return { success: false, error: 'Patient not registered on HealthRegistry yet.' };
        }
        if (msg.includes('Not authorised')) {
            return { success: false, error: 'Signer is not authorised for this patient. Switch wallet to patient account.' };
        }
        if (msg.includes('Invalid patient')) {
            return { success: false, error: 'Invalid patient address.' };
        }
        console.error('addRecordOnChain error:', e);
        return { success: false, error: msg };
    }
}

/**
 * Get all records uploaded by a specific doctor for all their patients.
 * Queries RecordAdded events where uploader = doctorAddress.
 */
export async function getRecordsUploadedByDoctor(
    doctorAddress: string
): Promise<{ recordId: string; patient: string; fileCid: string; fileType: string; timestamp: number }[]> {
    type UploadedRow = { recordId: string; patient: string; fileCid: string; fileType: string; timestamp: number };
    const mergeRows = (...groups: UploadedRow[][]): UploadedRow[] => {
        const merged = new Map<string, UploadedRow>();
        for (const group of groups) {
            for (const row of group) {
                const id = (row.recordId || "").trim().toLowerCase();
                if (!id) continue;
                merged.set(id, {
                    recordId: (row.recordId || "").trim(),
                    patient: (row.patient || "").trim().toLowerCase(),
                    fileCid: (row.fileCid || "").trim(),
                    fileType: normalizeRecordFileType(row.fileType),
                    timestamp: Number(row.timestamp || 0),
                });
            }
        }
        return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
    };

    const loadFromChain = async (
        opts?: { fromBlock?: number; toBlock?: number }
    ): Promise<UploadedRow[]> => {
        const contract = getHealthContract();
        const filter = contract.filters.RecordAdded(null, null, doctorAddress, null);
        const events = await queryFilterChunked(contract, filter, opts);
        const results: UploadedRow[] = [];
        for (const ev of events) {
            if (!("args" in ev)) continue;
            const recordId = String(ev.args[0] || "");
            const patient = String(ev.args[1] || "");
            const fileCid = String(ev.args[3] || "");
            if (!recordId || !patient || !fileCid) continue;
            // Fetch full record to resolve normalized category and canonical timestamp.
            try {
                const rec = await contract.getRecord(recordId);
                results.push({
                    recordId,
                    patient,
                    fileCid,
                    fileType: normalizeRecordFileType(rec.fileType),
                    timestamp: Number(rec.timestamp ?? ev.blockNumber ?? 0),
                });
            } catch {
                // record may have been deactivated — skip
            }
        }
        return results;
    };

    if (!HEALTH_REGISTRY) return [];
    try {
        if (hasSubgraphDirectory()) {
            const subgraphRows = (await listRecordsUploadedByDoctorFromSubgraph(doctorAddress)).map((row) => ({
                ...row,
                fileType: normalizeRecordFileType(row.fileType),
            }));
            try {
                // Reconcile latest on-chain writes so newly uploaded records appear immediately.
                const latest = await getProvider().getBlockNumber();
                const recentFromBlock = Math.max(0, latest - RECENT_UPLOAD_RECONCILE_BLOCKS);
                const recentChainRows = await loadFromChain({ fromBlock: recentFromBlock, toBlock: latest });
                const merged = mergeRows(subgraphRows, recentChainRows);
                if (merged.length > 0) return merged;
            } catch (reconcileError) {
                console.warn('getRecordsUploadedByDoctor reconcile error:', reconcileError);
            }
            if (subgraphRows.length > 0) {
                return mergeRows(subgraphRows);
            }
        }

        const chainRows = await loadFromChain();
        return mergeRows(chainRows);
    } catch (e) {
        console.error('getRecordsUploadedByDoctor error:', e);
        return [];
    }
}
