"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth, useAuthSession } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import {
    getPatientRecordIds,
    getRecordMetadata,
    getProvider,
} from "@/lib/blockchain";
import { fetchFromIPFS } from "@/lib/ipfs";
import { unwrapDEKForUser, decryptFile } from "@/lib/record-crypto";
import { FileText, Download, Eye, Loader2, ArrowLeft, Lock, Shield, X } from "lucide-react";
import Link from "next/link";
import RecordViewer from "@/components/record-viewer";

interface RecordView {
    recordId: string;
    fileCid: string;
    fileType: string;
    timestamp: number;
    uploader: string;
    active: boolean;
    decrypting: boolean;
    decryptedUrl?: string;
    decryptError?: string;
}

function DoctorRecordsContent() {
    const { data: session, status } = useAuthSession();
    const { getSigner } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const patientAddress = searchParams.get("patient") || "";
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<RecordView[]>([]);
    const [error, setError] = useState("");
    const [selectedRecord, setSelectedRecord] = useState<RecordView | null>(null);

    useEffect(() => {
        async function loadRecords() {
            if (status === "loading") return;
            if (status === "unauthenticated" || !session?.user) {
                router.push("/auth/login");
                return;
            }
            if (session.user.role !== "doctor") {
                router.push("/");
                return;
            }
            if (!patientAddress) {
                setError("No patient address specified.");
                setLoading(false);
                return;
            }

            try {
                const recordIds = await getPatientRecordIds(patientAddress);
                const recordViews: RecordView[] = [];

                for (const rid of recordIds) {
                    const meta = await getRecordMetadata(rid);
                    if (meta) {
                        recordViews.push({
                            recordId: rid,
                            fileCid: meta.fileCid,
                            fileType: meta.fileType,
                            timestamp: meta.timestamp,
                            uploader: meta.uploader,
                            active: meta.active,
                            decrypting: false,
                        });
                    }
                }

                setRecords(recordViews);
            } catch (e) {
                console.error("Error loading records:", e);
                setError("Failed to load patient records from blockchain.");
            } finally {
                setLoading(false);
            }
        }

        loadRecords();
    }, [session, status, router, patientAddress]);

    /** Handled by RecordViewer modal now */
    const handleOpenRecord = (record: RecordView) => {
        setSelectedRecord(record);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-neutral-400">Loading patient records...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
            <Navbar />

            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    {/* Back + Header */}
                    <div className="mb-8">
                        <Link
                            href="/doctor/patients"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to patients
                        </Link>

                        <div className="flex items-center gap-3 mb-2">
                            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                                Patient Records
                            </h1>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400 font-mono text-sm">
                            Patient: {patientAddress.slice(0, 10)}...{patientAddress.slice(-8)}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
                            <Shield className="w-4 h-4 flex-shrink-0" />
                            Records are end-to-end encrypted. Decryption happens in your browser only.
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    {/* Records List */}
                    {records.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                            <FileText className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">No records found</h3>
                            <p className="text-neutral-500 dark:text-neutral-400 mt-2">
                                This patient has no records on the blockchain yet.
                            </p>
                            <Link
                                href={`/doctor/upload?patient=${patientAddress}`}
                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                Upload a record
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {records.map((record, index) => (
                                <div
                                    key={record.recordId}
                                    className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 hover:shadow-md transition"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${record.active ? "bg-blue-100 dark:bg-blue-900/30" : "bg-neutral-100 dark:bg-neutral-700"}`}>
                                                {record.decryptedUrl ? (
                                                    <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                ) : (
                                                    <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
                                                    {record.fileType || "Medical Record"}
                                                </h3>
                                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                                    Uploaded by: {record.uploader.slice(0, 8)}...{record.uploader.slice(-6)}
                                                </p>
                                                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 font-mono">
                                                    CID: {record.fileCid.slice(0, 20)}...
                                                </p>
                                                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                                                    {record.timestamp > 0
                                                        ? new Date(record.timestamp * 1000).toLocaleString()
                                                        : "Pending"}
                                                </p>
                                                {!record.active && (
                                                    <span className="inline-block mt-2 text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleOpenRecord(record)}
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                            >
                                                <Eye className="w-4 h-4" />
                                                View Record
                                            </button>
                                        </div>
                                    </div>

                                    {record.decryptError && (
                                        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                                            {record.decryptError}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedRecord && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
                                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                                    Medical Record Preview
                                </h3>
                                <button
                                    onClick={() => setSelectedRecord(null)}
                                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition"
                                >
                                    <X className="w-6 h-6 text-neutral-500" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <RecordViewer
                                    recordHash={selectedRecord.fileCid}
                                    recordId={selectedRecord.recordId}
                                    recordType={selectedRecord.fileType}
                                    metadata={{
                                        doctor: selectedRecord.uploader,
                                        timestamp: BigInt(Math.floor(selectedRecord.timestamp)),
                                        notes: `Record ID: ${selectedRecord.recordId.slice(0, 12)}...`
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function DoctorRecordsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <DoctorRecordsContent />
        </Suspense>
    );
}
