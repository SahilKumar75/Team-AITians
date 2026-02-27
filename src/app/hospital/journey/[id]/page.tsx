"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import {
  ArrowLeft, CheckCircle2, Clock,
  Loader2, AlertCircle, User
} from "lucide-react";
import Link from "next/link";
import { getJourney } from "@/features/journey/api";

interface Checkpoint {
  id: string;
  sequence: number;
  status: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  department: {
    id: string;
    name: string;
    code: string;
    floor: number;
    wing?: string;
  };
  notes?: string;
  orders?: Array<{
    orderId?: string;
    testType?: string;
    status?: "pending" | "done";
    doneAt?: string;
    expectedReadyAt?: number;
  }>;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

interface Journey {
  id: string;
  tokenNumber: string;
  visitType: string;
  status: string;
  progressPercent: number;
  patient?: {
    fullName?: string;
    phone?: string;
  };
  hospital: {
    name: string;
  };
  checkpoints: Checkpoint[];
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
  in_queue: { label: "In Queue", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" },
  in_progress: { label: "In Progress", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  completed: { label: "Completed", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" },
  skipped: { label: "Skipped", color: "bg-gray-100 dark:bg-gray-800 text-gray-500" }
};
const defaultStatus = { label: "Pending", color: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300" };

export default function StaffJourneyPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session, status: authStatus } = useAuthSession();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const isHospitalRole = session?.user?.role === "hospital";

    if (authStatus === "unauthenticated" && !isHospitalRole) {
      router.push("/auth/login");
      return;
    }

    if (authStatus === "authenticated" && !isHospitalRole) {
      router.push(
        session?.user?.role === "patient"
          ? "/patient/home"
          : "/doctor/home"
      );
      return;
    }

    if ((authStatus === "authenticated" && isHospitalRole) || (authStatus === "unauthenticated" && isHospitalRole)) {
      fetchJourney();
    }
  }, [authStatus, session?.user?.role, session?.user?.walletAddress, params.id, router]);

  const fetchJourney = async () => {
    try {
      const data = await getJourney(params.id);
      setJourney(data.journey as Journey);
      setError("");
    } catch {
      setError("Failed to load journey");
    } finally {
      setLoading(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !journey) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!journey) return null;

  const currentCheckpoint = journey.checkpoints.find(
    c => c.status === 'in_queue' || c.status === 'in_progress'
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 pt-24">
        {/* Back Button */}
        <Link
          href="/hospital/admin"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Patient Info Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <User className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {journey.patient?.fullName || 'Patient'}
                </h2>
                <p className="text-neutral-500">Token: {journey.tokenNumber}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {journey.progressPercent}%
              </div>
              <p className="text-sm text-neutral-500">Complete</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div>
              <p className="text-sm text-neutral-500">Hospital</p>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{journey.hospital.name}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Visit Type</p>
              <p className="font-medium text-neutral-900 dark:text-neutral-100 capitalize">{journey.visitType}</p>
            </div>
          </div>
        </div>

        {/* Current Action */}
        {currentCheckpoint && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-500 p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
              Current Checkpoint
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                  {currentCheckpoint.department?.name || "Department"}
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Floor {currentCheckpoint.department?.floor ?? "—"}
                  {currentCheckpoint.department?.wing && `, Wing ${currentCheckpoint.department.wing}`}
                </p>
                <div className="mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${(statusConfig[currentCheckpoint.status as keyof typeof statusConfig] || defaultStatus).color}`}>
                    {(statusConfig[currentCheckpoint.status as keyof typeof statusConfig] || defaultStatus).label}
                  </span>
                </div>
              </div>
              <p className="text-sm text-neutral-500 max-w-xs text-right">
                Status updates are handled by the assigned doctor workflow.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-6 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 inline mr-2" />
            {error}
          </div>
        )}

        {/* All Checkpoints */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Journey Timeline
            </h3>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {journey.checkpoints.map((checkpoint, index) => {
              const config = statusConfig[checkpoint.status as keyof typeof statusConfig] || defaultStatus;
              const isLast = index === journey.checkpoints.length - 1;

              return (
                <div key={checkpoint.id} className="p-4 relative">
                  {/* Connecting Line */}
                  {!isLast && (
                    <div className="absolute left-8 top-14 w-0.5 h-full bg-neutral-200 dark:bg-neutral-700" />
                  )}

                  <div className="flex items-start gap-4">
                    {/* Status Indicator */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                      checkpoint.status === 'completed' ? 'bg-green-500' :
                      checkpoint.status === 'in_progress' ? 'bg-blue-500' :
                      checkpoint.status === 'in_queue' ? 'bg-yellow-500' :
                      'bg-gray-300'
                    }`}>
                      {checkpoint.status === 'completed' && (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      )}
                      {checkpoint.status === 'in_progress' && (
                        <Clock className="w-5 h-5 text-white animate-pulse" />
                      )}
                      {checkpoint.status === 'in_queue' && (
                        <Clock className="w-5 h-5 text-white" />
                      )}
                    </div>

                    {/* Checkpoint Info */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {checkpoint.department?.name || "Department"}
                          </h4>
                          <p className="text-sm text-neutral-500">
                            Step {checkpoint.sequence} • Floor {checkpoint.department?.floor ?? "—"}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                      </div>

                      {/* Timing */}
                      {(checkpoint.arrivedAt || checkpoint.startedAt || checkpoint.completedAt) && (
                        <div className="flex gap-4 text-xs text-neutral-500 mt-2">
                          {checkpoint.arrivedAt && (
                            <span>
                              Arrived: {new Date(checkpoint.arrivedAt).toLocaleTimeString()}
                            </span>
                          )}
                          {checkpoint.startedAt && (
                            <span>
                              Started: {new Date(checkpoint.startedAt).toLocaleTimeString()}
                            </span>
                          )}
                          {checkpoint.completedAt && (
                            <span>
                              Completed: {new Date(checkpoint.completedAt).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      )}

                      {checkpoint.orders && checkpoint.orders.length > 0 && (
                        <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300 mb-2">
                            Test Orders
                          </p>
                          <ul className="space-y-2">
                            {checkpoint.orders.map((order, idx) => (
                              <li
                                key={order.orderId || `${checkpoint.id}-order-${idx}`}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span className={order.status === "done" ? "line-through text-neutral-500" : "text-neutral-800 dark:text-neutral-100"}>
                                  {order.testType || "Diagnostic test"}
                                </span>
                                {order.status === "done" ? (
                                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    Done {order.doneAt ? new Date(order.doneAt).toLocaleString("en-IN") : ""}
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    Pending
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
