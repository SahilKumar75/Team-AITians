"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  Building2, Users, Activity, TrendingUp,
  AlertCircle, CheckCircle2, Loader2, RefreshCw,
  ArrowRight, MapPin, Upload, Search, ExternalLink
} from "lucide-react";
import { getHospitals, getHospitalJourneys } from "@/features/hospital/api";
import { buildEmergencyPath } from "@/lib/public-app-url";

interface Department {
  id: string;
  name: string;
  code: string;
  currentQueue: number;
  maxCapacity: number;
  avgServiceTime: number;
  floor: number;
  wing?: string;
  /** Doctor wallet addresses in this department. */
  doctorIds?: string[];
  /** Days department is open (0=Sun … 6=Sat). */
  openDays?: number[];
  schedule?: { open: string; close: string };
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  city: string;
  departments: Department[];
}

interface ActiveJourney {
  id: string;
  tokenNumber: string;
  status: string;
  progressPercent: number;
  patient?: {
    fullName?: string;
  };
  currentCheckpoint?: {
    department: {
      name: string;
    };
  };
}

interface PatientSearchResult {
  found: boolean;
  walletAddress?: string;
  message?: string;
  patientName?: string;
  patients?: Array<{
    walletAddress: string;
    fullName?: string;
    email?: string;
    phone?: string;
  }>;
}

export default function HospitalAdminPage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [activeJourneys, setActiveJourneys] = useState<ActiveJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientSearchResults, setPatientSearchResults] = useState<PatientSearchResult[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated" && session?.user?.role !== "hospital") {
      // Redirect authenticated non-hospital users to their own portals
      router.push(
        session?.user?.role === "patient"
          ? "/patient/home"
          : "/doctor/home"
      );
      return;
    }

    if (status === "authenticated" && session?.user?.role === "hospital") {
      fetchHospitals();
    }
  }, [status, session?.user?.role, router]);

  const fetchHospitals = async () => {
    try {
      const data = await getHospitals({ departments: true });
      const list = (data.hospitals || []) as Hospital[];
      setHospitals(list);
      if (list.length > 0) {
        const linkedId =
          typeof window !== "undefined"
            ? localStorage.getItem("hospital_linked_id")
            : null;
        const chosen = linkedId
          ? list.find((h: Hospital) => h.id === linkedId)
          : null;
        const hospital = chosen || list[0];
        setSelectedHospital(hospital);
        fetchActiveJourneys(hospital.id);
      }
    } catch (error) {
      console.error("Failed to fetch hospitals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveJourneys = async (hospitalId: string) => {
    try {
      const data = await getHospitalJourneys(hospitalId);
      setActiveJourneys((data.journeys || []) as ActiveJourney[]);
    } catch (error) {
      console.error("Failed to fetch active journeys:", error);
      setActiveJourneys([]);
    }
  };

  const handleRefresh = async () => {
    if (!selectedHospital) return;

    setRefreshing(true);
    await Promise.all([
      fetchHospitals(),
      fetchActiveJourneys(selectedHospital.id)
    ]);
    setRefreshing(false);
  };

  const handlePatientSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = patientSearchQuery.trim();
    if (q.length < 2) {
      setPatientSearchResults([{ found: false, message: "Enter patient name, email, or phone (min 2 chars)." }]);
      return;
    }
    if (!selectedHospital?.id) {
      setPatientSearchResults([{ found: false, message: "Hospital context missing." }]);
      return;
    }
    setPatientSearching(true);
    setPatientSearchResults([]);
    try {
      const res = await fetch(
        `/api/hospital/patient-search?q=${encodeURIComponent(q)}&hospitalId=${encodeURIComponent(selectedHospital.id)}`
      );
      const data = await res.json();
      if (data.found) {
        setPatientSearchResults([data as PatientSearchResult]);
      } else {
        setPatientSearchResults([{ found: false, message: data.message || "No patient found for this hospital." }]);
      }
    } catch {
      setPatientSearchResults([{ found: false, message: "Search failed. Please try again." }]);
    } finally {
      setPatientSearching(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const totalQueueFromDepartments = selectedHospital?.departments.reduce((sum, d) => sum + d.currentQueue, 0) || 0;
  const totalQueue = Math.max(totalQueueFromDepartments, activeJourneys.length);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
              Hospital Queue Management
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Monitor and manage patient journeys in real-time
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/hospital/upload"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Upload className="w-4 h-4" />
              Bulk upload
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Hospital sees only their hospital (linked_id or first); no "Select Hospital" in hospital role per docs */}
        {selectedHospital ? (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Total in Queue</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{totalQueue}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Active Journeys</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{activeJourneys.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Departments</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {selectedHospital.departments.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Manage patients */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-8">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Manage patients
                </h2>
                <p className="text-sm text-neutral-500 mt-1">Search by patient name, email, or phone. Only patients who have journeyed in this hospital are listed.</p>
              </div>
              <div className="p-6">
                <form onSubmit={handlePatientSearch} className="flex gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Patient name, email, or phone"
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={patientSearching}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    <Search className="w-4 h-4" />
                    {patientSearching ? "Searching…" : "Search"}
                  </button>
                </form>
                {patientSearchResults.length > 0 && (
                  <div className="space-y-2">
                    {patientSearchResults[0].found ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm font-medium">Eligible patient matches</span>
                        </div>
                        {(patientSearchResults[0].patients || []).map((patient) => (
                          <div
                            key={patient.walletAddress}
                            className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-600"
                          >
                            <div>
                              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                {patient.fullName || "Patient"}
                              </p>
                              <p className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
                                {patient.walletAddress.slice(0, 10)}…{patient.walletAddress.slice(-6)}
                              </p>
                              {(patient.email || patient.phone) && (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {[patient.email, patient.phone].filter(Boolean).join(" • ")}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={`/hospital/upload?q=${encodeURIComponent(patient.email || patient.phone || patient.fullName || "")}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                              >
                                <Upload className="w-4 h-4" />
                                Upload records
                              </Link>
                              <Link
                                href={buildEmergencyPath(patient.walletAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
                              >
                                <ExternalLink className="w-4 h-4" />
                                View emergency
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500">
                        {patientSearchResults[0].message || "No patient found for this hospital."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Department Queue Status */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 mb-8">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Department Queue Status
                </h2>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {selectedHospital.departments.map((dept) => {
                  // Dynamically calculate current queue size for this department based on active journeys
                  const dynamicQueue = activeJourneys.filter(
                    (j) => j.status !== "completed" && j.currentCheckpoint?.department?.name === dept.name
                  ).length;

                  const utilization = dept.maxCapacity > 0 ? (dynamicQueue / dept.maxCapacity) * 100 : 0;
                  const status = utilization < 50 ? 'low' : utilization < 80 ? 'medium' : 'high';
                  const statusColor = {
                    low: 'text-green-600 bg-green-50 dark:bg-green-900/30',
                    medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30',
                    high: 'text-red-600 bg-red-50 dark:bg-red-900/30'
                  }[status];

                  return (
                    <div key={dept.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {dept.name}
                            </h3>
                            <span className="text-xs text-neutral-500">
                              Floor {dept.floor}{dept.wing && `, Wing ${dept.wing}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                            <span>Queue: {dynamicQueue}/{dept.maxCapacity}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32">
                            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${status === 'low' ? 'bg-green-500' : status === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-neutral-500 mt-1">{Math.round(utilization)}% capacity</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                            {status === 'low' ? 'Low' : status === 'medium' ? 'Medium' : 'High'} Load
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Journeys */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Active Patient Journeys
                </h2>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {activeJourneys.length === 0 ? (
                  <div className="p-12 text-center text-neutral-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No active journeys at the moment</p>
                  </div>
                ) : (
                  activeJourneys.map((journey) => (
                    <Link
                      key={journey.id}
                      href={`/hospital/journey/${journey.id}`}
                      className="block p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {journey.patient?.fullName || 'Patient'}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-neutral-500 mt-1">
                              <span className="font-mono">{journey.tokenNumber}</span>
                              {journey.currentCheckpoint && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {journey.currentCheckpoint.department?.name || "Department"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                              {journey.progressPercent}%
                            </div>
                            <div className="w-24 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${journey.progressPercent}%` }}
                              />
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-500 transition" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-12 text-center border border-neutral-200 dark:border-neutral-700">
            <AlertCircle className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">
              No hospitals configured yet
            </p>
            <p className="text-neutral-500 text-sm mt-2">
              Contact administrator to set up hospital data
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
