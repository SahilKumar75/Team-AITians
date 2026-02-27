"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { jsPDF } from "jspdf";
import { getIPFSUrl, fetchFromIPFS, fetchJSONFromIPFS } from "@/lib/ipfs";
import { useAuth } from "@/contexts/AuthContext";
import { getRecordDEK } from "@/lib/blockchain";
import { unwrapDEKForUser, decryptFile } from "@/lib/record-crypto";
import { getOfflineRecord, saveRecordOffline } from "@/lib/offline-storage";
import {
    FileText,
    Lock,
    Unlock,
    Loader2,
    Download,
    AlertCircle,
    Database,
    Info,
    ShieldCheck,
} from "lucide-react";

interface RecordViewerProps {
    recordHash: string;
    recordId?: string; // Blockchain ID to find DEK manifest
    recordType?: string;
    metadata?: {
        doctor?: string;
        timestamp?: bigint;
        notes?: string;
    };
}

export default function RecordViewer({
    recordHash,
    recordId,
    recordType,
    metadata,
}: RecordViewerProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [decrypting, setDecrypting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<"pdf" | "image" | "text" | "unknown">("unknown");
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [textContent, setTextContent] = useState<string>("");
    const [isEncrypted, setIsEncrypted] = useState(false);
    const [isOfflineCached, setIsOfflineCached] = useState(false);

    useEffect(() => {
        const loadAndDecryptRecord = async () => {
            setLoading(true);
            setError(null);
            setPreviewUrl("");
            setTextContent("");
            setIsOfflineCached(false);

            const cacheKey = recordId || recordHash;

            // 1. Check Offline Storage First
            try {
                const cached = await getOfflineRecord(cacheKey);
                if (cached) {
                    const url = URL.createObjectURL(cached.blob);
                    setPreviewUrl(url);
                    setIsOfflineCached(true);
                    setFileType(cached.mimeType as any || "unknown");
                    setLoading(false);
                    return;
                }
            } catch (cacheErr) {
                console.warn("Offline cache check failed:", cacheErr);
            }

            try {
                const walletAddress = user?.walletAddress;
                let finalBlob: Blob | null = null;
                let manifestCid: string | null = null;
                let manifestData: Record<string, unknown> | null = null;

                // 2. Check if we have a DEK manifest for this record and user
                if (recordId && walletAddress && ethers.isAddress(walletAddress)) {
                    manifestCid = await getRecordDEK(recordId, walletAddress);
                }

                if (manifestCid) {
                    setIsEncrypted(true);
                    setDecrypting(true);
                    try {
                        // 3. Fetch DEK Manifest
                        const manifest = (await fetchJSONFromIPFS(manifestCid)) as any;
                        manifestData = manifest;
                        const wrappedKey = manifest.keys?.[walletAddress!.toLowerCase()];

                        if (wrappedKey) {
                            // 4. Fetch Encrypted File
                            const encryptedBlob = await fetchFromIPFS(recordHash);
                            const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());
                            const mimeType = typeof manifest?.mimeType === "string" ? manifest.mimeType : "application/octet-stream";

                            // 5. Unwrap DEK & Decrypt
                            const dek = await unwrapDEKForUser(wrappedKey, walletAddress!);
                            finalBlob = await decryptFile(encryptedBytes, dek, mimeType);
                        } else {
                            console.warn("No key for this user in manifest");
                            finalBlob = await fetchFromIPFS(recordHash);
                        }
                    } catch (decErr) {
                        console.error("Decryption failed:", decErr);
                        setError("Failed to decrypt record. You might not have access.");
                        setDecrypting(false);
                        setLoading(false);
                        return;
                    }
                } else {
                    setIsEncrypted(false);
                    finalBlob = await fetchFromIPFS(recordHash);
                }

                if (finalBlob) {
                    let detectedFileType: "pdf" | "image" | "text" | "unknown" = "unknown";
                    const blobType = finalBlob.type.toLowerCase();

                    // 1. Try blob MIME type first
                    if (blobType.includes("pdf")) {
                        detectedFileType = "pdf";
                    } else if (blobType.includes("image")) {
                        detectedFileType = "image";
                    } else if (blobType.startsWith("text/")) {
                        detectedFileType = "text";
                    }

                    // 2. If still unknown, sniff magic bytes
                    if (detectedFileType === "unknown") {
                        try {
                            const header = new Uint8Array(await finalBlob.slice(0, 8).arrayBuffer());
                            if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
                                // %PDF
                                detectedFileType = "pdf";
                                finalBlob = new Blob([finalBlob], { type: "application/pdf" });
                            } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
                                // PNG
                                detectedFileType = "image";
                                finalBlob = new Blob([finalBlob], { type: "image/png" });
                            } else if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
                                // JPEG
                                detectedFileType = "image";
                                finalBlob = new Blob([finalBlob], { type: "image/jpeg" });
                            } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
                                // GIF
                                detectedFileType = "image";
                                finalBlob = new Blob([finalBlob], { type: "image/gif" });
                            } else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
                                // RIFF (WebP)
                                detectedFileType = "image";
                                finalBlob = new Blob([finalBlob], { type: "image/webp" });
                            }
                        } catch { /* header read failed, continue */ }
                    }

                    // 3. If still unknown, try originalName from manifest or recordType prop
                    if (detectedFileType === "unknown") {
                        const origName = typeof manifestData?.originalName === "string" ? manifestData.originalName : "";
                        const nameHint = origName || recordType || "";
                        const ext = nameHint.split(".").pop()?.toLowerCase() || "";
                        if (ext === "pdf") detectedFileType = "pdf";
                        else if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) detectedFileType = "image";
                        else if (["txt", "csv", "json", "xml", "md", "html"].includes(ext)) detectedFileType = "text";
                    }

                    setFileType(detectedFileType);

                    if (detectedFileType === "text") {
                        const text = await finalBlob.text();
                        setTextContent(text);
                    } else if (detectedFileType === "pdf" && !manifestCid) {
                        // Unencrypted PDF — serve directly from IPFS API URL.
                        // Blob URLs in iframes/objects can fail silently due to CSP + blob lifecycle.
                        setPreviewUrl(getIPFSUrl(recordHash));
                    } else {
                        const url = URL.createObjectURL(finalBlob);
                        setPreviewUrl(url);
                    }

                    await saveRecordOffline(cacheKey, finalBlob, detectedFileType, metadata);
                    setIsOfflineCached(true);
                }
            } catch (err) {
                console.error("Error loading record:", err);
                const message = err instanceof Error ? err.message : "Failed to load record from IPFS";
                setError(message);
            } finally {
                setDecrypting(false);
                setLoading(false);
            }
        };

        loadAndDecryptRecord();

        return () => {
            // Only revoke blob URLs — IPFS API URLs must not be revoked
            if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        };
    }, [recordHash, recordId, user?.walletAddress]);

    const downloadTextAsPdf = () => {
        if (!textContent) return;
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const margin = 40;
        const maxWidth = 515;
        const lines = doc.splitTextToSize(textContent, maxWidth);
        let y = 50;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        lines.forEach((line: string) => {
            if (y > 790) {
                doc.addPage();
                y = 50;
            }
            doc.text(line, margin, y);
            y += 16;
        });
        doc.save(`medical_record_${recordId || "file"}.pdf`);
    };

    const handleDownload = () => {
        if (fileType === "text" && textContent) {
            downloadTextAsPdf();
            return;
        }
        if (previewUrl) {
            const a = document.createElement("a");
            a.href = previewUrl;
            a.download = `medical_record_${recordId || "file"}`;
            a.click();
        } else {
            const ipfsUrl = getIPFSUrl(recordHash);
            window.open(ipfsUrl, "_blank");
        }
    };

    if (loading || decrypting) {
        return (
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-12 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                    {decrypting ? "Decrypting secure record..." : "Fetching from IPFS..."}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-xl flex flex-col items-center text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Access Error</h3>
                <p className="text-red-700 dark:text-red-300 text-sm mb-4">{error}</p>
                <button
                    onClick={() => {
                        setLoading(true);
                        setError(null);
                        setPreviewUrl("");
                        setIsOfflineCached(false);
                    }}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        {isEncrypted ? (
                            <Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-50 text-sm">
                            {recordType || "Medical Record"}
                        </h3>
                        <div className="flex gap-2 mt-1">
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${isEncrypted
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                    : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
                                    }`}
                            >
                                {isEncrypted ? (
                                    <ShieldCheck className="w-3 h-3" />
                                ) : (
                                    <Info className="w-3 h-3" />
                                )}
                                {isEncrypted ? "Decrypted Client-Side" : "Unencrypted/Legacy"}
                            </span>
                            {isOfflineCached && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                    <Database className="w-3 h-3" />
                                    Offline Saved
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                    <Download className="w-4 h-4" />
                    {fileType === "text" ? "Download PDF" : "Download"}
                </button>
            </div>

            {/* Viewer */}
            <div className="p-0">
                {fileType === "pdf" && previewUrl && (
                    <div className="w-full h-[72vh] bg-neutral-100 dark:bg-neutral-900 flex flex-col">
                        <object
                            data={`${previewUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                            type="application/pdf"
                            className="w-full flex-1"
                            aria-label="PDF Viewer"
                        >
                            {/* Fallback for browsers that block object PDF rendering */}
                            <embed
                                src={`${previewUrl}#toolbar=1`}
                                type="application/pdf"
                                className="w-full h-full"
                            />
                            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                                <FileText className="w-12 h-12 text-neutral-400" />
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                    Your browser can&apos;t display PDFs inline. Download to view it.
                                </p>
                                <a
                                    href={previewUrl}
                                    download={`record_${recordId || recordHash.slice(0, 8)}.pdf`}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                                >
                                    <Download className="w-4 h-4" />
                                    Download PDF
                                </a>
                            </div>
                        </object>
                    </div>
                )}
                {fileType === "pdf" && !previewUrl && (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
                    </div>
                )}

                {fileType === "image" && (
                    <div className="p-6 flex justify-center bg-neutral-100 dark:bg-neutral-900">
                        <img
                            src={previewUrl}
                            alt="Medical Record"
                            className="max-w-full h-auto rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700"
                        />
                    </div>
                )}

                {fileType === "text" && (
                    <div className="p-6 bg-neutral-50 dark:bg-neutral-900">
                        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                            <p className="text-xs text-neutral-500 mb-2">
                                This consultation note is stored as text. Download to get a PDF copy.
                            </p>
                            <pre className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200 max-h-[60vh] overflow-y-auto">
                                {textContent}
                            </pre>
                        </div>
                    </div>
                )}

                {fileType === "unknown" && (
                    <div className="text-center py-20 px-6 space-y-4">
                        <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center mx-auto">
                            <FileText className="w-10 h-10 text-neutral-400" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                                Preview Unavailable
                            </p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                                We decrypted the file, but your browser cannot preview it directly.
                            </p>
                        </div>
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-2 px-6 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 transition"
                        >
                            <Download className="w-4 h-4" />
                            Download File
                        </button>
                    </div>
                )}
            </div>

            {/* Metadata Footer */}
            {metadata && (
                <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30">
                    <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50 mb-3">
                        Record Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {metadata.doctor && (
                            <div className="flex flex-col">
                                <span className="text-neutral-500 dark:text-neutral-400">Doctor</span>
                                <span className="text-neutral-900 dark:text-neutral-100 font-mono">
                                    {metadata.doctor}
                                </span>
                            </div>
                        )}
                        <div>
                            <span className="text-neutral-500 dark:text-neutral-400">IPFS Hash</span>
                            <p className="font-mono text-[10px] text-neutral-900 dark:text-neutral-100 break-all leading-tight">
                                {recordHash}
                            </p>
                        </div>
                        {metadata.notes && (
                            <div className="md:col-span-2">
                                <span className="text-neutral-500 dark:text-neutral-400">Notes</span>
                                <p className="text-neutral-700 dark:text-neutral-300 mt-0.5">
                                    {metadata.notes}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
