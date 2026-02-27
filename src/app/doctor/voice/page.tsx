"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { getVoiceNotesClient } from "@/lib/client-data";
import { useLanguage } from "@/contexts/LanguageContext";
import { toLocale } from "@/lib/i18n/locale";

interface ClinicalNote {
  id: string;
  chiefComplaint: string;
  diagnosis: string;
  status: string;
  createdAt: string;
}

export default function DoctorVoicePage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const { user } = useAuth();
  const { tx, language } = useLanguage();
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetchNotes();
  }, [status, session, router]);

  const fetchNotes = async () => {
    try {
      const data = await getVoiceNotesClient(user?.walletAddress ?? session?.user?.walletAddress ?? null);
      setNotes((data.notes || []) as ClinicalNote[]);
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  const handleNoteGenerated = () => {
    fetchNotes();
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
        <Link
          href="/doctor/home"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-6"
          aria-label={tx("Back to doctor home")}
        >
          <ArrowLeft className="w-4 h-4" />
          {tx("Back")}
        </Link>

        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
          {tx("Voice Documentation")}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          {tx("Record your consultation; AI will generate a SOAP note.")}
        </p>

        <div className="mb-8">
          <VoiceRecorder
            language={toLocale(language)}
            onNoteGenerated={handleNoteGenerated}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            {tx("Recent Notes")}
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" aria-hidden />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-neutral-500 py-6">{tx("No voice notes yet. Record a consultation above.")}</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/doctor/voice/${note.id}`}
                    className="block p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-500 transition"
                    aria-label={`View note: ${note.chiefComplaint || note.diagnosis || note.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-neutral-500 flex-shrink-0" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {note.chiefComplaint || note.diagnosis || tx("Untitled note")}
                        </p>
                        <p className="text-sm text-neutral-500">
                          {new Date(note.createdAt).toLocaleDateString(toLocale(language))} - {tx(note.status)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
