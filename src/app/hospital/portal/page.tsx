"use client";

import { useEffect, useState } from "react";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  Building2,
  MapPin,
  Loader2,
  ArrowRight,
  Layers,
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DayOfWeek } from "@/lib/types";
import { getProvider } from "@/lib/blockchain";
import { loadRoleProfileFromChain, saveRoleProfileToChain } from "@/lib/role-profile-registry";

interface Department {
  id?: string;
  name: string;
  code?: string;
  currentQueue?: number;
  maxCapacity?: number;
  floor?: number;
  wing?: string;
  openDays?: DayOfWeek[];
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  city: string;
  state?: string;
  departments?: Department[];
}

const STANDARD_DEPARTMENTS = [
  "General OPD",
  "Cardiology",
  "Orthopaedics",
  "Lab & Diagnostics",
  "Radiology",
  "Pharmacy",
  "Registration",
  "Consultation",
  "Emergency",
  "ICU",
  "Dermatology",
  "Pediatrics",
  "Any other",
];

function openDaysFromCount(n: number): DayOfWeek[] {
  const count = Math.min(7, Math.max(1, Math.floor(n)));
  if (count === 7) return [0, 1, 2, 3, 4, 5, 6];
  return Array.from({ length: count }, (_, i) => (i + 1) as DayOfWeek);
}

export default function HospitalPortalPage() {
  const { data: session, status } = useAuthSession();
  const { getSigner } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    code: string;
    city: string;
    state: string;
    departments: Array<{ name: string; openDays?: DayOfWeek[] }>;
  }>({ name: "", code: "", city: "", state: "", departments: [] });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
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
      const identifier = session?.user?.email || "";
      if (identifier) {
        try {
          const profile = await loadRoleProfileFromChain(
            identifier,
            session?.user?.walletAddress || undefined
          );
          if (profile && Object.keys(profile).length > 0) {
            const departments: Department[] = Array.isArray(profile.departments)
              ? profile.departments.map((d, idx) => {
                  const entry = d as Record<string, unknown>;
                  return {
                    id: typeof entry.id === "string" ? entry.id : `d${idx + 1}`,
                    name: typeof entry.name === "string" ? entry.name : `Department ${idx + 1}`,
                    openDays: Array.isArray(entry.openDays)
                      ? (entry.openDays as DayOfWeek[])
                      : ([1, 2, 3, 4, 5] as DayOfWeek[]),
                  };
                })
              : [];
            const display: Hospital = {
              id: (profile.hospitalId as string) || "self",
              name: (profile.name as string) || "Hospital",
              code: (profile.code as string) || "HOSP",
              city: (profile.city as string) || "",
              state: (profile.state as string) || "",
              departments,
            };
            setHospital(display);
            const depts = display.departments ?? [];
            setEditForm({
              name: display.name || "",
              code: display.code || "",
              city: display.city || "",
              state: display.state || "",
              departments: depts.length
                ? depts.map((d) => ({
                    name: d.name || "",
                    openDays: d.openDays ?? ([1, 2, 3, 4, 5] as DayOfWeek[]),
                  }))
                : [{ name: "", openDays: [1, 2, 3, 4, 5] as DayOfWeek[] }],
            });
            return;
          }
        } catch {
          // fallback to hospitals list below
        }
      }

      const res = await fetch("/api/hospitals-list?departments=true");
      if (res.ok) {
        const data = await res.json();
        const list = data.hospitals || [];
        if (list.length > 0) {
          const linkedId =
            typeof window !== "undefined"
              ? localStorage.getItem("hospital_linked_id")
              : null;
          const chosen = linkedId
            ? list.find((h: Hospital) => h.id === linkedId)
            : null;
          const h = chosen || list[0];
          const display = { ...h };
          setHospital(display);
          const depts = display.departments ?? [];
          setEditForm({
            name: display.name || "",
            code: display.code || "",
            city: display.city || "",
            state: display.state || "",
            departments: depts.length
              ? depts.map((d) => ({
                  name: d.name || "",
                  openDays: d.openDays ?? ([1, 2, 3, 4, 5] as DayOfWeek[]),
                }))
              : [{ name: "", openDays: [1, 2, 3, 4, 5] as DayOfWeek[] }],
          });
        }
      }
    } catch (e) {
      console.error("Failed to load hospital data", e);
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setSaveError("");
    if (hospital) {
      const depts = hospital.departments ?? [];
      setEditForm({
        name: hospital.name || "",
        code: hospital.code || "",
        city: hospital.city || "",
        state: hospital.state || "",
        departments:
          depts.length > 0
            ? depts.map((d) => ({
                name: d.name || "",
                openDays: d.openDays ?? ([1, 2, 3, 4, 5] as DayOfWeek[]),
              }))
            : [{ name: "", openDays: [1, 2, 3, 4, 5] as DayOfWeek[] }],
      });
      setIsEditing(true);
    }
  }

  function cancelEditing() {
    setSaveError("");
    setIsEditing(false);
    if (hospital) {
      const depts = hospital.departments ?? [];
      setEditForm({
        name: hospital.name || "",
        code: hospital.code || "",
        city: hospital.city || "",
        state: hospital.state || "",
        departments:
          depts.length > 0
            ? depts.map((d) => ({
                name: d.name || "",
                openDays: d.openDays ?? ([1, 2, 3, 4, 5] as DayOfWeek[]),
              }))
            : [{ name: "", openDays: [1, 2, 3, 4, 5] as DayOfWeek[] }],
      });
    }
  }

  function addDepartment() {
    setEditForm((f) => ({
      ...f,
      departments: [
        ...f.departments,
        { name: "", openDays: [1, 2, 3, 4, 5] as DayOfWeek[] },
      ],
    }));
  }

  function removeDepartment(index: number) {
    setEditForm((f) => ({
      ...f,
      departments: f.departments.filter((_, i) => i !== index),
    }));
  }

  function updateDepartment(
    index: number,
    field: "name" | "openDays",
    value: string | DayOfWeek[]
  ) {
    setEditForm((f) => {
      const next = [...f.departments];
      if (!next[index]) return f;
      next[index] = { ...next[index], [field]: value };
      return { ...f, departments: next };
    });
  }

  const deptDropdownValue = (name: string) =>
    STANDARD_DEPARTMENTS.includes(name) ? name : "Any other";
  const isDeptOther = (name: string) =>
    name === "" || !STANDARD_DEPARTMENTS.includes(name);

  async function saveEditing() {
    if (!hospital) return;
    setSaveError("");
    const validDepts = editForm.departments.filter((d) => d.name?.trim());
    if (validDepts.length === 0) {
      setSaveError("Add at least one department with a name (or choose from the list).");
      return;
    }
    setSaving(true);
    try {
      const departments: Department[] = validDepts.map((d, i) => ({
        id: hospital.departments?.[i]?.id ?? `d${i}`,
        name: d.name.trim(),
        openDays: d.openDays,
      }));
      const payload: Hospital = {
        ...hospital,
        city: editForm.city,
        state: editForm.state,
        departments,
      };
      const identifier = session?.user?.email || "";
      const signer = getSigner(getProvider());
      if (!identifier || !signer) throw new Error("Missing identity signer. Please login again.");
      const existing = (await loadRoleProfileFromChain(
        identifier,
        session?.user?.walletAddress || undefined
      )) ?? {};
      await saveRoleProfileToChain(
        identifier,
        signer,
        {
          ...existing,
          name: payload.name,
          code: payload.code,
          city: payload.city,
          state: payload.state,
          departments: payload.departments,
        },
        session?.user?.walletAddress || undefined
      );
      setHospital(payload);
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to save hospital profile", e);
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {t.nav.hospitalPortal}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Manage your hospital profile and details from account creation
          </p>
        </div>

        {hospital ? (
          <>
            {saveError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
                {saveError}
              </div>
            )}
            <section className="mb-8 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    {isEditing ? (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Hospital name</label>
                          <p className="px-0 py-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">{hospital.name}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Code</label>
                          <p className="px-0 py-2 font-mono text-sm text-neutral-700 dark:text-neutral-300">{hospital.code}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">City</label>
                            <input
                              type="text"
                              value={editForm.city}
                              onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">State</label>
                            <input
                              type="text"
                              value={editForm.state}
                              onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                          {hospital.name}
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-mono">
                          {hospital.code}
                        </p>
                        {(hospital.city || hospital.state) && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-300 flex items-center gap-1">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            {[hospital.city, hospital.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {hospital.departments && hospital.departments.length > 0 && (
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {hospital.departments.length} department
                            {hospital.departments.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={saving}
                        className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={saveEditing}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
                        title="Save"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditing}
                      className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 transition"
                      title="Edit profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </section>

            {isEditing ? (
              <section className="mb-8 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Departments
                  </h3>
                  <button
                    type="button"
                    onClick={addDepartment}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add department
                  </button>
                </div>
                <div className="space-y-4">
                  {editForm.departments.map((dept, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-600 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                          Department {index + 1}
                        </span>
                        {editForm.departments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDepartment(index)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">Department</label>
                          <select
                            value={deptDropdownValue(dept.name)}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDepartment(index, "name", v === "Any other" ? "" : v);
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            {STANDARD_DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          {isDeptOther(dept.name) && (
                            <input
                              type="text"
                              value={dept.name}
                              onChange={(e) => updateDepartment(index, "name", e.target.value)}
                              placeholder="Specify department name"
                              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                            />
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">Operating days per week</label>
                          <input
                            type="number"
                            min={1}
                            max={7}
                            value={(dept.openDays || []).length || 5}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              if (!Number.isNaN(n)) updateDepartment(index, "openDays", openDaysFromCount(n));
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : hospital.departments && hospital.departments.length > 0 ? (
              <section className="mb-8 p-6 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Departments
                </h3>
                <ul className="space-y-2">
                  {hospital.departments.map((dept, i) => (
                    <li
                      key={dept.id ?? i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 border border-neutral-100 dark:border-neutral-600/50"
                    >
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {dept.name}
                      </span>
                      {(dept.openDays?.length ?? 0) > 0 && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {dept.openDays!.length} days/week
                        </span>
                      )}
                      {(dept.floor != null || dept.wing) && !dept.openDays?.length && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {dept.floor != null && `Floor ${dept.floor}`}
                          {dept.wing && ` · ${dept.wing}`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
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
