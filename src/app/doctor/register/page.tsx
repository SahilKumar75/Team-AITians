"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import {
  User,
  CheckCircle,
  ArrowRight,
  X,
  Upload,
  MapPin,
  Building2,
  Stethoscope,
  Loader2,
} from "lucide-react";
import { INDIAN_STATES, getCitiesForState } from "@/lib/indianPostal";
import { CustomSelect } from "@/components/ui/custom-select";
import { getProvider } from "@/lib/blockchain";
import { loadIdentityBootstrapFromChain, loadRoleProfileFromChain, saveRoleProfileToChain } from "@/lib/role-profile-registry";

/** Doctor registration form — location → hospital → department & profile. Availability is set on doctor/home, not here. */
interface DoctorRegisterForm {
  pincode: string;
  city: string;
  state: string;
  hospitalId: string;
  hospital: string;
  departmentIds: string[];
  name: string;
  /** Fixed to "Doctor" — this portal is for doctors only, not other clinician titles. */
  title: "Doctor";
  phone: string;
  licenseNumber: string;
  specialization: string;
  qualification: string;
  experience: string;
}

interface HospitalOption {
  id: string;
  name: string;
  city: string;
  state: string;
  departments: { id: string; name: string }[];
}

const STEPS = [
  { id: 1, title: "Location", icon: MapPin },
  { id: 2, title: "Hospital", icon: Building2 },
  { id: 3, title: "Department & Profile", icon: Stethoscope },
];

function DoctorRegisterPageInner() {
  const { data: session, status } = useAuthSession();
  const { getSigner } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDoctorOnlyRedirect = searchParams.get("message") === "doctor-only";
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [profilePreview, setProfilePreview] = useState<string>("");
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [locationError, setLocationError] = useState("");

  const [formData, setFormData] = useState<DoctorRegisterForm>({
    pincode: "",
    city: "",
    state: "",
    hospitalId: "",
    hospital: "",
    departmentIds: [],
    name: "",
    title: "Doctor",
    phone: "",
    licenseNumber: "",
    specialization: "",
    qualification: "",
    experience: "",
  });

  function handleStateChange(state: string) {
    setFormData((prev) => ({ ...prev, state, city: "" }));
    setAvailableCities(getCitiesForState(state));
  }

  const fetchAddressFromPincode = async (pincode: string) => {
    if (pincode.length !== 6) return;
    setLoadingAddress(true);
    setLocationError("");
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        setFormData((prev) => ({ ...prev, pincode, city: po.District, state: po.State }));
        setAvailableCities(getCitiesForState(po.State));
      } else {
        setLocationError("Invalid pincode. Please check and try again.");
      }
    } catch {
      setLocationError("Failed to fetch address. Please enter manually.");
    } finally {
      setLoadingAddress(false);
    }
  };

  /** Hospitals in the selected location (state + city) — only relevant options. */
  const hospitalsInLocation = hospitals.filter(
    (h) => h.state === formData.state && (!formData.city.trim() || h.city === formData.city)
  );

  const selectedHospital = formData.hospitalId ? hospitals.find((h) => h.id === formData.hospitalId) : null;
  const departmentOptions = selectedHospital?.departments ?? [];

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicture(reader.result as string);
      setProfilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch("/api/hospitals-list?departments=true");
        if (res.ok) {
          const data = await res.json();
          const list = (data.hospitals ?? []).map(
            (h: { id: string; name: string; city?: string; state?: string; departments?: { id: string; name: string }[] }) => ({
              id: h.id,
              name: h.name,
              city: h.city ?? "",
              state: h.state ?? "",
              departments: (h.departments ?? []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })),
            })
          );
          setHospitals(list);
        }
      } catch {
        /* ignore */
      }

      if (status === "loading") return;
      if (status === "unauthenticated" || !session?.user) {
        router.push("/auth/login");
        return;
      }
      if (session.user.role !== "doctor") {
        router.push(session.user.role === "patient" ? "/patient/home" : "/");
        return;
      }
      try {
        const onChainProfile = await loadRoleProfileFromChain(
          session.user.email || "",
          session.user.walletAddress || undefined
        );
        if (onChainProfile && Object.keys(onChainProfile).length > 0) {
          router.push("/doctor/home");
          return;
        }
        const bootstrap = await loadIdentityBootstrapFromChain(
          session.user.email || "",
          session.user.walletAddress || undefined
        );
        if (bootstrap?.preferredLanguage && typeof window !== "undefined") {
          localStorage.setItem("language", bootstrap.preferredLanguage);
        }
        if (bootstrap?.phone) {
          setFormData((prev) => ({
            ...prev,
            phone: prev.phone || bootstrap.phone || "",
          }));
        }
      } catch {
        // ignore, allow registration
      }
      setFormData((prev) => ({
        ...prev,
        name: session?.user?.email?.split("@")[0] ? `Dr. ${session.user.email.split("@")[0]}` : "",
      }));
      setLoading(false);
    }
    run();
  }, [status, session?.user, router]);

  async function handleRegister() {
    if (currentStep === 1) {
      if (formData.pincode.length !== 6 || !formData.city?.trim() || !formData.state?.trim()) {
        setLocationError("Enter a valid 6-digit pincode and ensure city and state are filled (use pincode to auto-fill).");
        return;
      }
      setLocationError("");
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      if (!formData.hospitalId?.trim()) {
        alert("Please select a hospital to link your profile.");
        return;
      }
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3) {
      if (!formData.name?.trim() || !formData.phone?.trim() || !formData.licenseNumber?.trim() || !formData.specialization?.trim() || !formData.qualification?.trim() || !formData.experience?.trim()) {
        alert("Please fill in name, license, phone, specialization, qualification, and experience.");
        return;
      }
      if (formData.departmentIds.length === 0) {
        alert("Please select at least one department at the hospital.");
        return;
      }
    }

    try {
      setRegistering(true);
      const payload = {
        name: formData.name.trim(),
        title: "Doctor",
        phone: formData.phone.trim(),
        licenseNumber: formData.licenseNumber.trim(),
        specialization: formData.specialization.trim(),
        qualification: formData.qualification.trim(),
        experience: formData.experience.trim(),
        hospital: formData.hospital.trim(),
        hospitalId: formData.hospitalId,
        departmentIds: formData.departmentIds,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim() || undefined,
        profilePicture: profilePicture || undefined,
      };
      const identifier = session?.user?.email || "";
      const signer = getSigner(getProvider());
      if (!identifier || !signer) {
        throw new Error("Missing identity signer. Please login again.");
      }
      await saveRoleProfileToChain(
        identifier,
        signer,
        payload as unknown as Record<string, unknown>,
        session?.user?.walletAddress || undefined
      );
      router.push("/doctor/home");
    } catch (error: unknown) {
      console.error("Registration error:", error);
      alert(error instanceof Error ? error.message : "Failed to register. Please try again.");
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">Register as Doctor</h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mt-1">
            Location → Hospital → Department & profile. Choose location first to see only relevant hospitals.
          </p>
          {isDoctorOnlyRedirect && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
              This portal is for doctors only. If you are a nurse, consultant, or other clinician, please use the appropriate portal.
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Stepper: 3 steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;
                return (
                  <div key={step.id} className="flex items-center flex-1 max-w-[120px]">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isCompleted ? "bg-green-500 text-white" : isCurrent ? "bg-blue-600 dark:bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-900/50" : "bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400"
                        }`}
                      >
                        {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                      </div>
                      <p className={`mt-2 text-xs font-medium text-center ${isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-neutral-400"}`}>{step.title}</p>
                    </div>
                    {index < STEPS.length - 1 && <div className={`h-1 flex-1 mx-1 rounded max-w-8 ${isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-neutral-700"}`} />}
                  </div>
                );
              })}
            </div>
          </div>

          {registering && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="text-blue-900 dark:text-blue-100 font-medium">Saving your profile...</p>
            </div>
          )}

          {locationError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
              {locationError}
            </div>
          )}

          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-lg p-8">
            {/* Step 1: Location — pincode (auto-fill), city, state */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Location</h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">Enter pincode to auto-fill city and state. This will filter hospitals to only those in your area.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Pincode <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={formData.pincode}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setFormData((prev) => ({ ...prev, pincode: v }));
                          if (v.length === 6) fetchAddressFromPincode(v);
                        }}
                        placeholder="6-digit pincode"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
                      />
                      {loadingAddress && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Enter 6-digit pincode to auto-fill city and state</p>
                  </div>
                  <div />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">City <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="Auto-filled from pincode"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">State <span className="text-red-500">*</span></label>
                    <CustomSelect
                      value={formData.state}
                      onChange={handleStateChange}
                      options={[{ value: "", label: "Select state" }, ...INDIAN_STATES.map((s) => ({ value: s, label: s }))]}
                      placeholder="Select state"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Hospital — mandatory, only hospitals in selected location */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Select Hospital</h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                  Hospitals in {formData.city && `${formData.city}, `}{formData.state || "your location"}. You must link to a hospital to complete registration.
                </p>
                {!formData.state?.trim() ? (
                  <p className="text-amber-700 dark:text-amber-400 text-sm">Complete Step 1 (location) first so we can show hospitals in your area.</p>
                ) : hospitalsInLocation.length === 0 ? (
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">No hospitals found in this location. You can go back and try another pincode/city.</p>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Hospital <span className="text-red-500">*</span></label>
                    <CustomSelect
                      value={formData.hospitalId}
                      onChange={(value) => {
                        const h = hospitalsInLocation.find((x) => x.id === value);
                        setFormData((prev) => ({ ...prev, hospitalId: value, hospital: h?.name ?? "", departmentIds: [] }));
                      }}
                      options={[{ value: "", label: "Select hospital" }, ...hospitalsInLocation.map((h) => ({ value: h.id, label: `${h.name} (${h.city})` }))]}
                      placeholder="Select hospital"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Department & profile — departments of selected hospital + name, title, license, etc. Specialization helps list you under the right department. */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Department & Profile</h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                  Select department(s) at {formData.hospital || "your hospital"}. Your specialization helps patients and the system list you under the right department.
                </p>

                {departmentOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Departments at this hospital <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-2">
                      {departmentOptions.map((d) => {
                        const isSelected = formData.departmentIds.includes(d.id);
                        return (
                          <label key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  departmentIds: e.target.checked ? [...prev.departmentIds, d.id] : prev.departmentIds.filter((id) => id !== d.id),
                                }))
                              }
                              className="rounded border-neutral-300 dark:border-neutral-600"
                            />
                            <span className="text-sm text-neutral-900 dark:text-neutral-100">{d.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center mb-6">
                  {profilePreview ? (
                    <div className="relative">
                      <img src={profilePreview} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-blue-500 dark:border-blue-400" />
                      <button type="button" onClick={() => { setProfilePicture(""); setProfilePreview(""); }} className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center border-4 border-dashed border-neutral-300 dark:border-neutral-600">
                      <User className="w-16 h-16 text-neutral-400 dark:text-neutral-500" />
                    </div>
                  )}
                  <label className="mt-4 cursor-pointer">
                    <span className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition text-sm font-medium">
                      <Upload className="w-4 h-4" /> Upload Profile Picture
                    </span>
                    <input type="file" accept="image/*" onChange={handleProfilePictureChange} className="hidden" />
                  </label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Optional • Max 5MB</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Full Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Dr. John Doe"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Title</label>
                    <div className="px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      Doctor
                    </div>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">This portal is for doctors only.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Medical License Number <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                      placeholder="e.g., MCI-123456"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Phone <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Specialization <span className="text-red-500">*</span></label>
                    <CustomSelect
                      value={formData.specialization}
                      onChange={(value) => setFormData((prev) => ({ ...prev, specialization: value }))}
                      options={[
                        { value: "", label: "Select" },
                        { value: "General Physician", label: "General Physician" },
                        { value: "Cardiologist", label: "Cardiologist" },
                        { value: "Dermatologist", label: "Dermatologist" },
                        { value: "ENT Specialist", label: "ENT Specialist" },
                        { value: "Gastroenterologist", label: "Gastroenterologist" },
                        { value: "Gynecologist", label: "Gynecologist" },
                        { value: "Neurologist", label: "Neurologist" },
                        { value: "Oncologist", label: "Oncologist" },
                        { value: "Ophthalmologist", label: "Ophthalmologist" },
                        { value: "Orthopedic", label: "Orthopedic" },
                        { value: "Pediatrician", label: "Pediatrician" },
                        { value: "Psychiatrist", label: "Psychiatrist" },
                        { value: "Pulmonologist", label: "Pulmonologist" },
                        { value: "Radiologist", label: "Radiologist" },
                        { value: "Urologist", label: "Urologist" },
                        { value: "Other", label: "Other" },
                      ]}
                      placeholder="Specialization"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Qualification <span className="text-red-500">*</span></label>
                    <CustomSelect
                      value={formData.qualification}
                      onChange={(value) => setFormData((prev) => ({ ...prev, qualification: value }))}
                      options={[
                        { value: "", label: "Select" },
                        { value: "MBBS", label: "MBBS" },
                        { value: "MBBS, MD", label: "MBBS, MD" },
                        { value: "MBBS, MS", label: "MBBS, MS" },
                        { value: "MBBS, DNB", label: "MBBS, DNB" },
                        { value: "MBBS, DM", label: "MBBS, DM" },
                        { value: "MBBS, MCh", label: "MBBS, MCh" },
                        { value: "BDS", label: "BDS" },
                        { value: "BDS, MDS", label: "BDS, MDS" },
                        { value: "BAMS", label: "BAMS" },
                        { value: "BHMS", label: "BHMS" },
                        { value: "BUMS", label: "BUMS" },
                        { value: "Other", label: "Other" },
                      ]}
                      placeholder="Qualification"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Years of Experience <span className="text-red-500">*</span></label>
                  <CustomSelect
                    value={formData.experience}
                    onChange={(value) => setFormData((prev) => ({ ...prev, experience: value }))}
                    options={[
                      { value: "", label: "Select" },
                      { value: "Less than 1 year", label: "Less than 1 year" },
                      { value: "1-2 years", label: "1-2 years" },
                      { value: "3-5 years", label: "3-5 years" },
                      { value: "6-10 years", label: "6-10 years" },
                      { value: "11-15 years", label: "11-15 years" },
                      { value: "16-20 years", label: "16-20 years" },
                      { value: "20+ years", label: "20+ years" },
                    ]}
                    placeholder="Experience"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6 mt-6 border-t border-neutral-200 dark:border-neutral-700">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => s - 1)}
                  disabled={registering}
                  className="flex items-center gap-2 px-6 py-3 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition disabled:opacity-50 font-medium"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" /> Back
                </button>
              )}
              <button
                type="button"
                onClick={handleRegister}
                disabled={registering}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {registering ? "Saving..." : currentStep < 3 ? "Next" : "Complete Registration"}
                {!registering && currentStep < 3 && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DoctorRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <DoctorRegisterPageInner />
    </Suspense>
  );
}
