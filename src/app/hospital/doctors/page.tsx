"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Loader2, Stethoscope, Mail, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Doctor {
  id: string;
  name: string;
  email?: string;
  specialization?: string;
  walletAddress?: string;
  departmentIds?: string[];
}

interface Department {
  id: string;
  name: string;
  doctorIds?: string[];
}

interface Hospital {
  id: string;
  hospitalId?: string;
  name: string;
  code: string;
  city?: string;
  state?: string;
  doctors?: Doctor[];
  departments?: Department[];
}

export default function HospitalDoctorsPage() {
  const { data: session, status } = useAuthSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (status === "loading") return;
    const isHospital = session?.user?.role === "hospital";
    if (status === "unauthenticated" && !isHospital) {
      router.push("/");
      return;
    }
    if (session?.user && session.user.role !== "hospital" && !isHospital) {
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
      const wallet = session?.user?.walletAddress || "";
      const identifier = session?.user?.email || "";
      const linkedHospitalId =
        typeof window !== "undefined" ? localStorage.getItem("hospital_linked_id") || "" : "";

      const qs = new URLSearchParams();
      if (wallet) qs.set("wallet", wallet);
      if (identifier) qs.set("identifier", identifier);
      const profileRes = await fetch(`/api/hospital/profile?${qs.toString()}`);
      if (!profileRes.ok) {
        setHospital(null);
        return;
      }
      const profileData = await profileRes.json();
      const hProfile = (profileData?.hospital || {}) as Hospital;
      let resolvedHospitalId =
        (typeof hProfile.hospitalId === "string" && hProfile.hospitalId.trim()) ||
        (typeof hProfile.id === "string" && hProfile.id.trim()) ||
        linkedHospitalId ||
        "";
      let resolvedHospitalName = typeof hProfile.name === "string" ? hProfile.name.trim() : "";

      let h: Hospital = {
        id: resolvedHospitalId || "self",
        hospitalId: resolvedHospitalId || "self",
        name: resolvedHospitalName || "Hospital",
        code: typeof hProfile.code === "string" ? hProfile.code : "HOSP",
        city: typeof hProfile.city === "string" ? hProfile.city : "",
        state: typeof hProfile.state === "string" ? hProfile.state : "",
        departments: Array.isArray(hProfile.departments) ? hProfile.departments : [],
        doctors: [],
      };

      if (!resolvedHospitalId || !resolvedHospitalName || h.departments.length === 0) {
        try {
          const listRes = await fetch("/api/hospitals-list?departments=true");
          if (listRes.ok) {
            const listData = await listRes.json();
            const hospitals = Array.isArray(listData?.hospitals) ? (listData.hospitals as Hospital[]) : [];
            const matched =
              hospitals.find((x) => (x.id || "").toLowerCase() === resolvedHospitalId.toLowerCase()) ||
              hospitals.find((x) => (x.id || "").toLowerCase() === linkedHospitalId.toLowerCase()) ||
              hospitals.find((x) => resolvedHospitalName && (x.name || "").toLowerCase() === resolvedHospitalName.toLowerCase()) ||
              (hospitals.length === 1 ? hospitals[0] : null);
            if (matched) {
              resolvedHospitalId = matched.id || resolvedHospitalId;
              resolvedHospitalName = matched.name || resolvedHospitalName;
              h = {
                ...h,
                id: matched.id || h.id,
                hospitalId: matched.id || h.hospitalId,
                name: matched.name || h.name,
                code: matched.code || h.code,
                city: matched.city || h.city,
                state: matched.state || h.state,
                departments: Array.isArray(matched.departments) ? matched.departments : h.departments,
              };
            }
          }
        } catch {
          // keep current hospital context
        }
      }

      const doctorsParams = new URLSearchParams();
      if (resolvedHospitalId) doctorsParams.set("hospitalId", resolvedHospitalId);
      if (h.name) doctorsParams.set("hospitalName", h.name);
      const doctorsRes = await fetch(
        `/api/hospital/doctors?${doctorsParams.toString()}`
      );
      if (doctorsRes.ok) {
        const doctorsData = await doctorsRes.json();
        h.doctors = Array.isArray(doctorsData?.doctors) ? doctorsData.doctors : [];
      }
      if ((h.doctors?.length || 0) === 0 && h.name) {
        const retryRes = await fetch(`/api/hospital/doctors?hospitalName=${encodeURIComponent(h.name)}`);
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          h.doctors = Array.isArray(retryData?.doctors) ? retryData.doctors : h.doctors;
        }
      }
      setHospital(h);
    } catch (e) {
      console.error("Failed to load hospital data", e);
    } finally {
      setLoading(false);
    }
  }

  const getDepartmentNamesForDoctor = (doctorId: string): string[] => {
    if (!hospital?.departments) return [];
    const doctor = (hospital.doctors || []).find((d) => d.id === doctorId);
    if (doctor?.departmentIds && doctor.departmentIds.length > 0) {
      return hospital.departments
        .filter((d) => doctor.departmentIds?.includes(d.id))
        .map((d) => d.name);
    }
    return hospital.departments
      .filter((d) => d.doctorIds?.includes(doctorId))
      .map((d) => d.name);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const doctors = hospital?.doctors ?? [];
  const hasDoctors = doctors.length > 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.nav.doctors}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Doctors listed under your hospital
          </p>
        </div>

        {hospital ? (
          <>
            <section className="mb-8 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {hospital.name}
                  </h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {hospital.code}
                    {hospital.city && (
                      <> · {hospital.city}{hospital.state ? `, ${hospital.state}` : ""}</>
                    )}
                  </p>
                </div>
              </div>

              {hasDoctors ? (
                <ul className="space-y-4">
                  {doctors.map((doctor) => {
                    const deptNames = getDepartmentNamesForDoctor(doctor.id);
                    return (
                      <li
                        key={doctor.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 border border-neutral-100 dark:border-neutral-600/50"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 dark:text-neutral-100">
                              {doctor.name}
                            </p>
                            {doctor.email && (
                              <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{doctor.email}</span>
                              </p>
                            )}
                            {doctor.specialization && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                {doctor.specialization}
                              </p>
                            )}
                            {doctor.walletAddress && (
                              <p className="text-xs text-neutral-400 mt-1 font-mono">
                                {doctor.walletAddress}
                              </p>
                            )}
                            {deptNames.length > 0 && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                {deptNames.join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
                  <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No doctors are listed for this hospital yet.</p>
                  <p className="text-sm mt-1">
                    Doctors are linked to your hospital and departments in the system.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="p-8 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-center">
            <Building2 className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">
              No hospital data. Complete registration to link your hospital.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
