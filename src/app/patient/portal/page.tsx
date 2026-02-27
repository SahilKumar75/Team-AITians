"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { CardFlip, CardFlipFront, CardFlipBack } from "@/components/ui/card-flip";
import {
  Edit2, User, Calendar, Phone, Mail, MapPin, AlertCircle, Heart, Activity,
  FileText, QrCode, Save, X, Shield, ArrowUpRight, Loader2, Share2
} from "lucide-react";
import QRCode from "qrcode";
import { isValidPhone } from "@/lib/identifier";
import { loadUnifiedPatientProfile, saveUnifiedPatientProfile } from "@/lib/patient-data-source";
import { buildEmergencyUrl } from "@/lib/public-app-url";

interface PatientData {
  name: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  previousSurgeries: string;
  height: string;
  weight: string;
  profilePicture?: string;
  /** For "Old doctor" / "Frequent doctor" when patient selects hospital+department. */
  lastDoctorsSeen?: { doctorWallet: string; doctorName?: string; hospitalId?: string; departmentId?: string; lastSeenAt?: number }[];
  /** What patient allows family (linked patients) to see. */
  familySharingPrefs?: { shareJourneyByDefault?: boolean; shareRecordsWithFamily?: boolean };
}

export default function PatientPortal() {
  const { data: session, status } = useAuthSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<PatientData | null>(null);
  const [updating, setUpdating] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [avatarRevealed, setAvatarRevealed] = useState(false);

  const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  const walletKey = session?.user?.walletAddress ?? null;
  useEffect(() => {
    if (status !== "authenticated" || !walletKey) {
      return;
    }
    loadPatientData();
  }, [status, walletKey]);

  async function loadPatientData() {
    try {
      setLoading(true);

      const wallet = session?.user?.walletAddress ?? "";
      const merged = await loadUnifiedPatientProfile(wallet, session?.user?.email || "");

      const profile: PatientData = {
        name: merged.fullName || session?.user?.email?.split('@')[0] || "Patient",
        dateOfBirth: merged.dateOfBirth || "",
        gender: merged.gender || "",
        bloodGroup: merged.bloodGroup || "",
        phone: merged.phone || "",
        email: session?.user?.email || "",
        address: merged.address || (merged as { streetAddress?: string }).streetAddress || "",
        city: merged.city || "",
        state: merged.state || "",
        pincode: merged.pincode || "",
        emergencyName: merged.emergencyName || "",
        emergencyRelation: merged.emergencyRelation || "",
        emergencyPhone: merged.emergencyPhone || "",
        allergies: merged.allergies || "",
        chronicConditions: merged.chronicConditions || "",
        currentMedications: merged.currentMedications || "",
        previousSurgeries: merged.previousSurgeries || "",
        height: merged.height || "",
        weight: merged.weight || "",
        profilePicture: merged.profilePicture || ""
      };

      setPatientData(profile);
      setEditFormData(profile);
      setWalletAddress(merged.walletAddress || wallet || "");

      const effectiveWallet = merged.walletAddress || wallet;
      if (effectiveWallet) {
        const emergencyUrl = buildEmergencyUrl(effectiveWallet);
        const qr = await QRCode.toDataURL(emergencyUrl, { width: 200, margin: 2 });
        setQrCode(qr);
      }
    } catch (error) {
      console.error("Error loading patient data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProfile() {
    if (!editFormData) return;
    if (editFormData.emergencyPhone?.trim() && !isValidPhone(editFormData.emergencyPhone)) {
      alert("Emergency contact must be a valid phone number (10–15 digits).");
      return;
    }

    try {
      setUpdating(true);
      const wallet = session?.user?.walletAddress;
      if (!wallet) {
        alert("Not authenticated");
        return;
      }
      const data = await saveUnifiedPatientProfile(
        wallet
        ,
        { ...editFormData, fullName: editFormData.name } as unknown as Record<string, unknown>
      );

      if (!data.success) {
        alert("Failed to update profile");
        return;
      }

      await loadPatientData();
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setUpdating(false);
    }
  }

  const handleEditChange = (field: keyof PatientData, value: string) => {
    if (editFormData) {
      setEditFormData({ ...editFormData, [field]: value });
    }
  };

  // Fetch address from Indian Postal API
  const fetchAddressFromPincode = async (pincode: string) => {
    if (pincode.length !== 6) return;

    setLoadingAddress(true);

    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();

      if (data[0].Status === "Success" && data[0].PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        if (editFormData) {
          setEditFormData({
            ...editFormData,
            city: postOffice.District,
            state: postOffice.State
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch address from pincode", err);
    } finally {
      setLoadingAddress(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return "N/A";
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!patientData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-24">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-yellow-900 mb-2">No Profile Data</h2>
            <p className="text-yellow-700 mb-4">Please complete your registration first.</p>
            <button
              onClick={() => router.push("/patient/home")}
              className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <Navbar />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24 pb-40 md:pb-32">
        {/* Header with Profile Picture and Wallet Address */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Profile Picture — filled (photo) only on hover or click */}
            <div
              className="relative flex-shrink-0 cursor-pointer select-none"
              onMouseEnter={() => setAvatarRevealed(true)}
              onMouseLeave={() => setAvatarRevealed(false)}
              onClick={() => setAvatarRevealed((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAvatarRevealed((v) => !v); } }}
              aria-label={avatarRevealed ? "Hide profile photo" : "Show profile photo"}
            >
              {patientData.profilePicture && (avatarRevealed) ? (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 border-white dark:border-neutral-800 shadow-lg ring-2 ring-blue-400 dark:ring-blue-500">
                  <img
                    src={patientData.profilePicture}
                    alt={patientData.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-white dark:border-neutral-800 shadow-lg ring-2 ring-transparent hover:ring-blue-400/50 dark:hover:ring-blue-500/50 transition-shadow">
                  <span className="text-xl sm:text-2xl font-bold text-white">
                    {patientData.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 dark:text-neutral-50 truncate">My Portal</h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-1">Manage your complete health profile</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 w-full lg:w-auto">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditFormData(patientData);
                  }}
                  disabled={updating}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-600 transition disabled:opacity-50 font-medium"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={updating}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50 font-medium shadow-lg shadow-blue-500/30"
                >
                  <Save className="w-4 h-4" />
                  {updating ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (walletAddress) {
                      navigator.clipboard.writeText(walletAddress);
                      alert('Wallet address copied to clipboard!');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition cursor-pointer w-full sm:w-auto"
                >
                  <Shield className="w-4 h-4 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Wallet Address</p>
                    <p className="text-xs text-neutral-900 dark:text-neutral-100 font-mono truncate">
                      {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : "Not registered"}
                    </p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 auto-rows-auto">

          {/* Personal Information and Emergency Contact - Stacked Column (Spans 2 rows) */}
          <div className="lg:col-span-2 xl:row-span-2 flex flex-col gap-4">
            {/* Personal Information - Compact */}
            <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                    <User className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Personal Information</h3>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Edit2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData?.name || ""}
                      onChange={(e) => handleEditChange("name", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    />
                  ) : (
                    <p className="text-base text-neutral-900 dark:text-neutral-100 font-semibold">{patientData.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">DOB</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editFormData?.dateOfBirth || ""}
                      onChange={(e) => handleEditChange("dateOfBirth", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">
                      {patientData.dateOfBirth ? `${patientData.dateOfBirth.split('-')[0]} (${calculateAge(patientData.dateOfBirth)} yrs)` : "N/A"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Gender</label>
                  {isEditing ? (
                    <select
                      value={editFormData?.gender || ""}
                      onChange={(e) => handleEditChange("gender", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium capitalize">{patientData.gender || "N/A"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Blood Group</label>
                  {isEditing ? (
                    <select
                      value={editFormData?.bloodGroup || ""}
                      onChange={(e) => handleEditChange("bloodGroup", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    >
                      <option value="">Select</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  ) : (
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{patientData.bloodGroup || "N/A"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editFormData?.phone || ""}
                      onChange={(e) => handleEditChange("phone", e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">{patientData.phone || "N/A"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Email</label>
                  <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium truncate">{patientData.email}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Address</label>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editFormData?.address || ""}
                        onChange={(e) => handleEditChange("address", e.target.value)}
                        placeholder="Street address"
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 mb-2 text-sm"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={editFormData?.pincode || ""}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              handleEditChange("pincode", value);
                              if (value.length === 6) {
                                fetchAddressFromPincode(value);
                              }
                            }}
                            placeholder="Pincode"
                            maxLength={6}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                          />
                          {loadingAddress && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          value={editFormData?.city || ""}
                          onChange={(e) => handleEditChange("city", e.target.value)}
                          placeholder="City"
                          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                        />
                        <select
                          value={editFormData?.state || ""}
                          onChange={(e) => handleEditChange("state", e.target.value)}
                          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                        >
                          <option value="">Select State</option>
                          {INDIAN_STATES.map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">
                      {patientData.address || "N/A"}
                      {(patientData.city || patientData.state || patientData.pincode) && (
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {", "}{[patientData.city, patientData.state, patientData.pincode].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contact - Fills remaining space */}
            <div className="bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-900/20 dark:via-rose-900/20 dark:to-pink-900/20 rounded-2xl border-2 border-red-200 dark:border-red-800 p-4 shadow-sm hover:shadow-md transition-shadow flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Emergency Contact</h3>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Edit Emergency Contact"
                  >
                    <Edit2 className="w-4 h-4 text-red-700 dark:text-red-300" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-red-700 dark:text-red-300 mb-1 uppercase tracking-wider">Contact Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData?.emergencyName || ""}
                      onChange={(e) => handleEditChange("emergencyName", e.target.value)}
                      placeholder="Emergency contact name"
                      className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-red-900/30 text-red-900 dark:text-red-100 text-sm"
                    />
                  ) : (
                    <p className="text-base text-red-900 dark:text-red-100 font-semibold">{patientData.emergencyName || "Not provided"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-700 dark:text-red-300 mb-1 uppercase tracking-wider">Relationship</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData?.emergencyRelation || ""}
                      onChange={(e) => handleEditChange("emergencyRelation", e.target.value)}
                      placeholder="e.g., Spouse, Parent"
                      className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-red-900/30 text-red-900 dark:text-red-100 text-sm"
                    />
                  ) : (
                    <p className="text-base text-red-900 dark:text-red-100 font-semibold capitalize">{patientData.emergencyRelation || "Not provided"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-700 dark:text-red-300 mb-1 uppercase tracking-wider">Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editFormData?.emergencyPhone || ""}
                      onChange={(e) => handleEditChange("emergencyPhone", e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-red-900/30 text-red-900 dark:text-red-100 text-sm"
                    />
                  ) : (
                    <p className="text-base text-red-900 dark:text-red-100 font-semibold">{patientData.emergencyPhone || "Not provided"}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Vitals and Medical Information - Stacked Column (Spans 2 rows) */}
          <div className="lg:row-span-2 flex flex-col gap-4">
            {/* Physical Measurements - Compact Card */}
            <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                    <Activity className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Vitals</h3>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                    title="Edit Vitals"
                  >
                    <Edit2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Height</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editFormData?.height || ""}
                      onChange={(e) => handleEditChange("height", e.target.value)}
                      placeholder="cm"
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                    />
                  ) : (
                    <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{patientData.height ? `${patientData.height} cm` : "N/A"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Weight</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editFormData?.weight || ""}
                      onChange={(e) => handleEditChange("weight", e.target.value)}
                      placeholder="kg"
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                    />
                  ) : (
                    <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{patientData.weight ? `${patientData.weight} kg` : "N/A"}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Medical Information - Bluish Theme (Stacked below Vitals) */}
            <div className="bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 dark:from-blue-900/20 dark:via-sky-900/20 dark:to-cyan-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-4 shadow-sm hover:shadow-md transition-shadow flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Heart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Medical Info</h3>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Edit Medical Info"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Allergies</label>
                  {isEditing ? (
                    <textarea
                      value={editFormData?.allergies || ""}
                      onChange={(e) => handleEditChange("allergies", e.target.value)}
                      placeholder="List allergies"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed">{patientData.allergies || "None"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Conditions</label>
                  {isEditing ? (
                    <textarea
                      value={editFormData?.chronicConditions || ""}
                      onChange={(e) => handleEditChange("chronicConditions", e.target.value)}
                      placeholder="List conditions"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed">{patientData.chronicConditions || "None"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Medications</label>
                  {isEditing ? (
                    <textarea
                      value={editFormData?.currentMedications || ""}
                      onChange={(e) => handleEditChange("currentMedications", e.target.value)}
                      placeholder="List medications"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed">{patientData.currentMedications || "None"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Surgeries</label>
                  {isEditing ? (
                    <textarea
                      value={editFormData?.previousSurgeries || ""}
                      onChange={(e) => handleEditChange("previousSurgeries", e.target.value)}
                      placeholder="List surgeries"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed">{patientData.previousSurgeries || "None"}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Emergency QR Code - Tall Card with Flip Animation (Rightmost) */}
          <div className="lg:row-span-2 bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-orange-900/20 dark:via-red-900/20 dark:to-pink-900/20 rounded-2xl shadow-lg hover:shadow-xl transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-pink-500/10 rounded-full blur-3xl"></div>

            <Link
              href={buildEmergencyUrl(walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 right-4 p-2 rounded-lg bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white hover:shadow-lg transition-shadow group z-10"
            >
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>

            <div className="relative z-10 p-6 h-full flex flex-col">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Emergency QR</h3>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Hover to see actions
                </p>
              </div>

              <CardFlip className="flex-1" height="100%">
                <CardFlipFront>
                  {({ onFlip }) => (
                    <div className="flex flex-col h-full">
                      {qrCode ? (
                        <div className="mb-4">
                          <div className="w-full p-4 bg-white rounded-xl shadow-lg flex items-center justify-center">
                            <img src={qrCode} alt="Emergency QR Code" className="w-48 h-48" />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4">
                          <div className="w-full p-4 bg-white/50 dark:bg-neutral-800/50 rounded-xl flex items-center justify-center">
                            <Loader2 className="w-12 h-12 animate-spin text-neutral-400" />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 flex-1 flex flex-col justify-end">
                        <button
                          onClick={() => {
                            if (qrCode) {
                              const link = document.createElement('a');
                              link.download = 'emergency-qr-code.png';
                              link.href = qrCode;
                              link.click();
                            }
                          }}
                          className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white py-3.5 rounded-xl hover:shadow-lg transition-shadow font-semibold flex items-center justify-center gap-2 text-base"
                        >
                          <QrCode className="w-5 h-5" />
                          Download QR
                        </button>

                        <button
                          onClick={() => {
                            const emergencyUrl = buildEmergencyUrl(walletAddress);
                            navigator.clipboard.writeText(emergencyUrl);
                            alert('Emergency link copied to clipboard!');
                          }}
                          className="w-full bg-white dark:bg-neutral-800 text-orange-600 dark:text-orange-400 border-2 border-orange-200 dark:border-orange-800 py-3.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors font-semibold flex items-center justify-center gap-2 text-base"
                        >
                          <Share2 className="w-5 h-5" />
                          Share Link
                        </button>

                        <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center mt-2">
                          Hover to preview emergency info
                        </p>
                      </div>
                    </div>
                  )}
                </CardFlipFront>

                <CardFlipBack>
                  {({ onFlip }) => (
                    <div className="flex flex-col h-full p-4 overflow-y-auto">
                      <div className="text-center mb-3">
                        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-1" />
                        <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-50">Emergency Info Preview</h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          What responders will see
                        </p>
                      </div>

                      <div className="space-y-2 text-xs flex-1">
                        <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-neutral-200 dark:border-neutral-700">
                          <p className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">Patient</p>
                          <p className="text-neutral-900 dark:text-neutral-100 font-medium">{patientData.name}</p>
                        </div>

                        <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-neutral-200 dark:border-neutral-700">
                          <p className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">Blood Group</p>
                          <p className="text-red-600 dark:text-red-400 font-bold text-base">{patientData.bloodGroup || "N/A"}</p>
                        </div>

                        <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-neutral-200 dark:border-neutral-700">
                          <p className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">Allergies</p>
                          <p className="text-neutral-900 dark:text-neutral-100">{patientData.allergies || "None"}</p>
                        </div>

                        <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-neutral-200 dark:border-neutral-700">
                          <p className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">Emergency Contact</p>
                          <p className="text-neutral-900 dark:text-neutral-100 font-medium">{patientData.emergencyName || "N/A"}</p>
                          <p className="text-neutral-600 dark:text-neutral-400">{patientData.emergencyPhone || "N/A"}</p>
                        </div>

                        <div className="bg-white dark:bg-neutral-800 rounded-lg p-2 border border-neutral-200 dark:border-neutral-700">
                          <p className="text-neutral-500 dark:text-neutral-400 font-semibold mb-1">Conditions</p>
                          <p className="text-neutral-900 dark:text-neutral-100">{patientData.chronicConditions || "None"}</p>
                        </div>
                      </div>

                      <button
                        onClick={onFlip}
                        className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors py-2"
                      >
                        ← Back to QR
                      </button>
                    </div>
                  )}
                </CardFlipBack>
              </CardFlip>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
    </div>
  );
}
