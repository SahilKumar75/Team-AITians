"use client";

import { useState } from "react";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import {
    getProvider,
    isHealthRegistryConfigured,
    addRecordOnChain,
    grantRecordAccess,
    registerPatientOnChain,
} from "@/lib/blockchain";
import { generateDEK, encryptFile, wrapDEKForUser } from "@/lib/record-crypto";
import { uploadToIPFS, uploadJSON } from "@/lib/ipfs";
import { ensureUploadGasBalance } from "@/lib/gas-sponsor";

interface PatientUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
}

export function PatientUploadModal({ isOpen, onClose, onUploadSuccess }: PatientUploadModalProps) {
    const { tx } = useLanguage();
    const { data: session } = useAuthSession();
    const { getSigner } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            if (selected.size > 10 * 1024 * 1024) {
                setError("File is too large (max 10MB)");
                return;
            }
            setFile(selected);
            setError("");
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !category) {
            setError("Please select a file and category");
            return;
        }

        try {
            setUploading(true);
            setError("");

            // Step 1: Crypto setup
            const dek = await generateDEK();

            // Step 2: Encrypt & Upload File
            const encryptedBytes = await encryptFile(file, dek);
            // Ensure BlobPart is backed by a plain ArrayBuffer (not ArrayBufferLike/SharedArrayBuffer type).
            const encryptedPayload = new Uint8Array(encryptedBytes.byteLength);
            encryptedPayload.set(encryptedBytes);
            const encryptedFile = new File([encryptedPayload], file.name, { type: "application/octet-stream" });
            const fileCid = await uploadToIPFS(encryptedFile);

            let successMsg = "Document uploaded successfully!";
            const patientAddress = session?.user?.walletAddress;
            const fileType = category || "document";
            let onChainSecured = false;

            // Step 3: Secure on-chain if possible
            if (isHealthRegistryConfigured() && patientAddress) {
                const signer = getSigner(getProvider());
                if (!signer) {
                    throw new Error("Wallet signer unavailable. Connect wallet and approve transaction.");
                }
                try {
                    const signerAddress = (await signer.getAddress()).toLowerCase();
                    if (signerAddress !== patientAddress.toLowerCase()) {
                        throw new Error(
                            `Wallet mismatch: signed-in patient is ${patientAddress}, but connected wallet is ${signerAddress}. ` +
                            "Switch MetaMask to the patient wallet."
                        );
                    }

                    await ensureUploadGasBalance(signer);

                    const regResult = await registerPatientOnChain(signer);
                    if (!regResult.success) {
                        throw new Error(regResult.error || "Failed to register patient on-chain.");
                    }

                    const addRes = await addRecordOnChain(signer, patientAddress, fileCid, fileType);
                    if (!addRes.success || !addRes.recordId) {
                        throw new Error(addRes.error || "Failed to create on-chain medical record.");
                    }
                    const recordId = addRes.recordId;

                    // Step 3b: Wrap DEK for patient and upload manifest
                    const wrappedForPatient = await wrapDEKForUser(dek, patientAddress);
                    const dekManifest = {
                        recordId,
                        keys: { [patientAddress.toLowerCase()]: wrappedForPatient },
                        originalName: file.name,
                        category,
                        description: description || undefined,
                        uploadedAt: new Date().toISOString()
                    };
                    const manifestCid = await uploadJSON(dekManifest);

                    // Step 4: Persist manifest on-chain
                    const grantResult = await grantRecordAccess(
                        signer,
                        recordId,
                        patientAddress,
                        manifestCid,
                        manifestCid
                    );
                    if (!grantResult.success) {
                        throw new Error(grantResult.error || "Failed to persist access manifest on-chain.");
                    }
                    onChainSecured = true;
                } catch (onChainErr) {
                    const msg = onChainErr instanceof Error ? onChainErr.message : String(onChainErr);
                    console.warn("On-chain addRecord/securing failed:", msg);
                    setError(
                        `File uploaded to IPFS, but on-chain record creation failed: ${msg}. ` +
                        "Doctor access requires at least one on-chain record."
                    );
                    setSuccess("");
                    return;
                }
            } else {
                successMsg = "Document uploaded to IPFS.";
            }

            if (isHealthRegistryConfigured() && patientAddress && onChainSecured) {
                successMsg = "Document uploaded to IPFS and secured on-chain.";
            }

            setSuccess(successMsg);
            setTimeout(() => {
                onUploadSuccess();
                onClose();
                setFile(null);
                setCategory("");
                setDescription("");
                setSuccess("");
            }, 3000);

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                        {tx("Upload Medical Record")}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg">
                        <X className="w-5 h-5 text-neutral-500" />
                    </button>
                </div>

                <form onSubmit={handleUpload} className="p-6 space-y-4">
                    {success && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            {tx("Select File")} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="file"
                            accept=".pdf,.jpg,.png,.doc,.docx"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-neutral-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100 dark:file:bg-neutral-700 dark:file:text-neutral-300"
                        />
                        {file && <p className="text-xs text-neutral-500 mt-1">{file.name}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            {tx("Category")} <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                        >
                            <option value="">{tx("Select Category")}</option>
                            <option value="Lab Report">{tx("Lab Report")}</option>
                            <option value="Prescription">{tx("Prescription")}</option>
                            <option value="Scan/X-Ray">{tx("Scan/X-Ray")}</option>
                            <option value="Discharge Summary">{tx("Discharge Summary")}</option>
                            <option value="Other">{tx("Other")}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                            {tx("Description")}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full p-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                            placeholder={tx("Add brief details...")}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={uploading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {uploading ? tx("Uploading...") : (
                            <>
                                <Upload className="w-4 h-4" /> {tx("Upload Document")}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
