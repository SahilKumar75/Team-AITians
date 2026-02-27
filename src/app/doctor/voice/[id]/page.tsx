"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Send } from "lucide-react";
import { getVoiceNoteClient, updateVoiceNoteStatusClient } from "@/lib/client-data";
import { ethers } from "ethers";
import { getProvider, getHealthContract, grantRecordAccess, isHealthRegistryConfigured } from "@/lib/blockchain";
import { generateDEK, encryptFile, wrapDEKForUser } from "@/lib/record-crypto";
import { uploadToIPFS, uploadJSON } from "@/lib/ipfs";
import { useVoiceActions } from "@/hooks/useVoiceActions";
import type { VoiceActionDefinition } from "@/lib/voice/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Note {
  id: string;
  chiefComplaint: string;
  historyOfPresent: string;
  examination: string;
  diagnosis: string;
  plan: string;
  medications: string;
  followUp: string;
  rawTranscript?: string;
  status: string;
  createdAt: string;
}

export default function VoiceNoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const { user, getSigner } = useAuth();
  const { tx } = useLanguage();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [patientWallet, setPatientWallet] = useState("");
  const [sending, setSending] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const voiceActions = useMemo<VoiceActionDefinition[]>(
    () => [
      { id: "doctor_finalize_note", label: "Finalize note", paths: ["/doctor/voice/"] },
      { id: "doctor_send_note", label: "Send note", paths: ["/doctor/voice/"] },
    ],
    []
  );

  useVoiceActions(voiceActions);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (session?.user?.role !== "doctor") {
      router.push("/doctor/home");
      return;
    }
    fetchNote();
  }, [status, session, params.id, router]);

  const fetchNote = async () => {
    try {
      const data = await getVoiceNoteClient(
        params.id,
        user?.walletAddress ?? session?.user?.walletAddress ?? null
      );
      setNote((data as Note | null) ?? null);
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" aria-hidden />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
          <p className="text-neutral-500">{tx("Note not found.")}</p>
          <Link href="/doctor/voice" className="text-blue-600 hover:underline mt-4 inline-block">
            {tx("Back to Voice Notes")}
          </Link>
        </main>
      </div>
    );
  }

  const sections = [
    { label: "Chief Complaint", value: note.chiefComplaint },
    { label: "History of Present Illness", value: note.historyOfPresent },
    { label: "Examination", value: note.examination },
    { label: "Diagnosis / Impression", value: note.diagnosis },
    { label: "Plan", value: note.plan },
    { label: "Medications", value: note.medications },
    { label: "Follow-up", value: note.followUp },
  ];

  async function sendReportToPatient() {
    if (!note) return;
    if (note.status !== "finalized" && note.status !== "sent") {
      setSendMessage(tx("Finalize this note before sending to patient."));
      return;
    }
    if (!ethers.isAddress(patientWallet)) {
      setSendMessage(tx("Enter a valid patient wallet address."));
      return;
    }
    if (!isHealthRegistryConfigured()) {
      setSendMessage(tx("HealthRegistry contract is not configured."));
      return;
    }
    setSending(true);
    setSendMessage("");
    try {
      const signer = getSigner(getProvider());
      if (!signer) throw new Error("Wallet not available");
      const reportText = [
        `Clinical Note ID: ${note.id}`,
        `Created At: ${note.createdAt}`,
        "",
        `Chief Complaint: ${note.chiefComplaint}`,
        `History: ${note.historyOfPresent}`,
        `Examination: ${note.examination}`,
        `Diagnosis: ${note.diagnosis}`,
        `Plan: ${note.plan}`,
        `Medications: ${note.medications}`,
        `Follow-up: ${note.followUp}`,
      ].join("\n");

      const reportFile = new File([reportText], `clinical-note-${note.id}.txt`, { type: "text/plain" });
      const dek = await generateDEK();
      const encryptedBytes = await encryptFile(reportFile, dek);
      const payload = new Uint8Array(encryptedBytes.byteLength);
      payload.set(encryptedBytes);
      const encryptedFile = new File([payload], reportFile.name, { type: "application/octet-stream" });
      const fileCid = await uploadToIPFS(encryptedFile);

      const contract = getHealthContract(signer);
      const fileTypeHash = ethers.keccak256(ethers.toUtf8Bytes("consultation_note"));
      const tx = await contract.addRecord(patientWallet, fileCid, fileTypeHash);
      const receipt = await tx.wait();
      let recordId = "";
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === "RecordAdded") {
            recordId = parsed.args[0];
            break;
          }
        } catch {
          continue;
        }
      }
      if (!recordId) throw new Error("Failed to resolve record ID from transaction.");

      const wrappedForPatient = await wrapDEKForUser(dek, patientWallet);
      const manifest = {
        recordId,
        keys: { [patientWallet.toLowerCase()]: wrappedForPatient },
        originalName: reportFile.name,
        mimeType: reportFile.type,
        category: "Consultation Note",
        noteId: note.id,
        uploadedAt: new Date().toISOString(),
      };
      const manifestCid = await uploadJSON(manifest);
      const grant = await grantRecordAccess(signer, recordId, patientWallet, manifestCid, manifestCid);
      if (!grant.success) throw new Error(grant.error || "Failed to grant patient access");
      await updateVoiceNoteStatusClient(user?.walletAddress ?? session?.user?.walletAddress ?? null, note.id, "sent");
      setNote((prev) => (prev ? { ...prev, status: "sent" } : prev));
      setSendMessage(tx("Report sent to patient records successfully."));
    } catch (e) {
      setSendMessage(e instanceof Error ? e.message : tx("Failed to send report to patient."));
    } finally {
      setSending(false);
    }
  }

  async function finalizeNote() {
    if (!note || note.status === "finalized" || note.status === "sent") return;
    setFinalizing(true);
    setSendMessage("");
    try {
      const out = await updateVoiceNoteStatusClient(
        user?.walletAddress ?? session?.user?.walletAddress ?? null,
        note.id,
        "finalized"
      );
      if (!out.success) throw new Error(out.error || "Failed to finalize note");
      setNote((prev) => (prev ? { ...prev, status: "finalized" } : prev));
      setSendMessage(tx("Note finalized. You can now send this to patient records."));
    } catch (e) {
      setSendMessage(e instanceof Error ? e.message : tx("Failed to finalize note."));
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
        <Link
          href="/doctor/voice"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-6"
          aria-label={tx("Back to voice notes")}
        >
          <ArrowLeft className="w-4 h-4" />
          {tx("Back to Voice Notes")}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-neutral-500" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              {note.chiefComplaint || tx("Clinical Note")}
            </h1>
            <p className="text-sm text-neutral-500">
              {new Date(note.createdAt).toLocaleString()} - {note.status}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {sections.map(({ label, value }) =>
              value ? (
                <div key={label} className="p-6">
                  <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                    {tx(label)}
                  </h2>
                  <p className="text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">
                    {value}
                  </p>
                </div>
              ) : null
            )}
          </div>

          {note.rawTranscript && (
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
              <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                {tx("Raw Transcript")}
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {note.rawTranscript}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={finalizeNote}
              disabled={finalizing || note.status === "finalized" || note.status === "sent"}
              data-voice-action="finalize-note"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-60 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
            >
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {note.status === "sent" ? tx("Already Sent") : note.status === "finalized" ? tx("Finalized") : tx("Finalize Note")}
            </button>
            <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
              {tx("Status")}: {note.status}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            {tx("Send Report To Patient")}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            {tx("This will encrypt this note, upload to IPFS, and add it to the selected patient record on-chain.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={patientWallet}
              onChange={(e) => setPatientWallet(e.target.value)}
              placeholder={tx("Patient wallet address (0x...)")}
              className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
            />
            <button
              onClick={sendReportToPatient}
              disabled={sending || (note.status !== "finalized" && note.status !== "sent")}
              data-voice-action="send-note"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {tx("Send")}
            </button>
          </div>
          {sendMessage && (
            <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{sendMessage}</p>
          )}
        </div>
      </main>
    </div>
  );
}
