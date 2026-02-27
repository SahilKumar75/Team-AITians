"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/contexts/AuthContext";
import { getGrantedPatientsForDoctor, fetchIdentityByWallet } from "@/lib/blockchain";
import { fetchJSONFromIPFS } from "@/lib/ipfs";
import { getJourney, getJourneys, updateJourney } from "@/features/journey/api";
import { ArrowLeft, CheckCircle2, Loader2, Stethoscope } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type JourneyLike = {
  id: string;
  hospital?: { name?: string };
  tokenNumber?: string;
  status: string;
  progressPercent: number;
  startedAt: string;
  allottedDoctorWallet?: string;
  checkpoints: Array<{
    id: string;
    status: string;
    completedAt?: string;
    department?: { name?: string };
    notes?: string;
    orders?: Array<{
      orderId: string;
      testType: string;
      departmentId: string;
      status: "pending" | "done";
      expectedReadyAt?: number;
    }>;
  }>;
};

function parseOrders(raw: string): Array<{ testType: string; expectedReadyAt?: number }> {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [testType, expected] = part.split("@").map((x) => x.trim());
      const ts = expected ? new Date(expected).getTime() : undefined;
      return {
        testType,
        expectedReadyAt: typeof ts === "number" && Number.isFinite(ts) ? ts : undefined,
      };
    });
}

export default function DoctorQueuePage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const doctorWallet = (session?.user?.walletAddress || "").toLowerCase();
  const [patientFromQuery, setPatientFromQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [patientWallets, setPatientWallets] = useState<string[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [selectedPatientWallet, setSelectedPatientWallet] = useState("");
  const [journeys, setJourneys] = useState<JourneyLike[]>([]);
  const [notesByJourney, setNotesByJourney] = useState<Record<string, string>>({});
  const [ordersByJourney, setOrdersByJourney] = useState<Record<string, string>>({});
  const [savingJourneyId, setSavingJourneyId] = useState("");
  const { tx } = useLanguage();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
    if (status === "authenticated" && session?.user?.role !== "doctor") {
      router.replace("/doctor/home");
      return;
    }
  }, [status, session?.user?.role, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuery = new URLSearchParams(window.location.search).get("patient") || "";
    setPatientFromQuery(fromQuery.toLowerCase());
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !doctorWallet) return;
    (async () => {
      setLoading(true);
      try {
        const grants = await getGrantedPatientsForDoctor(doctorWallet);
        const wallets = Array.from(new Set(grants.map((g) => g.patient.toLowerCase())));
        setPatientWallets(wallets);
        const defaultWallet = patientFromQuery && wallets.includes(patientFromQuery) ? patientFromQuery : (wallets[0] || "");
        setSelectedPatientWallet(defaultWallet);

        // Resolve patient names in background
        const nameMap: Record<string, string> = {};
        await Promise.all(
          wallets.map(async (w) => {
            try {
              const identity = await fetchIdentityByWallet(w);
              if (identity?.title) {
                nameMap[w] = identity.title;
              } else if (identity?.lockACid) {
                // Fallback: fetch name from lockA IPFS profile
                try {
                  const lockA = (await fetchJSONFromIPFS(identity.lockACid)) as any;
                  const profileCid = lockA?.profileCid;
                  if (profileCid) {
                    const profile = (await fetchJSONFromIPFS(profileCid)) as any;
                    const profileObj = profile?.profile ?? profile;
                    if (profileObj?.name) nameMap[w] = profileObj.name;
                    else if (profileObj?.fullName) nameMap[w] = profileObj.fullName;
                  }
                } catch { /* IPFS profile fetch failed */ }
              }
            } catch { /* ignore */ }
          })
        );
        setPatientNames(nameMap);
      } catch {
        setPatientWallets([]);
        setSelectedPatientWallet("");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, doctorWallet, patientFromQuery]);

  useEffect(() => {
    if (!selectedPatientWallet) {
      setJourneys([]);
      return;
    }
    (async () => {
      const out = await getJourneys("active", selectedPatientWallet);
      const rows = (out.journeys || []) as unknown as JourneyLike[];
      const mine = rows.filter((j) => {
        if (j.allottedDoctorWallet && j.allottedDoctorWallet.toLowerCase() !== doctorWallet) return false;
        return true;
      });
      setJourneys(mine);
    })();
  }, [selectedPatientWallet, doctorWallet]);

  const currentCheckpointByJourney = useMemo(() => {
    const out: Record<string, JourneyLike["checkpoints"][number] | null> = {};
    journeys.forEach((j) => {
      // Try in_progress/in_queue first, then fall back to the first pending checkpoint
      out[j.id] =
        j.checkpoints.find((cp) => cp.status === "in_progress" || cp.status === "in_queue") ||
        j.checkpoints.find((cp) => cp.status === "pending") ||
        null;
    });
    return out;
  }, [journeys]);

  async function completeCheckpoint(journeyId: string) {
    if (!selectedPatientWallet) return;
    const details = await getJourney(journeyId, selectedPatientWallet);
    const journey = details.journey as unknown as JourneyLike;
    let cp =
      journey.checkpoints.find((x) => x.status === "in_progress" || x.status === "in_queue") ||
      journey.checkpoints.find((x) => x.status === "pending");

    // If no checkpoints exist at all, create a default consultation checkpoint
    if (!cp && journey.checkpoints.length === 0) {
      cp = {
        id: `${journeyId}-cp-1`,
        status: "in_progress",
        department: { name: "Consultation" },
      };
      journey.checkpoints.push(cp);
    }
    if (!cp) return;

    setSavingJourneyId(journeyId);
    try {
      const notes = notesByJourney[journeyId]?.trim() || "";
      const parsedOrders = parseOrders(ordersByJourney[journeyId] || "");
      const orders = parsedOrders.map((o, idx) => ({
        orderId: `${journeyId}-${cp.id}-ord-${idx + 1}`,
        testType: o.testType,
        departmentId: cp.department?.name || "department",
        status: "pending" as const,
        expectedReadyAt: o.expectedReadyAt,
      }));

      const updatedCheckpoints = journey.checkpoints.map((x) => {
        if (x.id !== cp.id) return x;
        return {
          ...x,
          status: "completed",
          completedAt: new Date().toISOString(),
          notes,
          orders,
        };
      });
      const newCheckpointsForOrders = parsedOrders.map((o, idx) => ({
        id: `${journeyId}-cp-order-${Date.now()}-${idx}`,
        sequence: updatedCheckpoints.length + idx + 1,
        status: "pending",
        department: { name: `Diagnostics: ${o.testType}` },
      }));

      const finalCheckpoints = [...updatedCheckpoints, ...newCheckpointsForOrders];

      const firstPendingIdx = finalCheckpoints.findIndex((x) => x.status === "pending");
      if (firstPendingIdx >= 0) {
        finalCheckpoints[firstPendingIdx] = {
          ...finalCheckpoints[firstPendingIdx],
          status: "in_queue",
        };
      }
      const completedCount = finalCheckpoints.filter((x) => x.status === "completed").length;
      const progressPercent = Math.round((completedCount / Math.max(finalCheckpoints.length, 1)) * 100);

      await updateJourney(
        journeyId,
        {
          checkpoints: finalCheckpoints as unknown[],
          progressPercent,
          status: progressPercent >= 100 ? "completed" : "active",
          allottedDoctorWallet: progressPercent >= 100 ? doctorWallet : "",
        },
        selectedPatientWallet
      );

      const out = await getJourneys("active", selectedPatientWallet);
      const rows = (out.journeys || []) as unknown as JourneyLike[];
      setJourneys(rows.filter((j) => {
        if (j.allottedDoctorWallet && j.allottedDoctorWallet.toLowerCase() !== doctorWallet) return false;
        // Don't show if the active checkpoint is for a completely different department (like Lab) 
        // that we just dynamically added, and we are no longer allotted to it.
        const activeCp = j.checkpoints.find((c) => c.status === "in_progress" || c.status === "in_queue") ||
          j.checkpoints.find((c) => c.status === "pending");
        if (!activeCp) return false;
        return true;
      }));
      setNotesByJourney((prev) => ({ ...prev, [journeyId]: "" }));
      setOrdersByJourney((prev) => ({ ...prev, [journeyId]: "" }));
    } finally {
      setSavingJourneyId("");
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 space-y-6">
        <Link href="/doctor/patients" className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          <ArrowLeft className="w-4 h-4" />
          {tx("Back to Patients")}
        </Link>

        <section>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{tx("Doctor Queue")}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Complete checkup, add notes, and create test orders for your allotted patients.
          </p>
        </section>

        <section className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Patient</label>
          <select
            value={selectedPatientWallet}
            onChange={(e) => setSelectedPatientWallet(e.target.value)}
            className="mt-2 w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700"
          >
            {patientWallets.length === 0 && <option value="">No granted patients</option>}
            {patientWallets.map((wallet) => (
              <option key={wallet} value={wallet}>
                {patientNames[wallet] ? `${patientNames[wallet]} — ${wallet}` : wallet}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-4">
          {journeys.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8 text-center text-neutral-500">
              No active journeys for this patient and doctor.
            </div>
          ) : (
            journeys.map((journey) => {
              const cp = currentCheckpointByJourney[journey.id];
              const busy = savingJourneyId === journey.id;
              return (
                <article key={journey.id} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {journey.hospital?.name || "Hospital"} • {journey.tokenNumber || journey.id}
                      </h2>
                      <p className="text-sm text-neutral-500">
                        Current: {cp?.department?.name || "No checkpoint"}
                      </p>
                    </div>
                    {/* Open Journey link removed */}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Consultation notes</label>
                    <textarea
                      value={notesByJourney[journey.id] || ""}
                      onChange={(e) => setNotesByJourney((prev) => ({ ...prev, [journey.id]: e.target.value }))}
                      placeholder="Doctor notes visible in patient timeline"
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Test orders</label>
                    <p className="text-xs text-neutral-500 mt-1">Format: `Blood Test@2026-02-25 14:00, MRI@2026-02-26 10:30`</p>
                    <input
                      value={ordersByJourney[journey.id] || ""}
                      onChange={(e) => setOrdersByJourney((prev) => ({ ...prev, [journey.id]: e.target.value }))}
                      placeholder="Comma separated orders"
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700"
                    />
                  </div>

                  <button
                    onClick={() => completeCheckpoint(journey.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {tx("Mark Checkup Done")}
                  </button>
                </article>
              );
            })
          )}
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <Stethoscope className="h-4 w-4 mt-0.5" />
            <p>
              Only allotted doctor checkpoints are listed. Completion writes notes and orders into the journey payload so patients can see synchronized timeline updates.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
