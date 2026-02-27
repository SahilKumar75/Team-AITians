"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { User, Calendar, Heart, Phone, Loader2, ChevronRight, ChevronLeft, Check, AlertCircle, MapPin, Upload, X } from "lucide-react";
import { loadUnifiedPatientProfile, saveUnifiedPatientProfile } from "@/lib/patient-data-source";
import { loadIdentityBootstrapFromChain, saveRoleProfileToChain } from "@/lib/role-profile-registry";
import { getProvider } from "@/lib/blockchain";

const STEPS = [
  { id: 1, title: "Personal Info", icon: User },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Medical Info", icon: Heart },
  { id: 4, title: "Emergency Contact", icon: AlertCircle },
];

const CHRONIC_CONDITION_SUGGESTIONS = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Thyroid Disorder",
  "COPD",
  "Arthritis",
  "Chronic Kidney Disease",
  "Coronary Artery Disease",
  "Migraine",
  "Epilepsy",
  "Depression",
  "Anxiety Disorder",
];

const MEDICATION_SUGGESTIONS = [
  "Metformin",
  "Amlodipine",
  "Losartan",
  "Atorvastatin",
  "Aspirin",
  "Levothyroxine",
  "Pantoprazole",
  "Paracetamol",
  "Insulin",
  "Salbutamol",
  "Montelukast",
  "Omeprazole",
];

type MedicationEntry = {
  name: string;
  dose: string;
  frequency: string;
};

function toCsvParts(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PatientRegisterPage() {
  const { data: session, status } = useAuthSession();
  const { getSigner } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profilePicture, setProfilePicture] = useState<string>("");
  const [profilePreview, setProfilePreview] = useState<string>("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [chronicInput, setChronicInput] = useState("");
  const [chronicTags, setChronicTags] = useState<string[]>([]);
  const [medicationInput, setMedicationInput] = useState("");
  const [medicationDose, setMedicationDose] = useState("");
  const [medicationFrequency, setMedicationFrequency] = useState("Once daily");
  const [medicationEntries, setMedicationEntries] = useState<MedicationEntry[]>([]);

  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    phone: "",
    email: "",

    streetAddress: "",
    pincode: "",
    city: "",
    state: "",

    height: "",
    weight: "",
    allergies: "",
    chronicConditions: "",
    currentMedications: "",

    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
  });

  useEffect(() => {
    async function prefillFromIdentity() {
      if (!session?.user?.email) return;
      setFormData((prev) => ({ ...prev, email: session.user!.email }));
      try {
        const bootstrap = await loadIdentityBootstrapFromChain(
          session.user.email,
          session.user.walletAddress || undefined
        );
        if (!bootstrap) return;
        setFormData((prev) => ({
          ...prev,
          email: bootstrap.email || prev.email || session.user!.email,
          phone: bootstrap.phone || prev.phone,
        }));
        if (bootstrap.preferredLanguage && typeof window !== "undefined") {
          localStorage.setItem("language", bootstrap.preferredLanguage);
        }
      } catch {
        // ignore bootstrap prefill failures
      }
    }
    prefillFromIdentity();
  }, [session?.user?.email]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
    if (status === "loading") return;
    const wallet = session?.user?.walletAddress;
    if (!wallet) {
      router.replace("/");
      return;
    }
    const checkAlreadyRegistered = async () => {
      try {
        const profile = await loadUnifiedPatientProfile(wallet, session?.user?.email || "");
        setFormData((prev) => ({
          ...prev,
          fullName: profile.fullName || prev.fullName,
          dateOfBirth: profile.dateOfBirth || prev.dateOfBirth,
          gender: profile.gender || prev.gender,
          bloodGroup: profile.bloodGroup || prev.bloodGroup,
          phone: profile.phone || prev.phone,
          email: profile.email || prev.email,
          streetAddress: profile.address || prev.streetAddress,
          pincode: profile.pincode || prev.pincode,
          city: profile.city || prev.city,
          state: profile.state || prev.state,
          height: profile.height || prev.height,
          weight: profile.weight || prev.weight,
          allergies: profile.allergies || prev.allergies,
          chronicConditions: profile.chronicConditions || prev.chronicConditions,
          currentMedications: profile.currentMedications || prev.currentMedications,
          emergencyName: profile.emergencyName || prev.emergencyName,
          emergencyRelationship: profile.emergencyRelation || prev.emergencyRelationship,
          emergencyPhone: profile.emergencyPhone || prev.emergencyPhone,
        }));
        if (profile.profilePicture) {
          setProfilePicture(profile.profilePicture);
          setProfilePreview(profile.profilePicture);
        }
        setChronicTags(toCsvParts(profile.chronicConditions));
        setMedicationEntries(
          toCsvParts(profile.currentMedications).map((name) => ({
            name,
            dose: "",
            frequency: "",
          }))
        );

        const hasCompletedRegistration =
          !!(typeof profile.fullName === "string" && profile.fullName.trim()
            && typeof profile.dateOfBirth === "string" && profile.dateOfBirth.trim()
            && typeof profile.gender === "string" && profile.gender.trim()
            && typeof profile.bloodGroup === "string" && profile.bloodGroup.trim()
            && typeof profile.phone === "string" && profile.phone.trim());
        if (hasCompletedRegistration) {
          router.replace("/patient/home");
          return;
        }
      } catch {
        /* ignore */
      }
      setCheckingStatus(false);
    };
    checkAlreadyRegistered();
  }, [status, session?.user?.walletAddress, router]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      chronicConditions: chronicTags.join(", "),
    }));
  }, [chronicTags]);

  useEffect(() => {
    const medicationText = medicationEntries
      .map((med) => `${med.name}${med.dose ? ` ${med.dose}` : ""}${med.frequency ? ` (${med.frequency})` : ""}`.trim())
      .join(", ");
    setFormData((prev) => ({
      ...prev,
      currentMedications: medicationText,
    }));
  }, [medicationEntries]);

  const filteredConditionSuggestions = CHRONIC_CONDITION_SUGGESTIONS.filter(
    (item) =>
      item.toLowerCase().includes(chronicInput.toLowerCase()) &&
      !chronicTags.some((tag) => tag.toLowerCase() === item.toLowerCase())
  ).slice(0, 6);

  const filteredMedicationSuggestions = MEDICATION_SUGGESTIONS.filter((item) =>
    item.toLowerCase().includes(medicationInput.toLowerCase())
  ).slice(0, 6);

  const addChronicTag = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    if (chronicTags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) return;
    setChronicTags((prev) => [...prev, normalized]);
    setChronicInput("");
  };

  const removeChronicTag = (value: string) => {
    setChronicTags((prev) => prev.filter((tag) => tag !== value));
  };

  const addMedicationEntry = () => {
    const name = medicationInput.trim();
    if (!name) return;
    setMedicationEntries((prev) => [
      ...prev,
      { name, dose: medicationDose.trim(), frequency: medicationFrequency.trim() },
    ]);
    setMedicationInput("");
    setMedicationDose("");
    setMedicationFrequency("Once daily");
  };

  const removeMedicationEntry = (index: number) => {
    setMedicationEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setProfilePicture(base64String);
      setProfilePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

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

  const handleNext = () => {
    setError("");
    if (currentStep === 1) {
      if (!profilePicture || !formData.fullName?.trim() || !formData.dateOfBirth || !formData.gender || !formData.bloodGroup || !formData.phone?.trim()) {
        setError("Please fill in all required fields");
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.streetAddress?.trim() || !formData.pincode || !formData.city?.trim() || !formData.state?.trim()) {
        setError("Please fill in all required fields");
        return;
      }
      if (formData.pincode.length !== 6) {
        setError("Pincode must be 6 digits");
        return;
      }
    } else if (currentStep === 4) {
      if (!formData.emergencyName?.trim() || !formData.emergencyRelationship || !formData.emergencyPhone?.trim()) {
        setError("Please fill in all required fields");
        return;
      }
    }
    setCurrentStep((s) => s + 1);
  };

  const handlePrevious = () => {
    setError("");
    setCurrentStep((s) => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.emergencyName?.trim() || !formData.emergencyRelationship || !formData.emergencyPhone?.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    const wallet = session?.user?.walletAddress;
    if (!wallet) {
      setError("Session expired. Please log in again.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const profile: Record<string, unknown> = {
        fullName: formData.fullName.trim(),
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email || session?.user?.email || undefined,
        streetAddress: formData.streetAddress.trim() || undefined,
        address: [formData.streetAddress, formData.city, formData.state, formData.pincode].filter(Boolean).join(", "),
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
        height: formData.height.trim() || undefined,
        weight: formData.weight.trim() || undefined,
        allergies: formData.allergies.trim() || undefined,
        chronicConditions: formData.chronicConditions.trim() || undefined,
        currentMedications: formData.currentMedications.trim() || undefined,
        emergencyName: formData.emergencyName.trim() || undefined,
        emergencyRelationship: formData.emergencyRelationship || undefined,
        emergencyRelation: formData.emergencyRelationship || undefined,
        emergencyPhone: formData.emergencyPhone.trim() || undefined,
        profilePicture: profilePicture || undefined,
      };
      const signer = getSigner(getProvider());
      if (!signer) {
        throw new Error("Wallet signer not available. Please login again.");
      }
      await saveRoleProfileToChain(session?.user?.email || wallet, signer, profile, wallet);
      await saveUnifiedPatientProfile(wallet, profile);
      setSuccess("Registration successful! Redirecting...");
      setTimeout(() => {
        router.push("/patient/home");
      }, 1500);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-neutral-400">Checking registration status...</p>
        </div>
      </div>
    );
  }

  if (!session?.user?.walletAddress) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <Navbar minimal={true} />

      <div className="max-w-3xl mx-auto px-4 py-12 pt-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
            Patient Registration
          </h1>
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
                    <div className={`h-1 w-20 mx-2 rounded transition-all ${isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-neutral-700"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-lg hover:shadow-xl transition-shadow p-8">
          <form onSubmit={handleSubmit}>
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-6">Personal Information</h3>

                <div className="flex flex-col items-center mb-6">
                  <div className="relative">
                    {profilePreview ? (
                      <div className="relative">
                        <img
                          src={profilePreview}
                          alt="Profile Preview"
                          className="w-32 h-32 rounded-full object-cover border-4 border-blue-500 dark:border-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProfilePicture("");
                            setProfilePreview("");
                          }}
                          className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center border-4 border-dashed border-neutral-300 dark:border-neutral-600">
                        <User className="w-16 h-16 text-neutral-400 dark:text-neutral-500" />
                      </div>
                    )}
                  </div>
                  <label className="mt-4 cursor-pointer">
                    <span className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition text-sm font-medium">
                      <Upload className="w-4 h-4" />
                      Upload Profile Picture <span className="text-red-300 ml-1">*</span>
                    </span>
                    <input type="file" accept="image/*" onChange={handleProfilePictureChange} className="hidden" />
                  </label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Required • Max 5MB</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      Full Name <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      Date of Birth <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      Gender <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      Blood Group <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                      required
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    Phone Number <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">Address Information</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">Enter your residential address</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    Street Address <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.streetAddress}
                    onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                    placeholder="House No., Building Name, Street"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      Pincode <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.pincode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setFormData((prev) => ({ ...prev, pincode: value }));
                          if (value.length === 6) fetchAddressFromPincode(value);
                        }}
                        placeholder="Enter 6-digit pincode"
                        maxLength={6}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                      />
                      {loadingAddress && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">City and State will be auto-filled</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      City <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    State <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">Medical Information</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">Optional but recommended for emergency situations</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      Height (cm): <span className="font-semibold">{formData.height || "Not set"}</span>
                    </label>
                    <input
                      type="range"
                      min={120}
                      max={220}
                      step={1}
                      value={formData.height ? Number(formData.height) : 170}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      className="w-full accent-blue-600 dark:accent-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, height: "" }))}
                      className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                      Weight (kg): <span className="font-semibold">{formData.weight || "Not set"}</span>
                    </label>
                    <input
                      type="range"
                      min={30}
                      max={200}
                      step={1}
                      value={formData.weight ? Number(formData.weight) : 70}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      className="w-full accent-blue-600 dark:accent-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, weight: "" }))}
                      className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Known Allergies</label>
                  <textarea
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    placeholder="e.g., Penicillin, Peanuts, Latex"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Chronic Conditions</label>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        value={chronicInput}
                        onChange={(e) => setChronicInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addChronicTag(chronicInput);
                          }
                        }}
                        placeholder="Search or type condition"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                      />
                      {chronicInput && filteredConditionSuggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg max-h-44 overflow-auto">
                          {filteredConditionSuggestions.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => addChronicTag(item)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => addChronicTag(chronicInput)}
                      className="px-3 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                    >
                      Add Condition
                    </button>
                    <div className="flex flex-wrap gap-2">
                      {chronicTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-sm"
                        >
                          {tag}
                          <button type="button" onClick={() => removeChronicTag(tag)} aria-label={`Remove ${tag}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Current Medications</label>
                  <div className="space-y-3 rounded-lg border border-gray-200 dark:border-neutral-600 p-4 bg-gray-50 dark:bg-neutral-900/40">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="relative">
                        <input
                          value={medicationInput}
                          onChange={(e) => setMedicationInput(e.target.value)}
                          placeholder="Medicine name"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700"
                        />
                        {medicationInput && filteredMedicationSuggestions.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg max-h-44 overflow-auto">
                            {filteredMedicationSuggestions.map((item) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setMedicationInput(item)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        value={medicationDose}
                        onChange={(e) => setMedicationDose(e.target.value)}
                        placeholder="Dose (e.g., 500mg)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700"
                      />
                      <select
                        value={medicationFrequency}
                        onChange={(e) => setMedicationFrequency(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700"
                      >
                        <option>Once daily</option>
                        <option>Twice daily</option>
                        <option>Thrice daily</option>
                        <option>Weekly</option>
                        <option>As needed</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={addMedicationEntry}
                      className="px-3 py-2 text-sm rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                    >
                      Add Medication
                    </button>
                    <div className="space-y-2">
                      {medicationEntries.map((med, idx) => (
                        <div
                          key={`${med.name}-${idx}`}
                          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700"
                        >
                          <div className="text-sm">
                            <span className="font-medium">{med.name}</span>
                            {med.dose ? <span className="ml-2 text-neutral-600 dark:text-neutral-300">{med.dose}</span> : null}
                            {med.frequency ? <span className="ml-2 text-neutral-500 dark:text-neutral-400">({med.frequency})</span> : null}
                          </div>
                          <button type="button" onClick={() => removeMedicationEntry(idx)} className="text-red-500 hover:text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">Emergency Contact</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">Who should we contact in case of emergency?</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    Contact Name <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.emergencyName}
                    onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                    placeholder="Full name of emergency contact"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    Relationship <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    required
                    value={formData.emergencyRelationship}
                    onChange={(e) => setFormData({ ...formData, emergencyRelationship: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  >
                    <option value="">Select Relationship</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Child">Child</option>
                    <option value="Friend">Friend</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
                    Contact Phone <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex items-center gap-2 px-6 py-3 text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>

              {currentStep < 4 ? (
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
                      Registering...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Complete Registration
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
