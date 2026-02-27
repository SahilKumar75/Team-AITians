"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import JourneyTracker from "@/components/JourneyTracker";
import {
  Plus, MapPin, Clock, CheckCircle2, AlertCircle,
  Calendar, ArrowRight, Loader2
} from "lucide-react";
import { getJourneys } from "@/features/journey/api";

interface Journey {
  id: string;
  tokenNumber: string;
  visitType: string;
  chiefComplaint?: string;
  departmentNames?: string[];
  departmentIds?: string[];
  allottedDoctorName?: string;
  allottedDoctorWallet?: string;
  status: string;
  progressPercent: number;
  startedAt: string;
  completedAt?: string;
  hospital: { id: string; name: string; code: string; city: string };
  checkpoints: unknown[];
}

function formatVisitType(value?: string): string {
  if (!value) return "General";
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PatientJourneyPage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [filter, setFilter] = useState<"active" | "completed" | "all">("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      setLoading(false);
      return;
    }
    if (status === "authenticated") fetchJourneys();
  }, [status, filter, router]);

  const fetchJourneys = async () => {
    try {
      const wallet = session?.user?.walletAddress ?? null;
      const data = await getJourneys(filter, wallet);
      setJourneys(data.journeys || []);
      const active = (data.journeys || []).find((j: Journey) => j.status === "active");
      setActiveJourney(active || null);
    } catch (error) {
      console.error("Failed to fetch journeys:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
              My Hospital Visits
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Track your journey through the hospital in real-time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/patient/timeline"
              className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl font-semibold border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
            >
              <Clock className="w-5 h-5" />
              Timeline
            </Link>
            <Link
              href="/patient/journey/start"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-5 h-5" />
              Start New Visit
            </Link>
          </div>
        </div>

        {activeJourney && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                Active Journey
              </h2>
            </div>
            <JourneyTracker
              journeyId={activeJourney.id}
              onShare={() => router.push(`/patient/journey/${activeJourney.id}`)}
            />
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {(["all", "active", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === tab
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {journeys.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <MapPin className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              No Hospital Visits Yet
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Start a new visit to track your journey through the hospital
            </p>
            <Link
              href="/patient/journey/start"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Start Your First Visit
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {journeys
              .filter((j) => !activeJourney || j.id !== activeJourney.id)
              .map((journey) => (
                <Link
                  key={journey.id}
                  href={`/patient/journey/${journey.id}`}
                  className="block bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 hover:border-blue-500 dark:hover:border-blue-500 transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          journey.status === "completed"
                            ? "bg-green-100 dark:bg-green-900/30"
                            : journey.status === "active"
                              ? "bg-blue-100 dark:bg-blue-900/30"
                              : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      >
                        {journey.status === "completed" ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : journey.status === "active" ? (
                          <MapPin className="w-6 h-6 text-blue-600" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {journey.hospital?.name || "Hospital"}
                          </h3>
                          <span className="text-xs px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded-full text-neutral-600 dark:text-neutral-400">
                            {journey.tokenNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-neutral-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(journey.startedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {(journey.checkpoints || []).length} stops
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {formatVisitType(journey.visitType)}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            Doctor: {journey.allottedDoctorName || journey.allottedDoctorWallet || "Not selected"}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Departments: {((journey.departmentNames?.length ? journey.departmentNames : journey.departmentIds) || []).join(", ") || "Not selected"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                          {journey.progressPercent}%
                        </div>
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              journey.status === "completed" ? "bg-green-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${journey.progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-500 transition" />
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
