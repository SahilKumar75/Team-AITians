"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, X, Loader2, Stethoscope, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ethers } from "ethers";
import {
    getPatientRecordIds,
    grantRecordAccess,
    isHealthRegistryConfigured,
    getRecordDEK,
} from "@/lib/blockchain";
import { fetchJSONFromIPFS, uploadJSON } from "@/lib/ipfs";
import { unwrapDEKForUser, wrapDEKForUser } from "@/lib/record-crypto";
import { ensureUploadGasBalance } from "@/lib/gas-sponsor";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Doctor {
    id: string;
    name: string;
    specialization: string;
    hospital: string;
    walletAddress: string;
    email?: string;
}

interface GrantAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGrantSuccess: (grantedEntry?: GrantEntry) => void;
}

export interface GrantEntry {
    doctorAddress: string;
    doctorName: string;
    specialization: string;
    hospital: string;
    grantedAt: string; // ISO string
    txHash?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GrantAccessModal({
    isOpen,
    onClose,
    onGrantSuccess,
}: GrantAccessModalProps) {
    const router = useRouter();
    const { user, getSigner } = useAuth();
    const [query, setQuery] = useState("");
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(false);
    const [granting, setGranting] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [recordCount, setRecordCount] = useState<number | null>(null);

    useEffect(() => {
        const patientAddress = user?.walletAddress || "";
        if (!isOpen || !patientAddress) return;
        let active = true;
        (async () => {
            try {
                const ids = await getPatientRecordIds(patientAddress, { forceRefresh: true });
                if (active) setRecordCount(ids.length);
            } catch {
                if (active) setRecordCount(null);
            }
        })();
        return () => {
            active = false;
        };
    }, [isOpen, user?.walletAddress]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = query.trim();
        const patientAddress = user?.walletAddress || "";
        if (!q) {
            setDoctors([]);
            setError("");
            return;
        }
        if (ethers.isAddress(q)) {
            const wallet = q.toLowerCase();
            setDoctors([
                {
                    id: wallet,
                    name: `Wallet ${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
                    specialization: "Family / trusted contact",
                    hospital: "Direct wallet grant",
                    walletAddress: wallet,
                },
            ]);
            setError("");
            return;
        }
        if (!patientAddress) {
            setDoctors([]);
            setError("Patient wallet context not found.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            if (recordCount === null && patientAddress) {
                const ids = await getPatientRecordIds(patientAddress, { forceRefresh: true });
                setRecordCount(ids.length);
            }
            const res = await fetch(
                `/api/patient/doctors-search?query=${encodeURIComponent(q)}&patientWallet=${encodeURIComponent(patientAddress)}`
            );
            const data = await res.json();
            const list = (data.success ? data.doctors : []) as Doctor[];
            setDoctors(list);
            if (!data.success && data.error) {
                setError(String(data.error));
            } else if (data.success && list.length === 0) {
                setError(String(data.message || "No eligible verified doctors found for this patient."));
            }
        } catch {
            setError("Failed to search doctors");
        } finally {
            setLoading(false);
        }
    };

    const handleGrant = async (doctor: Doctor) => {
        setGranting(doctor.id);
        setError("");
        let grantedDoctor: GrantEntry | undefined = undefined;
        const fetchManifestWithTimeout = async (cid: string) =>
            await new Promise<unknown>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("Manifest fetch timed out.")), 6000);
                fetchJSONFromIPFS(cid).then(
                    (value) => {
                        clearTimeout(timer);
                        resolve(value);
                    },
                    (err) => {
                        clearTimeout(timer);
                        reject(err);
                    }
                );
            });

        try {
            const patientAddress = user?.walletAddress;
            if (!patientAddress) {
                setError("Not logged in");
                return;
            }

            // ── Blockchain path ─────────────────────────────────────────────────────
            if (isHealthRegistryConfigured()) {
                try {
                    const provider = new ethers.JsonRpcProvider(
                        process.env.NEXT_PUBLIC_POLYGON_RPC_URL ||
                        "https://rpc-amoy.polygon.technology",
                        parseInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || "80002")
                    );
                    const signer = getSigner(provider);
                    if (!signer) {
                        throw new Error("Wallet not detected. Please unlock MetaMask to sign the permission grant.");
                    }
                    const signerAddress = (await signer.getAddress()).toLowerCase();
                    if (signerAddress !== patientAddress.toLowerCase()) {
                        throw new Error(
                            `Wallet mismatch: signed-in patient is ${patientAddress}, but connected wallet is ${signerAddress}. Switch MetaMask to the same patient wallet.`
                        );
                    }

                    // Ensure signer wallet has enough POL before running multi-record grant tx loop.
                    await ensureUploadGasBalance(signer);

                    // Grant access for every active record the patient owns
                    const recordIds = await getPatientRecordIds(patientAddress, { forceRefresh: true });
                    setRecordCount(recordIds.length);
                    if (recordIds.length === 0) {
                        const short = `${patientAddress.slice(0, 6)}...${patientAddress.slice(-4)}`;
                        setError(
                            `No on-chain records found for wallet ${short}. Upload from /patient/records using this same patient account, then grant access.`
                        );
                        return;
                    } else {
                        let successCount = 0;
                        let firstGrantError = "";
                        let missingManifestCount = 0;
                        for (const recordId of recordIds) {
                            try {
                                // 1. Get existing manifest for patient
                                const manifestCid = await getRecordDEK(recordId, patientAddress);
                                if (!manifestCid) {
                                    missingManifestCount += 1;
                                    continue;
                                }

                                // 2. Fetch and unwrap DEK
                                let manifest: any;
                                try {
                                    manifest = (await fetchManifestWithTimeout(manifestCid)) as any;
                                } catch (manifestErr) {
                                    missingManifestCount += 1;
                                    if (!firstGrantError) {
                                        firstGrantError =
                                            manifestErr instanceof Error ? manifestErr.message : "Manifest fetch failed";
                                    }
                                    continue;
                                }
                                const wrappedForPatient = manifest.keys?.[patientAddress.toLowerCase()];
                                if (!wrappedForPatient) continue;

                                const dek = await unwrapDEKForUser(wrappedForPatient, patientAddress);

                                // 3. Wrap for doctor
                                const wrappedForDoctor = await wrapDEKForUser(dek, doctor.walletAddress);

                                // 4. Update manifest
                                const doctorWalletKey = doctor.walletAddress.toLowerCase();
                                const existingDoctors =
                                    manifest.doctors && typeof manifest.doctors === "object"
                                        ? (manifest.doctors as Record<string, unknown>)
                                        : {};
                                const newManifest = {
                                    ...manifest,
                                    keys: {
                                        ...manifest.keys,
                                        [doctorWalletKey]: wrappedForDoctor,
                                    },
                                    doctors: {
                                        ...existingDoctors,
                                        [doctorWalletKey]: {
                                            name: doctor.name || "",
                                            specialization: doctor.specialization || "",
                                            hospital: doctor.hospital || "",
                                            updatedAt: new Date().toISOString(),
                                        },
                                    },
                                };
                                const newManifestCid = await uploadJSON(newManifest);

                                // 5. Grant on-chain
                                const result = await grantRecordAccess(
                                    signer,
                                    recordId,
                                    doctor.walletAddress,
                                    newManifestCid,
                                    newManifestCid
                                );
                                if (!result.success) {
                                    if (!firstGrantError && result.error) firstGrantError = result.error;
                                    if ((result.error || "").toLowerCase().includes("not yet verified on-chain")) {
                                        break;
                                    }
                                    console.warn(`Grant failed for record ${recordId}:`, result.error);
                                } else {
                                    successCount += 1;
                                }
                            } catch (err) {
                                console.error(`Failed to process grant for record ${recordId}:`, err);
                                if (!firstGrantError) {
                                    firstGrantError = err instanceof Error ? err.message : String(err);
                                }
                            }
                        }
                        if (successCount === 0) {
                            if (!firstGrantError && missingManifestCount > 0) {
                                firstGrantError =
                                    "No DEK manifest found for your existing record(s). Re-upload record(s) from /patient/records, then grant access again.";
                            }
                            const reason = firstGrantError || "Unknown grant error";
                            setError(`Failed to grant access to ${doctor.name}: ${reason}`);
                            return;
                        }
                        setSuccess(`Access granted to ${doctor.name} on-chain.`);
                        grantedDoctor = {
                            doctorAddress: doctor.walletAddress,
                            doctorName: doctor.name ? (doctor.name.match(/^Dr\./i) ? doctor.name : `Dr. ${doctor.name}`) : `Dr. (${doctor.walletAddress.slice(0, 6)}…${doctor.walletAddress.slice(-4)})`,
                            specialization: doctor.specialization || "General Physician",
                            hospital: doctor.hospital || "Verified on Chain",
                            grantedAt: new Date().toISOString(),
                            txHash: "on-chain",
                        };
                    }
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    console.warn("Blockchain grant failed:", msg);
                    setError(`On-chain grant failed: ${msg}`);
                    return;
                }
            } else {
                setError("HealthRegistry is not configured. On-chain grant is unavailable.");
                return;
            }
        } finally {
            setGranting(null);
            if (grantedDoctor) {
                void Promise.resolve(onGrantSuccess(grantedDoctor));
            }
            onClose();
            setSuccess("");
            setDoctors([]);
            setQuery("");
        }
    };

    const handleUploadFirst = () => {
        onClose();
        router.push("/patient/records");
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                        Grant Access to Doctor
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                    >
                        <X className="w-5 h-5 text-neutral-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Search form */}
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by doctor name, email, phone, or wallet"
                                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-60"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Search"
                            )}
                        </button>
                    </form>

                    {/* Error / Success banners */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    {recordCount === 0 && !error && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg text-sm">
                            Upload at least one on-chain record before granting doctor access.
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                            {success}
                        </div>
                    )}

                    {/* Doctor list */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {doctors.length === 0 && !loading && query && (
                            <p className="text-center text-neutral-500 py-4">
                                No eligible doctor/contact found. Try name, email, phone, or wallet.
                            </p>
                        )}
                        {doctors.map((doc) => (
                            <div
                                key={doc.id}
                                className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                            >
                                <div>
                                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-50">
                                        {doc.name}
                                    </h4>
                                    <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                        <div className="flex items-center gap-1">
                                            <Stethoscope className="w-3 h-3" />
                                            {doc.specialization}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {doc.hospital}
                                        </div>
                                    </div>
                                    <p className="text-xs text-neutral-400 mt-1 font-mono">
                                        {doc.walletAddress}
                                    </p>
                                </div>
                                <button
                                    onClick={() => (recordCount === 0 ? handleUploadFirst() : handleGrant(doc))}
                                    disabled={granting === doc.id}
                                    className={`px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 ml-4 flex-shrink-0 ${recordCount === 0
                                        ? "bg-amber-600 hover:bg-amber-700"
                                        : "bg-green-600 hover:bg-green-700"
                                        }`}
                                >
                                    {granting === doc.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <UserPlus className="w-4 h-4" />
                                            {recordCount === 0 ? "Upload Record First" : "Grant Access"}
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
