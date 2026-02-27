"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/contexts/AuthContext";
import { getJourneys } from "@/features/journey/api";
import { CalendarClock, ClipboardList, FlaskConical, Loader2, UserRound, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type JourneyLike = {
  id: string;
  tokenNumber: string;
  startedAt: string;
  hospital?: { name?: string };
  checkpoints?: Array<{
    id: string;
    department?: { name?: string };
    status?: string;
    completedAt?: string;
    notes?: string;
    orders?: Array<{
      orderId?: string;
      testType?: string;
      status?: string;
      expectedReadyAt?: number;
      recordId?: string;
      doneAt?: string;
    }>;
  }>;
};

type TimelineEntry = {
  id: string;
  when: number;
  title: string;
  subtitle: string;
};

export default function PatientTimelinePage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [journeys, setJourneys] = useState<JourneyLike[]>([]);
  const { tx } = useLanguage();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      try {
        const wallet = session?.user?.walletAddress ?? null;
        const out = await getJourneys("all", wallet);
        setJourneys((out.journeys || []) as JourneyLike[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session?.user?.walletAddress, router]);

  const entries = useMemo(() => {
    const out: TimelineEntry[] = [];
    journeys.forEach((journey) => {
      const startAt = new Date(journey.startedAt || Date.now()).getTime();
      out.push({
        id: `${journey.id}-start`,
        when: startAt,
        title: `Visit started at ${journey.hospital?.name || "Hospital"}`,
        subtitle: `Token ${journey.tokenNumber}`,
      });

      (journey.checkpoints || []).forEach((cp) => {
        const cpTime = cp.completedAt ? new Date(cp.completedAt).getTime() : startAt;
        if (cp.notes) {
          out.push({
            id: `${journey.id}-${cp.id}-notes`,
            when: cpTime,
            title: `Doctor note • ${cp.department?.name || "Department"}`,
            subtitle: cp.notes,
          });
        }
        (cp.orders || []).forEach((order, idx) => {
          const eta = order.expectedReadyAt ? new Date(order.expectedReadyAt).toLocaleString("en-IN") : "TBD";
          let statusText = order.status || "pending";
          if (statusText === "pending" && order.expectedReadyAt && order.expectedReadyAt < Date.now()) {
            statusText = "overdue";
          }
          const orderedWhen = cpTime + idx;
          out.push({
            id: `${journey.id}-${cp.id}-order-${order.orderId || idx}`,
            when: orderedWhen,
            title: `Test ordered: ${order.testType || "Diagnostic test"}`,
            subtitle: `Status: ${statusText} • Expected: ${eta}`,
          });
          if (order.status === "done") {
            const doneTs = order.doneAt ? new Date(order.doneAt).getTime() : orderedWhen + 1;
            out.push({
              id: `${journey.id}-${cp.id}-order-done-${order.orderId || idx}`,
              when: doneTs,
              title: `Test completed: ${order.testType || "Diagnostic test"}`,
              subtitle: `Completed ${order.doneAt ? new Date(order.doneAt).toLocaleString("en-IN") : "just now"}`,
            });
          }
        });
      });
    });
    return out.sort((a, b) => b.when - a.when);
  }, [journeys]);

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <Link
          href="/patient/journey"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {tx("Back to Journeys")}
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{tx("Patient Timeline")}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Unified timeline across visits, doctor notes, and ordered tests.
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-10 text-center">
            <ClipboardList className="h-12 w-12 text-neutral-400 mx-auto mb-3" />
            <p className="text-neutral-600 dark:text-neutral-400">No timeline events yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">{entry.title}</h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{entry.subtitle}</p>
                  </div>
                  <span className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Date(entry.when).toLocaleString("en-IN")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <Link href="/patient/journey" className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 flex items-center gap-2 text-sm">
            <CalendarClock className="w-4 h-4" />
            {tx("Visits")}
          </Link>
          <Link href="/patient/records" className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 flex items-center gap-2 text-sm">
            <FlaskConical className="w-4 h-4" />
            {tx("Medical Records")}
          </Link>
          <Link href="/patient/family" className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 flex items-center gap-2 text-sm">
            <UserRound className="w-4 h-4" />
            {tx("Family Sharing")}
          </Link>
        </div>
      </main>
    </div>
  );
}
