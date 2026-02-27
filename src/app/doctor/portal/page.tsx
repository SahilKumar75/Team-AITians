"use client";

import { useEffect, useState } from "react";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import {
  Edit2, User, MapPin, Stethoscope, Save, X, Loader2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { INDIAN_STATES, getCitiesForState } from "@/lib/indianPostal";
import { getProvider } from "@/lib/blockchain";
import { loadRoleProfileFromChain, saveRoleProfileToChain } from "@/lib/role-profile-registry";

interface DoctorProfileData {
  name: string;
  phone: string;
  email: string;
  pincode: string;
  city: string;
  state: string;
  hospitalId: string;
  hospital: string;
  departmentIds: string[];
  /** Optional display names (e.g. from mock: "General OPD, Cardiology") */
  departmentNames?: string;
  licenseNumber: string;
  specialization: string;
  qualification: string;
  experience: string;
  profilePicture?: string;
}

const defaultProfile = (email: string): DoctorProfileData => ({
  name: "",
  phone: "",
  email: email || "",
  pincode: "",
  city: "",
  state: "",
  hospitalId: "",
  hospital: "",
  departmentIds: [],
  licenseNumber: "",
  specialization: "",
  qualification: "",
  experience: "",
  profilePicture: "",
});

export default function DoctorPortalPage() {
  const { data: session, status } = useAuthSession();
  const { getSigner } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [editForm, setEditForm] = useState<DoctorProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const { t } = useLanguage();

  const email = session?.user?.email || "";

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !session?.user) {
      router.push("/auth/login");
      return;
    }
    if (session.user.role !== "doctor") {
      router.push(session.user.role === "patient" ? "/patient/home" : "/");
      return;
    }
    loadProfile();
  }, [status, session, router]);

  async function loadProfile() {
    try {
      setLoading(true);
      const onChain = email ? await loadRoleProfileFromChain(email, session?.user?.walletAddress ?? undefined) : null;
      const merged: Partial<DoctorProfileData> = onChain ? {
        name: onChain.name as string,
        phone: onChain.phone as string,
        email: (onChain.email as string) || email,
        pincode: onChain.pincode as string,
        city: onChain.city as string,
        state: onChain.state as string,
        hospitalId: onChain.hospitalId as string,
        hospital: onChain.hospital as string,
        departmentIds: Array.isArray(onChain.departmentIds) ? (onChain.departmentIds as string[]) : [],
        departmentNames: onChain.departmentNames as string | undefined,
        licenseNumber: onChain.licenseNumber as string,
        specialization: onChain.specialization as string,
        qualification: onChain.qualification as string,
        experience: onChain.experience as string,
        profilePicture: onChain.profilePicture as string | undefined,
      } : {};

      const full: DoctorProfileData = {
        ...defaultProfile(email),
        ...merged,
        email: merged.email || email,
      };
      setProfile(full);
      setEditForm(full);
      if (full.state) setAvailableCities(getCitiesForState(full.state));
    } catch (e) {
      console.error(e);
      setProfile(defaultProfile(email));
      setEditForm(defaultProfile(email));
    } finally {
      setLoading(false);
    }
  }

  const fetchAddressFromPincode = async (pincode: string) => {
    if (pincode.length !== 6 || !editForm) return;
    setLoadingAddress(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        setEditForm((prev) => prev ? { ...prev, city: po.District, state: po.State } : prev);
        setAvailableCities(getCitiesForState(po.State));
      }
    } catch (_) {}
    setLoadingAddress(false);
  };

  function handleEditChange(field: keyof DoctorProfileData, value: string | string[]) {
    setEditForm((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function handleSave() {
    if (!editForm || !profile) return;
    setSaving(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        title: "Doctor",
        email: editForm.email || email,
        phone: editForm.phone.trim(),
        licenseNumber: editForm.licenseNumber.trim(),
        specialization: editForm.specialization.trim(),
        qualification: editForm.qualification.trim(),
        experience: editForm.experience.trim(),
        hospital: editForm.hospital.trim(),
        hospitalId: editForm.hospitalId,
        departmentIds: Array.isArray(editForm.departmentIds) ? editForm.departmentIds : (editForm.departmentIds as unknown as string)?.split(",").map((s) => s.trim()).filter(Boolean) || [],
        city: editForm.city.trim(),
        state: editForm.state.trim(),
        pincode: editForm.pincode.trim() || undefined,
        profilePicture: editForm.profilePicture || undefined,
      };
      const signer = getSigner(getProvider());
      if (!email || !signer) throw new Error("Missing identity signer. Please login again.");
      const existing = (await loadRoleProfileFromChain(email, session?.user?.walletAddress ?? undefined)) ?? {};
      await saveRoleProfileToChain(
        email,
        signer,
        { ...existing, ...payload } as Record<string, unknown>,
        session?.user?.walletAddress ?? undefined
      );
      setProfile({ ...profile, ...editForm });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!profile || !editForm) {
    return null;
  }

  const displayName = profile.name || email?.split("@")[0] || "Doctor";

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24 pb-40 md:pb-32">
        {/* Header: profile picture + title + Save/Cancel */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-4 border-white dark:border-neutral-800 shadow-lg overflow-hidden">
              {profile.profilePicture ? (
                <img src={profile.profilePicture} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-white">{displayName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 dark:text-neutral-50 truncate">
                Doctor Portal
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-1">
                View and edit your professional profile
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => { setIsEditing(false); setEditForm(profile); }}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-600 transition disabled:opacity-50 font-medium"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50 font-medium shadow-lg"
                >
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-600 transition font-medium"
              >
                <Edit2 className="w-4 h-4" /> Edit profile
              </button>
            )}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Personal Information */}
          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                  <User className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Personal Information</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => handleEditChange("name", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-base text-neutral-900 dark:text-neutral-100 font-semibold">{profile.name || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => handleEditChange("phone", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.phone || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Email</label>
                <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium truncate">{profile.email || "—"}</p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                  <MapPin className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Location</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Pincode</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.pincode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      handleEditChange("pincode", v);
                      if (v.length === 6) fetchAddressFromPincode(v);
                    }}
                    placeholder="6-digit pincode"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.pincode || "—"}</p>
                )}
                {loadingAddress && <p className="text-xs text-neutral-500 mt-1">Looking up...</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => handleEditChange("city", e.target.value)}
                    list="cities-list"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.city || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">State</label>
                {isEditing ? (
                  <select
                    value={editForm.state}
                    onChange={(e) => {
                      const s = e.target.value;
                      handleEditChange("state", s);
                      setAvailableCities(getCitiesForState(s));
                      handleEditChange("city", "");
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.state || "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Professional */}
          <div className="bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 dark:from-blue-900/20 dark:via-sky-900/20 dark:to-cyan-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-4 shadow-sm hover:shadow-md transition-shadow lg:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Professional</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Hospital</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.hospital}
                    onChange={(e) => handleEditChange("hospital", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.hospital || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">License Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.licenseNumber}
                    onChange={(e) => handleEditChange("licenseNumber", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.licenseNumber || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Specialization</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.specialization}
                    onChange={(e) => handleEditChange("specialization", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.specialization || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Qualification</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.qualification}
                    onChange={(e) => handleEditChange("qualification", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.qualification || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Experience</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.experience}
                    onChange={(e) => handleEditChange("experience", e.target.value)}
                    placeholder="e.g. 10+ years"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{profile.experience || "—"}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Departments</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={Array.isArray(editForm.departmentIds) ? editForm.departmentIds.join(", ") : ""}
                    onChange={(e) => handleEditChange("departmentIds", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                    placeholder="e.g. Cardiology, General"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">
                    {profile.departmentNames || (Array.isArray(profile.departmentIds) && profile.departmentIds.length > 0 ? profile.departmentIds.join(", ") : "—")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
