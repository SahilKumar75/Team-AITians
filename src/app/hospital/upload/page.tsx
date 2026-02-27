"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { FooterSection } from "@/components/ui/footer-section";
import { Upload, Search, Loader2, CheckCircle } from "lucide-react";

interface PatientSearchMatch {
  walletAddress: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

function HospitalUploadPageInner() {
  const { data: session, status } = useAuthSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [patientWallet, setPatientWallet] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ found: boolean; walletAddress?: string; message?: string; patients?: PatientSearchMatch[] } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(0);

  const searchParams = useSearchParams();
  const prefillQuery = searchParams.get("q") ?? "";
  const didPrefill = useRef(false);

  useEffect(() => {
    const isHospitalRole = session?.user?.role === "hospital";

    if (status === "unauthenticated" && !isHospitalRole) {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated" && !isHospitalRole) {
      router.push(
        session?.user?.role === "patient"
          ? "/patient/home"
          : "/doctor/home"
      );
    }
  }, [status, session?.user?.role, router]);

  useEffect(() => {
    async function loadHospitalContext() {
      const wallet = session?.user?.walletAddress;
      if (!wallet) return;
      try {
        const res = await fetch(`/api/hospital/profile?wallet=${encodeURIComponent(wallet)}`);
        const data = await res.json();
        const id = (data?.hospital?.hospitalId || data?.hospital?.id || "").toString().trim();
        if (id) setHospitalId(id);
      } catch {
        setHospitalId("");
      }
    }
    if (status === "authenticated" && session?.user?.role === "hospital") {
      loadHospitalContext();
    }
  }, [status, session?.user?.walletAddress, session?.user?.role]);

  useEffect(() => {
    if (status !== "authenticated" || didPrefill.current || !prefillQuery.trim()) return;
    didPrefill.current = true;
    setSearchQuery(prefillQuery);
    (async () => {
      const q = prefillQuery.trim();
      if (q.length < 2) return;
      setSearching(true);
      setSearchResult(null);
      try {
        const res = await fetch(
          `/api/hospital/patient-search?q=${encodeURIComponent(q)}&hospitalId=${encodeURIComponent(hospitalId)}`
        );
        const data = await res.json();
        setSearchResult(data);
        if (data.found && data.walletAddress) setPatientWallet(data.walletAddress);
        else setPatientWallet(null);
      } catch {
        setSearchResult({ found: false, message: "Search failed. Please try again." });
      } finally {
        setSearching(false);
      }
    })();
  }, [status, prefillQuery, hospitalId]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResult({ found: false, message: "Enter patient name, email, or phone (min 2 chars)." });
      return;
    }
    if (!hospitalId) {
      setSearchResult({ found: false, message: "Hospital profile missing. Complete hospital registration first." });
      return;
    }
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(
        `/api/hospital/patient-search?q=${encodeURIComponent(q)}&hospitalId=${encodeURIComponent(hospitalId)}`
      );
        const data = await res.json();
        setSearchResult(data);
        if (data.found && data.walletAddress) setPatientWallet(data.walletAddress);
      else setPatientWallet(null);
    } catch {
      setSearchResult({ found: false, message: "Search failed. Please try again." });
    } finally {
      setSearching(false);
    }
  }

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!patientWallet || files.length === 0) return;
    setUploading(true);
    let done = 0;
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("category", "clinical");
        form.append("description", `Hospital upload for patient`);
        const res = await fetch("/api/patient/upload", { method: "POST", body: form });
        if (res.ok) done++;
      } catch {
        /* skip */
      }
    }
    setUploadDone(done);
    setUploading(false);
    if (done > 0) setFiles([]);
  }

  const isHospital = session?.user?.role === "hospital";
  if (status === "loading" && !isHospital) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <Upload className="w-7 h-7" />
          Bulk upload clinical records
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          Search patient by name, email, or phone. Only patients who have visited this hospital are shown.
        </p>

        <form onSubmit={handleSearch} className="mt-6 flex gap-3">
          <input
            type="text"
            placeholder="Patient name, email, or phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {searchResult && (
          <div className="mt-4 p-4 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            {searchResult.found && searchResult.walletAddress ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span>Eligible patient found</span>
                </div>
                {Array.isArray(searchResult.patients) && searchResult.patients.length > 0 && (
                  <div className="space-y-2">
                    {searchResult.patients.map((patient) => {
                      const selected = (patientWallet || "").toLowerCase() === (patient.walletAddress || "").toLowerCase();
                      return (
                        <button
                          key={patient.walletAddress}
                          type="button"
                          onClick={() => setPatientWallet(patient.walletAddress)}
                          className={`w-full text-left p-3 rounded-lg border transition ${
                            selected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                          }`}
                        >
                          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                            {patient.fullName || "Patient"}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                            {patient.walletAddress}
                          </p>
                          {(patient.email || patient.phone) && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {[patient.email, patient.phone].filter(Boolean).join(" • ")}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-neutral-600 dark:text-neutral-400">
                {searchResult.message || "No patient found."}
              </p>
            )}
        </div>
        )}

        {patientWallet && (
          <div className="mt-8 p-6 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-2">Upload files</h2>
            <form onSubmit={handleBulkUpload} className="space-y-4">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
              />
              {files.length > 0 && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {files.length} file(s) selected. Upload pins to IPFS (on-chain registration is per patient flow).
                </p>
              )}
              <button
                type="submit"
                disabled={uploading || files.length === 0}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50"
              >
                {uploading ? `Uploading… (${uploadDone}/${files.length})` : "Upload all"}
              </button>
            </form>
          </div>
        )}
      </main>
      <FooterSection />
    </div>
  );
}

export default function HospitalUploadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <HospitalUploadPageInner />
    </Suspense>
  );
}
