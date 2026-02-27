"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useAuth, useAuthSession } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { FooterSection } from "@/components/ui/footer-section";
import { useLanguage } from "@/contexts/LanguageContext";
import { Upload, FileText, CheckCircle, AlertCircle, Shield, Loader2 } from "lucide-react";
import {
    getGrantedPatientsForDoctor,
    addRecordOnChain,
    getRecordsUploadedByDoctor,
    getProvider,
    fetchIdentityByWallet,
    doctorGrantRecordAccess,
} from "@/lib/blockchain";
import { generateDEK, encryptFile, wrapDEKForUser } from "@/lib/record-crypto";
import { fetchJSONFromIPFS, uploadToIPFS, uploadJSON } from "@/lib/ipfs";
import { ensureUploadGasBalance } from "@/lib/gas-sponsor";
import { ethers } from "ethers";

interface Patient {
    address: string;
    recordId: string;
    label: string;
}

interface UploadedRecord {
    recordId: string;
    patient: string;
    fileCid: string;
    fileType: string;
    timestamp: number;
}

const MIN_UPLOAD_START_GAS_POL = "0.09";
const MIN_UPLOAD_GRANT_GAS_POL = "0.05";

function DoctorUploadContent() {
    const { data: session, status } = useAuthSession();
    const { getSigner } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState("");
    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientsLoaded, setPatientsLoaded] = useState(false);
    const [patientNamesByWallet, setPatientNamesByWallet] = useState<Record<string, string>>({});
    const [uploadHistory, setUploadHistory] = useState<UploadedRecord[]>([]);
    const [selectedPatient, setSelectedPatient] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");
    const hasInitialized = useRef(false);

    function shortWallet(wallet: string): string {
        return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    }

    async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | null = null;
        try {
            return await Promise.race<T>([
                promise,
                new Promise<T>((resolve) => {
                    timer = setTimeout(() => resolve(fallback), ms);
                }),
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async function resolvePatientNames(wallets: string[]) {
        const unique = Array.from(
            new Set(
                wallets
                    .map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
                    .filter((w) => w.startsWith("0x") && w.length === 42)
            )
        );
        if (unique.length === 0) return;

        const nextMap: Record<string, string> = {};
        await Promise.all(
            unique.map(async (wallet) => {
                const existing = patientNamesByWallet[wallet];
                if (existing) {
                    nextMap[wallet] = existing;
                    return;
                }

                // Fast server-side profile resolver (cached + better gateway fallbacks).
                try {
                    const statusRes = await withTimeout(
                        fetch(`/api/patient/status?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" }),
                        3500,
                        null as unknown as Response
                    );
                    if (statusRes && statusRes.ok) {
                        const statusJson = (await statusRes.json()) as { fullName?: unknown };
                        if (typeof statusJson.fullName === "string" && statusJson.fullName.trim()) {
                            nextMap[wallet] = statusJson.fullName.trim();
                            return;
                        }
                    }
                } catch {
                    // fallback to direct identity/profile path below
                }

                const identity = await withTimeout(fetchIdentityByWallet(wallet), 3500, null);
                if (!identity) return;

                let resolvedName = "";
                if (identity.lockACid) {
                    const lockA = await withTimeout(fetchJSONFromIPFS(identity.lockACid), 3000, null as unknown);
                    const lockObj = lockA && typeof lockA === "object" ? (lockA as Record<string, unknown>) : null;
                    const profileCid =
                        lockObj && typeof lockObj.profileCid === "string" ? lockObj.profileCid.trim() : "";
                    if (profileCid) {
                        const profileRaw = await withTimeout(fetchJSONFromIPFS(profileCid), 3000, null as unknown);
                        const profileObj =
                            profileRaw && typeof profileRaw === "object" ? (profileRaw as Record<string, unknown>) : null;
                        const profile =
                            profileObj?.profile && typeof profileObj.profile === "object"
                                ? (profileObj.profile as Record<string, unknown>)
                                : profileObj;
                        if (profile) {
                            if (typeof profile.fullName === "string" && profile.fullName.trim()) {
                                resolvedName = profile.fullName.trim();
                            } else if (typeof profile.name === "string" && profile.name.trim()) {
                                resolvedName = profile.name.trim();
                            }
                        }
                    }
                }

                if (!resolvedName && identity.title && identity.title.trim().toLowerCase() !== "patient") {
                    resolvedName = identity.title.trim();
                }
                if (resolvedName) nextMap[wallet] = resolvedName;
            })
        );

        if (Object.keys(nextMap).length > 0) {
            setPatientNamesByWallet((prev) => ({ ...prev, ...nextMap }));
        }
    }

    function formatRecordCategory(fileType: string): string {
        const raw = (fileType || "").trim();
        if (!raw) return "Medical Record";
        if (/^0x[0-9a-fA-F]{64}$/.test(raw)) {
            try {
                const decoded = ethers.decodeBytes32String(raw).trim();
                return decoded || "Medical Record";
            } catch {
                return "Medical Record";
            }
        }
        return raw;
    }

    // Read patient from query param on mount
    useEffect(() => {
        const patientAddr = searchParams.get("patient");
        if (patientAddr) setSelectedPatient(patientAddr);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated" || !session?.user) {
            router.push("/auth/login");
            return;
        }

        if (session.user.role !== "doctor") {
            router.push(session.user.role === "patient" ? "/patient/home" : "/");
            return;
        }

        const walletAddress = session.user.walletAddress;
        if (!walletAddress) return;

        // Prevent duplicate initialization
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        (async () => {
            let grantedPatients: Array<{ patient: string; recordId: string; timestamp?: number }> = [];
            try {
                const grants = await getGrantedPatientsForDoctor(walletAddress);
                grantedPatients = grants;
                setPatients(
                    grants.map((g) => ({
                        address: g.patient,
                        recordId: g.recordId,
                        label: shortWallet(g.patient),
                    }))
                );
            } catch (err) {
                console.error("Error loading patients from chain:", err);
            } finally {
                setPatientsLoaded(true);
            }

            try {
                const records = await getRecordsUploadedByDoctor(walletAddress);
                setUploadHistory(records);
                await resolvePatientNames([
                    ...grantedPatients.map((g) => g.patient),
                    ...records.map((r) => r.patient),
                ]);
            } catch (err) {
                console.error("Error loading upload history:", err);
            }

            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, session?.user?.walletAddress]);

    /** Load patients from AccessGranted chain events */
    async function loadPatients() {
        try {
            if (!session?.user?.walletAddress) return;
            const grants = await getGrantedPatientsForDoctor(session.user.walletAddress);
            setPatients(
                grants.map((g) => ({
                    address: g.patient,
                    recordId: g.recordId,
                    label: shortWallet(g.patient),
                }))
            );
            await resolvePatientNames(grants.map((g) => g.patient));
        } catch (error) {
            console.error("Error loading patients from chain:", error);
        }
    }

    /** Load upload history from RecordAdded chain events */
    async function loadUploadHistory() {
        try {
            if (!session?.user?.walletAddress) return;
            const records = await getRecordsUploadedByDoctor(session.user.walletAddress);
            setUploadHistory(records);
            await resolvePatientNames(records.map((r) => r.patient));
        } catch (error) {
            console.error("Error loading upload history:", error);
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setError(t.portal.upload.fileSizeError);
            return;
        }

        setSelectedFile(file);
        setError("");
    };

    /**
     * Upload flow (MRC architecture):
     * 1. Generate random DEK
     * 2. Encrypt file with DEK
     * 3. Upload encrypted file to IPFS → fileCid
     * 4. Call addRecord on-chain → recordId
     * 5. Wrap DEK for doctor + patient → upload to IPFS
     */
    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPatient || !selectedFile || !category) {
            setError(t.portal.upload.fillAllFields);
            return;
        }

        const provider = getProvider();
        const signer = getSigner(provider);
        if (!signer) {
            setError("Wallet not available or account locked. Please unlock MetaMask to secure this record on-chain.");
            return;
        }

        try {
            setUploading(true);
            setError("");
            setTxHash("");

            await ensureUploadGasBalance(signer, { minRequiredPol: MIN_UPLOAD_START_GAS_POL });

            // Step 1: Encrypt file with DEK
            setUploadStep("Encrypting file...");
            const dek = await generateDEK();
            const encryptedBytes = await encryptFile(selectedFile, dek);

            // Step 3: Upload encrypted file to IPFS
            setUploadStep("Uploading to IPFS...");
            const encryptedBlob = new Blob([encryptedBytes as BlobPart], { type: "application/octet-stream" });
            const encryptedFile = new File([encryptedBlob], `encrypted_${selectedFile.name}`, {
                type: "application/octet-stream",
            });
            const fileCid = await uploadToIPFS(encryptedFile);

            // Step 4: Record on chain
            setUploadStep("Recording on blockchain...");
            const result = await addRecordOnChain(signer, selectedPatient, fileCid, category);
            if (!result.success) {
                throw new Error(result.error || "On-chain record creation failed");
            }

            // Step 5: Wrap DEK for doctor and patient, store on IPFS
            setUploadStep("Securing encryption keys...");
            const doctorAddress = session?.user?.walletAddress || (await signer.getAddress());
            const wrappedForDoctor = await wrapDEKForUser(dek, doctorAddress);
            const wrappedForPatient = await wrapDEKForUser(dek, selectedPatient);
            const dekManifest = {
                recordId: result.recordId,
                keys: {
                    [doctorAddress.toLowerCase()]: wrappedForDoctor,
                    [selectedPatient.toLowerCase()]: wrappedForPatient,
                },
                description: description || undefined,
                originalName: selectedFile.name,
                category,
                uploadedAt: new Date().toISOString(),
            };
            const manifestCid = await uploadJSON(dekManifest);

            // Step 6: Persist manifest CID on-chain via doctorGrantAccess
            setUploadStep("Linking keys to blockchain...");
            await ensureUploadGasBalance(signer, { minRequiredPol: MIN_UPLOAD_GRANT_GAS_POL });
            // Grant to patient
            const patientGrantRes = await doctorGrantRecordAccess(
                signer,
                result.recordId!,
                selectedPatient,
                selectedPatient,
                manifestCid,
                manifestCid
            );
            if (!patientGrantRes.success) {
                throw new Error(patientGrantRes.error || "Failed to grant record access to patient.");
            }
            // Grant to doctor (so uploader can also decrypt)
            await ensureUploadGasBalance(signer, { minRequiredPol: MIN_UPLOAD_GRANT_GAS_POL });
            const doctorGrantRes = await doctorGrantRecordAccess(
                signer,
                result.recordId!,
                selectedPatient,
                doctorAddress,
                manifestCid,
                manifestCid
            );
            if (!doctorGrantRes.success) {
                throw new Error(doctorGrantRes.error || "Failed to grant record access to doctor.");
            }

            // Success
            setTxHash(result.txHash || "");
            setSuccess(t.portal.upload.success);
            setSelectedFile(null);
            setCategory("");
            setDescription("");
            setUploadStep("");
            await loadUploadHistory();

            setTimeout(() => setSuccess(""), 5000);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Upload failed";
            setError(msg);
            setUploadStep("");
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-neutral-400">{t.common.loading}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
            <Navbar />

            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                                {t.portal.upload.pageTitle}
                            </h1>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400">
                            {t.portal.upload.pageDescription}
                        </p>
                        {/* MRC info banner */}
                        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
                            <Shield className="w-4 h-4 flex-shrink-0" />
                            Files are encrypted client-side before upload. Only authorized users can decrypt.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Upload Form */}
                        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-6">
                                {t.portal.upload.uploadNew}
                            </h2>

                            {success && (
                                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                        <p className="text-green-800 dark:text-green-200">{success}</p>
                                    </div>
                                    {txHash && (
                                        <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-mono break-all">
                                            Tx: {txHash}
                                        </p>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    <p className="text-red-800 dark:text-red-200">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleUpload} className="space-y-4">
                                {/* Patient Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                                        {t.portal.upload.selectPatient} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedPatient}
                                        onChange={(e) => setSelectedPatient(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                    >
                                        <option value="">{t.portal.upload.selectPatient || "Choose a patient..."}</option>
                                        {patients.map((patient) => (
                                            <option key={patient.address} value={patient.address}>
                                                {patientNamesByWallet[patient.address.toLowerCase()]
                                                    ? `${patientNamesByWallet[patient.address.toLowerCase()]} — ${patient.label}`
                                                    : patient.label}
                                            </option>
                                        ))}
                                        {/* If patient from URL is not yet in the loaded list, show it anyway */}
                                        {selectedPatient && !patients.find(p => p.address.toLowerCase() === selectedPatient.toLowerCase()) && (
                                            <option value={selectedPatient}>
                                                {patientNamesByWallet[selectedPatient.toLowerCase()]
                                                    ? `${patientNamesByWallet[selectedPatient.toLowerCase()]} — ${shortWallet(selectedPatient)}`
                                                    : shortWallet(selectedPatient)}
                                            </option>
                                        )}
                                    </select>
                                    {patientsLoaded && patients.length === 0 && !selectedPatient && (
                                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                            No patients have granted you access yet. Patients must grant access from their dashboard.
                                        </p>
                                    )}
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                                        {t.portal.upload.categoryLabel} <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                    >
                                        <option value="">{t.portal.upload.categoryPlaceholder}</option>
                                        <option value="Lab Results">Lab Results</option>
                                        <option value="Imaging">Imaging (X-ray, MRI, CT)</option>
                                        <option value="Prescription">Prescription</option>
                                        <option value="Diagnosis">Diagnosis Report</option>
                                        <option value="Treatment Plan">Treatment Plan</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                {/* File Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                                        {t.portal.upload.uploadFileLabel} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>
                                    {selectedFile && (
                                        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                                            Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                        {t.portal.upload.supportedFormats}
                                    </p>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                                        {t.portal.upload.descriptionLabel}
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        placeholder={t.portal.upload.descriptionPlaceholder}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* Upload Progress */}
                                {uploading && uploadStep && (
                                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                                        <span className="text-sm text-blue-800 dark:text-blue-200">{uploadStep}</span>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={uploading || !selectedPatient || !selectedFile || !category}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            {t.portal.upload.uploading}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5" />
                                            {t.portal.upload.uploadButton}
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Upload History (from chain) */}
                        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-6">
                                {t.portal.upload.recentUploads}
                            </h2>

                            <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                {uploadHistory.length === 0 ? (
                                    <div className="text-center py-8">
                                        <FileText className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                                        <p className="text-neutral-600 dark:text-neutral-400">{t.portal.upload.noUploads}</p>
                                    </div>
                                ) : (
                                    uploadHistory.map((record) => (
                                        (() => {
                                            const patientWallet = record.patient.toLowerCase();
                                            const patientName = patientNamesByWallet[patientWallet];
                                            const categoryLabel = formatRecordCategory(record.fileType);
                                            return (
                                                <div
                                                    key={record.recordId}
                                                    className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
                                                        <div className="flex-1">
                                                            <h4 className="font-medium text-neutral-900 dark:text-neutral-50">
                                                                {categoryLabel}
                                                            </h4>
                                                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                                                Patient: {patientName ? `${patientName} · ${shortWallet(record.patient)}` : shortWallet(record.patient)}
                                                            </p>
                                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                                                Category: {categoryLabel}
                                                            </p>
                                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                                                                CID: {record.fileCid.slice(0, 16)}...
                                                            </p>
                                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                                                {record.timestamp > 0
                                                                    ? new Date(record.timestamp * 1000).toLocaleString()
                                                                    : "Pending confirmation"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <FooterSection />
        </div>
    );
}

export default function DoctorUploadPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-neutral-400">Loading...</p>
                </div>
            </div>
        }>
            <DoctorUploadContent />
        </Suspense>
    );
}
