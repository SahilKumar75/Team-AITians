"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import {
  Building2,
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  MapPin,
  Layers,
} from "lucide-react";
import type { HospitalProfileData, DayOfWeek } from "@/lib/types";
import { getProvider } from "@/lib/blockchain";
import { loadIdentityBootstrapFromChain, loadRoleProfileFromChain, saveRoleProfileToChain } from "@/lib/role-profile-registry";

/** Build openDays array from number of operating days per week (1–7). 1–6 = Mon–Sat, 7 = all week. */
function openDaysFromCount(n: number): DayOfWeek[] {
  const count = Math.min(7, Math.max(1, Math.floor(n)));
  if (count === 7) return [0, 1, 2, 3, 4, 5, 6];
  return Array.from({ length: count }, (_, i) => (i + 1) as DayOfWeek);
}
import { INDIAN_STATES } from "@/lib/indianPostal";

type HospitalFormData = HospitalProfileData & { pincode?: string };

const STEPS = [
  { id: 1, title: "Basic Info", icon: Building2 },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Departments", icon: Layers },
];

const HOSPITAL_TYPES = [
  "Multi-specialty",
  "Clinic",
  "Government",
  "Private",
  "Other",
];

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

/** Default floor when creating a department (stored per-department; UI no longer exposes floor edit). */
const DEFAULT_DEPARTMENT_FLOOR = 1;

const emptyDept = () => ({
  name: "",
  type: "OPD",
  floor: DEFAULT_DEPARTMENT_FLOOR,
  openDays: [1, 2, 3, 4, 5] as DayOfWeek[],
});

export default function HospitalRegisterPage() {
  const { data: session, status } = useAuthSession();
  const { getSigner } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<HospitalFormData>({
    name: "",
    code: "",
    city: "",
    state: "",
    type: "",
    address: "",
    pincode: "",
    departments: [emptyDept()],
  });

  const fetchAddressFromPincode = async (pincode: string) => {
    if (pincode.length !== 6) return;
    setLoadingAddress(true);
    setError("");
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        setFormData((prev) => ({
          ...prev,
          pincode,
          city: postOffice.District,
          state: postOffice.State,
        }));
      } else {
        setError("Invalid pincode. Please check and try again.");
      }
    } catch {
      setError("Failed to fetch address. Please enter manually.");
    } finally {
      setLoadingAddress(false);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      if (status === "loading") return;

      if (status === "unauthenticated") {
        router.replace("/");
        return;
      }
      if (session?.user && session.user.role !== "hospital") {
        router.replace(session.user.role === "patient" ? "/patient/home" : "/doctor/home");
        return;
      }

      if (!session?.user?.email) return;
      try {
        const bootstrap = await loadIdentityBootstrapFromChain(
          session.user.email,
          session.user.walletAddress || undefined
        );
        if (bootstrap?.preferredLanguage && typeof window !== "undefined") {
          localStorage.setItem("language", bootstrap.preferredLanguage);
        }
        const onChainProfile = await loadRoleProfileFromChain(
          session.user.email,
          session.user.walletAddress || undefined
        );
        if (!onChainProfile || Object.keys(onChainProfile).length === 0) return;

        const departments = Array.isArray(onChainProfile.departments)
          ? onChainProfile.departments
          : [];
        setFormData((prev) => ({
          ...prev,
          name: typeof onChainProfile.name === "string" ? onChainProfile.name : prev.name,
          code: typeof onChainProfile.code === "string" ? onChainProfile.code : prev.code,
          city: typeof onChainProfile.city === "string" ? onChainProfile.city : prev.city,
          state: typeof onChainProfile.state === "string" ? onChainProfile.state : prev.state,
          type: typeof onChainProfile.type === "string" ? onChainProfile.type : prev.type,
          address: typeof onChainProfile.address === "string" ? onChainProfile.address : prev.address,
          pincode: typeof onChainProfile.pincode === "string" ? onChainProfile.pincode : (prev.pincode ?? ""),
          departments: departments.length > 0
            ? departments.map((d) => {
                const entry = d as Record<string, unknown>;
                return {
                  name: typeof entry.name === "string" ? entry.name : "",
                  type: typeof entry.type === "string" ? entry.type : "OPD",
                  floor: typeof entry.floor === "number" ? entry.floor : DEFAULT_DEPARTMENT_FLOOR,
                  openDays: Array.isArray(entry.openDays)
                    ? (entry.openDays as DayOfWeek[])
                    : [1, 2, 3, 4, 5],
                };
              })
            : prev.departments,
        }));
      } catch {
        // allow fresh registration
      }
    }
    bootstrap();
  }, [status, session?.user, router]);

  const addDepartment = () => {
    setFormData((prev) => ({
      ...prev,
      departments: [...(prev.departments || []), emptyDept()],
    }));
  };

  const removeDepartment = (index: number) => {
    setFormData((prev) => {
      const depts = [...(prev.departments || [])];
      if (depts.length <= 1) return prev;
      depts.splice(index, 1);
      return { ...prev, departments: depts };
    });
  };

  const updateDepartment = (
    index: number,
    field: keyof HospitalProfileData["departments"][0],
    value: string | number | DayOfWeek[]
  ) => {
    setFormData((prev) => {
      const depts = [...(prev.departments || [])];
      if (!depts[index]) return prev;
      depts[index] = { ...depts[index], [field]: value };
      return { ...prev, departments: depts };
    });
  };

  const handleNext = () => {
    setError("");
    if (currentStep === 1) {
      if (!formData.name?.trim() || !formData.code?.trim()) {
        setError("Hospital name and code are required");
        return;
      }
    } else if (currentStep === 2) {
      const pincode = (formData.pincode ?? "").trim();
      if (pincode.length !== 6) {
        setError("Please enter a valid 6-digit pincode");
        return;
      }
      if (!formData.city?.trim() || !formData.state?.trim()) {
        setError("City and state are required (use pincode to auto-fill)");
        return;
      }
    }
    setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  };

  const handlePrevious = () => {
    setError("");
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const depts = formData.departments || [];
    if (depts.length === 0 || depts.some((d) => !d.name?.trim())) {
      setError("Each department must have a name. If you chose 'Any other', enter the department name.");
      return;
    }
    setLoading(true);
    try {
      const identifier = session?.user?.email || "";
      const signer = getSigner(getProvider());
      if (!identifier || !signer) {
        throw new Error("Missing identity signer. Please login again.");
      }

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        type: formData.type?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        pincode: formData.pincode?.trim() || undefined,
        departments: depts.map((d) => ({
          name: d.name.trim(),
          type: d.type || "OPD",
          floor: d.floor ?? DEFAULT_DEPARTMENT_FLOOR,
          openDays: d.openDays ?? [1, 2, 3, 4, 5],
        })),
      };
      await saveRoleProfileToChain(
        identifier,
        signer,
        payload as unknown as Record<string, unknown>,
        session?.user?.walletAddress || undefined
      );
      setSaved(true);
      setTimeout(() => {
        router.push("/hospital/home");
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const deptDropdownValue = (dept: { name: string }) =>
    STANDARD_DEPARTMENTS.includes(dept.name) ? dept.name : "Any other";
  const isDeptOther = (dept: { name: string }) =>
    dept.name === "" || !STANDARD_DEPARTMENTS.includes(dept.name);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pt-24 pb-20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            Hospital registration
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Add your hospital details in a few steps
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-600 dark:bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-900/50"
                            : "bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400"
                      }`}
                    >
                      {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <p className={`mt-2 text-sm font-medium ${isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-neutral-400"}`}>
                      {step.title}
                    </p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 rounded transition-all max-w-16 ${isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-neutral-700"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {saved && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-800 dark:text-emerald-200 text-sm">Saved. Redirecting to portal…</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-lg p-8">
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">Basic information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Hospital name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Demo General Hospital"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Hospital code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. DGH"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Type</label>
                <select
                  value={formData.type || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select type</option>
                  {HOSPITAL_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">Location</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={formData.pincode ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setFormData((prev) => ({ ...prev, pincode: v }));
                        if (v.length === 6) fetchAddressFromPincode(v);
                      }}
                      className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="6-digit pincode"
                    />
                    {loadingAddress && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Enter 6-digit pincode to auto-fill city and state
                  </p>
                </div>
                <div />
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Mumbai"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Full address"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Departments</h3>
                <button
                  type="button"
                  onClick={addDepartment}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add department
                </button>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                Add departments (e.g. Cardiology, General OPD) and their operating days per week. <span className="text-red-500">*</span>
              </p>
              <div className="space-y-4">
                {(formData.departments || []).map((dept, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-600 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                        Department {index + 1}
                      </span>
                      {(formData.departments?.length ?? 0) > 1 && (
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
                        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          Department <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={deptDropdownValue(dept)}
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
                        {isDeptOther(dept) && (
                          <input
                            type="text"
                            value={dept.name}
                            onChange={(e) => updateDepartment(index, "name", e.target.value)}
                            placeholder="Specify department name (e.g. other OPD)"
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                          />
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          Operating days per week
                        </label>
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
                          placeholder="1–7"
                        />
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Number of days open per week (1–7)</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition shadow-lg shadow-blue-500/30"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Save and go to portal
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
