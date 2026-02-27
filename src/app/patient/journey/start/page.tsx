"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import Link from "next/link";
import { getHospitals } from "@/features/hospital/api";
import { createJourney } from "@/features/journey/api";
import { Navbar } from "@/components/Navbar";
import {
  ArrowLeft, Building2, MapPin, CheckCircle2,
  Search, Loader2, AlertCircle, ChevronRight, Navigation,
  Stethoscope, ClipboardList, TestTube, Ambulance
} from "lucide-react";
import { loadUnifiedPatientProfile, saveUnifiedPatientProfile } from "@/lib/patient-data-source";

interface Department {
  id: string;
  name: string;
  code?: string;
  type: string;
  floor: number;
  wing?: string;
  avgServiceTime: number;
  currentQueue: number;
  maxCapacity: number;
  /** Doctor wallet addresses in this department. Enables "all doctors of this department". */
  doctorIds?: string[];
  /** Days department is open (0=Sun … 6=Sat). Enables OPD schedule (e.g. closed Monday). */
  openDays?: number[];
  schedule?: { open: string; close: string };
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  address?: string;
  city: string;
  state: string;
  type: string;
  departments?: Department[];
}

interface DoctorOption {
  id: string;
  name: string;
  specialization?: string;
  hospital?: string;
  walletAddress: string;
  email?: string;
}

const visitTypes = [
  { id: "opd", label: "OPD Visit", Icon: Stethoscope, description: "General outpatient consultation" },
  { id: "follow-up", label: "Follow-up", Icon: ClipboardList, description: "Returning for scheduled follow-up" },
  { id: "diagnostic", label: "Diagnostic", Icon: TestTube, description: "Tests, X-rays, or scans" },
  { id: "emergency", label: "Emergency", Icon: Ambulance, description: "Urgent medical attention" },
];

const departmentTypeOrder = ["registration", "consultation", "diagnostic", "pharmacy", "billing"];

export default function StartJourneyPage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const [step, setStep] = useState(1);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [selectedVisitType, setSelectedVisitType] = useState<string>("opd");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedDoctorWallet, setSelectedDoctorWallet] = useState("");
  const [lastDoctorSeen, setLastDoctorSeen] = useState<Array<{
    doctorWallet: string;
    doctorName?: string;
    hospitalId?: string;
    departmentId?: string;
    lastSeenAt?: number;
  }>>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
    if (status === "authenticated") fetchHospitals();
  }, [status, router]);

  const fetchHospitals = async () => {
    try {
      const data = await getHospitals({ departments: true });
      setHospitals((data.hospitals || []) as Hospital[]);
    } catch (err) {
      console.error("Failed to fetch hospitals:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setDoctors([]);
    setSelectedDoctorWallet("");
    if (hospital.departments) {
      const defaultDepts = hospital.departments
        .filter((d) => {
          if (selectedVisitType === "opd")
            return ["registration", "consultation", "pharmacy"].includes(d.type);
          if (selectedVisitType === "diagnostic")
            return ["registration", "diagnostic", "billing"].includes(d.type);
          return true;
        })
        .sort((a, b) => departmentTypeOrder.indexOf(a.type) - departmentTypeOrder.indexOf(b.type))
        .map((d) => d.id);
      setSelectedDepartments(defaultDepts);
    }
    setStep(2);
  };

  const selectedDepartmentObjects = useMemo(() => {
    if (!selectedHospital?.departments) return [];
    return selectedHospital.departments.filter((d) => selectedDepartments.includes(d.id));
  }, [selectedHospital?.departments, selectedDepartments]);

  const doctorWalletCandidates = useMemo(() => {
    const wallets = new Set<string>();
    selectedDepartmentObjects.forEach((d) => {
      (d.doctorIds || []).forEach((w) => {
        if (typeof w === "string" && w.trim()) wallets.add(w.toLowerCase());
      });
    });
    return Array.from(wallets);
  }, [selectedDepartmentObjects]);

  useEffect(() => {
    async function loadDoctorContext() {
      if (!selectedHospital) {
        setDoctors([]);
        setSelectedDoctorWallet("");
        return;
      }
      setDoctorsLoading(true);
      try {
        let responses: Array<(DoctorOption & { walletAddress: string }) | null> = [];
        const res = await fetch(
          `/api/hospital/doctors?hospitalId=${encodeURIComponent(selectedHospital.id)}&hospitalName=${encodeURIComponent(selectedHospital.name || "")}`
        );
        if (res.ok) {
          const json = (await res.json()) as { doctors?: DoctorOption[] };
          const rows = Array.isArray(json.doctors) ? json.doctors : [];
          const candidateSet = new Set(doctorWalletCandidates.map((w) => w.toLowerCase()));
          responses = rows
            .filter((doc) => {
              if (candidateSet.size === 0) return true;
              const wallet = (doc?.walletAddress || "").toLowerCase();
              return !!wallet && candidateSet.has(wallet);
            })
            .map((doc) =>
              doc?.walletAddress
                ? { ...doc, walletAddress: doc.walletAddress.toLowerCase() }
                : null
            );
        }

        const dedup = new Map<string, DoctorOption>();
        responses.forEach((d) => {
          if (!d?.walletAddress) return;
          dedup.set(d.walletAddress.toLowerCase(), d);
        });
        const list = Array.from(dedup.values());
        setDoctors(list);
        if (list.length > 0 && !selectedDoctorWallet) {
          setSelectedDoctorWallet(list[0].walletAddress);
        }
      } catch {
        setDoctors([]);
      } finally {
        setDoctorsLoading(false);
      }
    }
    loadDoctorContext();
  }, [selectedHospital?.id, doctorWalletCandidates.join(",")]);

  useEffect(() => {
    async function loadLastSeen() {
      const wallet = session?.user?.walletAddress ?? "";
      const email = session?.user?.email ?? "";
      if (!wallet || !email) return;
      try {
        const profile = await loadUnifiedPatientProfile(wallet, email);
        setLastDoctorSeen((profile as unknown as { lastDoctorsSeen?: Array<{
          doctorWallet: string;
          doctorName?: string;
          hospitalId?: string;
          departmentId?: string;
          lastSeenAt?: number;
        }> }).lastDoctorsSeen || []);
      } catch {
        setLastDoctorSeen([]);
      }
    }
    if (status === "authenticated") loadLastSeen();
  }, [status, session?.user?.walletAddress, session?.user?.email]);

  const doctorBadge = (wallet: string): string | null => {
    const normalized = wallet.toLowerCase();
    const entries = lastDoctorSeen.filter((d) => d.doctorWallet?.toLowerCase() === normalized);
    if (entries.length === 0) return null;
    if (entries.length > 1) return "Frequent doctor";
    return "Old doctor";
  };

  const handleToggleDepartment = (deptId: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleStartJourney = async () => {
    if (!selectedHospital || selectedDepartments.length === 0) {
      setError("Please select at least one department");
      return;
    }
    if (doctors.length > 0 && !selectedDoctorWallet) {
      setError("Please select a doctor for this department.");
      return;
    }
    setSubmitting(true);
    setError("");
    const wallet = session?.user?.walletAddress ?? null;
    try {
      const data = await createJourney(
        {
          hospitalId: selectedHospital.id,
          visitType: selectedVisitType,
          chiefComplaint,
          departmentIds: selectedDepartments,
          allottedDoctorWallet: selectedDoctorWallet || undefined,
        },
        wallet
      );
      if (data?.journey?.id) {
        if (wallet) {
          const now = Date.now();
          const selectedDoctor = doctors.find((d) => d.walletAddress === selectedDoctorWallet);
          const journeyEntry = {
            journeyId: data.journey.id,
            hospitalId: selectedHospital.id,
            hospitalName: selectedHospital.name,
            tokenNumber: data.journey.tokenNumber,
            status: data.journey.status || "active",
            progressPercent: typeof data.journey.progressPercent === "number" ? data.journey.progressPercent : 0,
            startedAt: now,
            visitType: selectedVisitType,
            chiefComplaint: chiefComplaint || "",
            departmentIds: selectedDepartments,
            departmentNames: selectedDepartmentObjects.map((d) => d.name),
            allottedDoctorWallet: selectedDoctorWallet || "",
            allottedDoctorName: selectedDoctor?.name || "",
          };
          const profile = await loadUnifiedPatientProfile(wallet, session?.user?.email ?? "");
          const existingJourneyHistory = Array.isArray((profile as unknown as { journeyHistory?: unknown[] }).journeyHistory)
            ? ((profile as unknown as { journeyHistory?: unknown[] }).journeyHistory as Array<Record<string, unknown>>)
            : [];
          const nextJourneyHistory = [
            journeyEntry,
            ...existingJourneyHistory.filter((entry) => {
              const hid = typeof entry?.hospitalId === "string" ? entry.hospitalId : "";
              return hid.toLowerCase() !== selectedHospital.id.toLowerCase();
            }),
          ].slice(0, 20);

          if (selectedDoctorWallet) {
            const merged = [
              {
                doctorWallet: selectedDoctorWallet as `0x${string}`,
                doctorName: selectedDoctor?.name || "Doctor",
                hospitalId: selectedHospital.id,
                departmentId: selectedDepartments[0],
                lastSeenAt: now,
              },
              ...lastDoctorSeen.filter((d) => d.doctorWallet.toLowerCase() !== selectedDoctorWallet.toLowerCase()),
            ].slice(0, 12);

            await saveUnifiedPatientProfile(wallet, {
              lastDoctorsSeen: merged as unknown[],
              journeyHistory: nextJourneyHistory,
            });
          } else {
            await saveUnifiedPatientProfile(wallet, {
              journeyHistory: nextJourneyHistory,
            });
          }
        }
        router.push(`/patient/journey/${data.journey.id}`);
      } else {
        setError("Failed to start journey");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start journey");
    } finally {
      setSubmitting(false);
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <Link
          href="/patient/journey"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Journeys
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            Start Hospital Visit
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {step === 1 ? "Select a hospital to begin your journey" : "Customize your visit path"}
          </p>
        </div>

        <div className="flex items-center gap-4 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  s < step
                    ? "bg-green-500 text-white"
                    : s === step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                }`}
              >
                {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 rounded ${s < step ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search hospitals by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {filteredHospitals.length === 0 ? (
              <div className="py-6 text-center">
                <Building2 className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                <p className="text-neutral-600 dark:text-neutral-400">
                  {hospitals.length === 0
                    ? "No hospitals available. Contact support to add your hospital."
                    : "No hospitals match your search"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredHospitals.map((hospital) => (
                  <button
                    key={hospital.id}
                    onClick={() => handleSelectHospital(hospital)}
                    className="w-full text-left bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 hover:border-blue-500 dark:hover:border-blue-500 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                          <Building2 className="w-7 h-7 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-lg">
                            {hospital.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-neutral-500 mt-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {hospital.city}, {hospital.state}
                            </span>
                            <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded-full text-xs">
                              {hospital.type}
                            </span>
                          </div>
                          {hospital.departments && (
                            <p className="text-xs text-neutral-400 mt-1">
                              {hospital.departments.length} departments available
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 text-neutral-400 group-hover:text-blue-500 transition" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedHospital && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      {selectedHospital.name}
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {selectedHospital.city}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedHospital(null);
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Type of Visit
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {visitTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedVisitType(type.id)}
                    className={`p-4 rounded-xl border-2 text-left transition ${
                      selectedVisitType === type.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                    }`}
                  >
                    <type.Icon className="w-8 h-8 text-blue-600" />
                    <h4 className="font-semibold mt-2">{type.label}</h4>
                    <p className="text-sm text-neutral-500 mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                What brings you here today? (Optional)
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g., Fever for 3 days, headache..."
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={3}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Your Journey Path
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Select the departments you need to visit (in order)
              </p>

              {selectedHospital.departments && selectedHospital.departments.length > 0 ? (
                <div className="space-y-2">
                  {selectedHospital.departments
                    .sort(
                      (a, b) =>
                        departmentTypeOrder.indexOf(a.type) - departmentTypeOrder.indexOf(b.type)
                    )
                    .map((dept) => {
                      const isSelected = selectedDepartments.includes(dept.id);
                      const orderIndex = selectedDepartments.indexOf(dept.id);
                      const maxCap = dept.maxCapacity || 10;
                      const queueLevel =
                        dept.currentQueue < maxCap * 0.5
                          ? "Low"
                          : dept.currentQueue < maxCap * 0.8
                            ? "Medium"
                            : "High";
                      return (
                        <button
                          key={dept.id}
                          onClick={() => handleToggleDepartment(dept.id)}
                          className={`w-full p-4 rounded-xl border-2 text-left transition flex items-center justify-between ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {isSelected && (
                              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                                {orderIndex + 1}
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold">{dept.name}</h4>
                              <p className="text-sm text-neutral-500">
                                Floor {dept.floor}
                                {dept.wing && `, Wing ${dept.wing}`} • ~{dept.avgServiceTime} min •
                                Queue: {dept.currentQueue}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              queueLevel === "Low"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : queueLevel === "Medium"
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                          >
                            {queueLevel} wait
                          </span>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-yellow-700 dark:text-yellow-300">
                  <AlertCircle className="w-5 h-5 inline mr-2" />
                  No departments configured for this hospital yet
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                Select Doctor
              </h3>
              {doctorsLoading ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading doctors for selected departments...
                </div>
              ) : doctors.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 text-sm text-neutral-500">
                  No mapped doctors found for selected departments. You can continue and assign later.
                </div>
              ) : (
                <div className="grid gap-2">
                  {doctors.map((doctor) => {
                    const selected = selectedDoctorWallet === doctor.walletAddress;
                    const badge = doctorBadge(doctor.walletAddress);
                    return (
                      <button
                        key={doctor.walletAddress}
                        onClick={() => setSelectedDoctorWallet(doctor.walletAddress)}
                        className={`w-full p-4 rounded-xl border text-left transition ${
                          selected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-neutral-100">{doctor.name}</p>
                            <p className="text-xs text-neutral-500">{doctor.specialization || "Verified clinician"}</p>
                            <p className="text-xs text-neutral-500 font-mono mt-1">{doctor.walletAddress}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {badge && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                {badge}
                              </span>
                            )}
                            {selected && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-600 text-white">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-red-700 dark:text-red-300">
                <AlertCircle className="w-5 h-5 inline mr-2" />
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-xl font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
              >
                Back
              </button>
              <button
                onClick={handleStartJourney}
                disabled={submitting || selectedDepartments.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
                Start Journey
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
