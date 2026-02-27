"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  Building2,
  Users,
  FileText,
  Activity,
  ArrowRight,
  Loader2,
  MapPin,
  ClipboardList,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { loadRoleProfileFromChain } from "@/lib/role-profile-registry";
import { getHospitals, getHospitalJourneys } from "@/features/hospital/api";

interface Department {
  id: string;
  name: string;
  currentQueue: number;
  maxCapacity: number;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  city: string;
  state?: string;
  departments?: Department[];
}

interface ActiveJourney {
  id: string;
  tokenNumber: string;
  status: string;
  progressPercent: number;
  patient?: { fullName?: string };
  currentCheckpoint?: { department?: { name: string } };
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export default function HospitalHomePage() {
  const { data: session, status } = useAuthSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [activeJourneys, setActiveJourneys] = useState<ActiveJourney[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (session?.user && session.user.role !== "hospital") {
      router.push(
        session.user.role === "patient"
          ? "/patient/home"
          : "/doctor/home"
      );
      return;
    }
    loadData();
  }, [status, session?.user?.role, router]);

  async function loadData() {
    setLoading(true);
    try {
      const identifier = session?.user?.email || "";
      if (identifier) {
        try {
          const profile = await loadRoleProfileFromChain(
            identifier,
            session?.user?.walletAddress || undefined
          );
          if (profile && Object.keys(profile).length > 0) {
            const departments = Array.isArray(profile.departments)
              ? profile.departments.map((d, idx) => {
                  const entry = d as Record<string, unknown>;
                  return {
                    id: typeof entry.id === "string" ? entry.id : `dept-${idx + 1}`,
                    name: typeof entry.name === "string" ? entry.name : `Department ${idx + 1}`,
                    currentQueue: toNumber(entry.currentQueue, 0),
                    maxCapacity: toNumber(entry.maxCapacity, 20),
                  };
                })
              : [];

            const hospitalId =
              typeof profile.hospitalId === "string" && profile.hospitalId.trim().length > 0
                ? profile.hospitalId
                : "self";
            setHospital({
              id: hospitalId,
              name: typeof profile.name === "string" ? profile.name : "Hospital",
              code: typeof profile.code === "string" ? profile.code : "HOSP",
              city: typeof profile.city === "string" ? profile.city : "",
              state: typeof profile.state === "string" ? profile.state : "",
              departments,
            });
            try {
              const jOut = await getHospitalJourneys(hospitalId);
              setActiveJourneys((jOut.journeys || []) as ActiveJourney[]);
            } catch {
              setActiveJourneys([]);
            }
            return;
          }
        } catch {
          // fallback to hospitals API below
        }
      }

      const data = await getHospitals({ departments: true });
      const list = (data.hospitals || []) as Hospital[];
      if (list.length > 0) {
        const linkedId =
          typeof window !== "undefined"
            ? localStorage.getItem("hospital_linked_id")
            : null;
        const chosen = linkedId
          ? list.find((h: Hospital) => h.id === linkedId)
          : null;
        const h = chosen || list[0];
        setHospital(h);
        const hid = h.id;
        const jOut = await getHospitalJourneys(hid);
        setActiveJourneys((jOut.journeys || []) as ActiveJourney[]);
      }
    } catch (e) {
      console.error("Failed to load hospital data", e);
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const totalInQueueFromDepartments =
    hospital?.departments?.reduce((s, d) => s + (d.currentQueue ?? 0), 0) ?? 0;
  const totalInQueue = Math.max(totalInQueueFromDepartments, activeJourneys.length);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.nav.home}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Queue overview and quick actions
          </p>
        </div>

        {hospital ? (
          <>
            <section className="mb-8 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {hospital.name}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {hospital.code}
                    {hospital.city && (
                      <>
                        {" · "}
                        <MapPin className="inline w-3.5 h-3.5 mr-0.5" />
                        {hospital.city}
                        {hospital.state && `, ${hospital.state}`}
                      </>
                    )}
                  </p>
                  {hospital.departments && hospital.departments.length > 0 && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                      {hospital.departments.length} department
                      {hospital.departments.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Total in queue
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {totalInQueue}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Active journeys
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {activeJourneys.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Link
                href="/hospital/admin"
                className="group flex items-center gap-4 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                  <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {t.nav.queue}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    View queue, journeys and search patient
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/hospital/upload"
                className="group flex items-center gap-4 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                  <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {t.nav.uploadRecords}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Search patient and upload reports
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>

            {activeJourneys.length > 0 && (
              <section className="mt-8 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Recent active journeys
                </h3>
                <ul className="space-y-2">
                  {activeJourneys.slice(0, 5).map((j) => (
                    <li key={j.id}>
                      <Link
                        href={`/hospital/journey/${j.id}`}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          Token #{j.tokenNumber}
                          {j.currentCheckpoint?.department?.name &&
                            ` · ${j.currentCheckpoint.department.name}`}
                        </span>
                        <ArrowRight className="w-4 h-4 text-neutral-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <section className="p-8 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-center">
            <Building2 className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">
              No hospital data. Complete registration to link your hospital.
            </p>
            <Link
              href="/hospital/register"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Register hospital
              <ArrowRight className="w-4 h-4" />
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
