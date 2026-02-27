"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import {
    Users, Loader2, CheckCircle, TrendingUp, Search
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { loadRoleProfileFromChain } from "@/lib/role-profile-registry";
import {
    getRecordsUploadedByDoctor,
    getGrantedPatientsForDoctor
} from "@/lib/blockchain";

interface DoctorStats {
    totalPatients: number;
    activePermissions: number;
}

interface DiseaseData {
    name: string;
    count: number;
    percentage: number;
    color: string;
}

interface MedicationData {
    name: string;
    prescriptions: number;
    color: string;
}

export default function DoctorHome() {
    const { data: session, status } = useAuthSession();
    const router = useRouter();
    const userRole = session?.user?.role || "";
    const userEmail = session?.user?.email || "";
    const userWalletAddress = session?.user?.walletAddress || "";
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DoctorStats | null>(null);
    const [diseases, setDiseases] = useState<DiseaseData[]>([]);
    const [medications, setMedications] = useState<MedicationData[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState<{ found: boolean; walletAddress?: string; role?: string; patientName?: string; reason?: string; message?: string } | null>(null);
    const [searching, setSearching] = useState(false);
    const [availability, setAvailability] = useState<string>("");
    const [doctorName, setDoctorName] = useState<string>("");
    const { t } = useLanguage();
    const dashboardLoadKeyRef = useRef<string>("");

    const DOCTOR_AVAILABILITY_KEY = "doctor_availability";

    async function handleSearchPatient(e: React.FormEvent) {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        const looksLikeWallet = /^0x[a-fA-F0-9]{40}$/.test(q);
        if (looksLikeWallet || q.length < 2) {
            setSearchResult({ found: false });
            return;
        }
        const doctorWallet = (session?.user?.walletAddress || "").trim();
        if (!doctorWallet) {
            setSearchResult({ found: false, message: "Doctor wallet context missing." });
            return;
        }
        setSearching(true);
        setSearchResult(null);
        try {
            const res = await fetch(`/api/doctor/search?q=${encodeURIComponent(q)}&doctorWallet=${encodeURIComponent(doctorWallet)}`);
            const data = await res.json();
            setSearchResult(data);
        } catch (err) {
            console.error("Search failed:", err);
            setSearchResult({ found: false });
        } finally {
            setSearching(false);
        }
    }

    useEffect(() => {
        async function checkAuth() {
            if (status === "loading") return;
            if (status === "unauthenticated" || !session?.user) {
                router.push("/auth/login");
                return;
            }
            if (session.user.role !== "doctor") {
                router.push(session.user.role === "patient" ? "/patient/home" : "/");
                return;
            }
            // Doctor mode is only for title "Doctor", not other clinician titles
            try {
                const profile = await loadRoleProfileFromChain(
                    userEmail,
                    userWalletAddress || undefined
                );
                const title = typeof profile?.title === "string" ? profile.title : "";
                if (title && title !== "Doctor") {
                    router.push("/doctor/register?message=doctor-only");
                    return;
                }
                const name = typeof profile?.name === "string" ? profile.name.trim() : "";
                if (name) setDoctorName(name);
            } catch {
                // allow through; profile may not exist yet
            }
            const loadKey = `${userWalletAddress.toLowerCase()}|${userEmail.toLowerCase()}`;
            if (dashboardLoadKeyRef.current !== loadKey) {
                dashboardLoadKeyRef.current = loadKey;
                await loadDoctorData();
            }
            setLoading(false);
        }

        checkAuth();
    }, [status, userRole, userEmail, userWalletAddress, router]);



    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(DOCTOR_AVAILABILITY_KEY);
            if (saved) setAvailability(saved);
        }
    }, []);

    function handleAvailabilityChange(value: string) {
        setAvailability(value);
        if (typeof window !== "undefined") {
            if (value) localStorage.setItem(DOCTOR_AVAILABILITY_KEY, value);
            else localStorage.removeItem(DOCTOR_AVAILABILITY_KEY);
        }
    }

    async function loadDoctorData() {
        const addr = userWalletAddress;
        if (!addr) return;

        try {
            // 1. Fetch real metrics from blockchain
            const [uploadedRecords, grantedPatients] = await Promise.all([
                getRecordsUploadedByDoctor(addr),
                getGrantedPatientsForDoctor(addr)
            ]);

            // 2. Fallback to API for enriched chart data (diseases/medications) 
            // but override the main stats with real on-chain numbers
            let apiData = { diseases: [], medications: [], availability: "", stats: { totalPatients: 0, activePermissions: 0 } };
            try {
                const response = await fetch(`/api/doctor/dashboard?wallet=${encodeURIComponent(addr)}&identifier=${encodeURIComponent(userEmail)}`);
                apiData = await response.json();
            } catch (apiErr) {
                console.warn("Dashboard API fallback failed, using empty chart data.");
            }

            setStats({
                totalPatients: grantedPatients.length, // Doctors see how many patients granted them access
                activePermissions: uploadedRecords.length // Total records they've managed
            });

            setDiseases(apiData.diseases || []);
            setMedications(apiData.medications || []);
            if (apiData.availability != null) setAvailability(apiData.availability);
        } catch (error) {
            console.error("Error loading doctor data from blockchain:", error);
        }
    }

    // Calculate pie chart path for SVG
    const createPieSlice = (percentage: number, startAngle: number) => {
        const angle = (percentage / 100) * 360;
        const endAngle = startAngle + angle;

        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = 50 + 40 * Math.cos(startRad);
        const y1 = 50 + 40 * Math.sin(startRad);
        const x2 = 50 + 40 * Math.cos(endRad);
        const y2 = 50 + 40 * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        return `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
    };

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return null;
    }

    const totalMedications = medications.reduce((sum, med) => sum + med.prescriptions, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                {/* Search patient by email or phone */}
                <div className="mb-6">
                    <form onSubmit={handleSearchPatient} className="flex flex-wrap gap-3">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search patient by name, email, or phone"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={searching}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {searching ? "Searching…" : "Search"}
                        </button>
                    </form>
                    {searchResult && (
                        <div className="mt-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700/50">
                            {searchResult.found ? (
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <p className="font-medium text-neutral-900 dark:text-neutral-50">Patient found</p>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-400 font-mono">
                                            {searchResult.walletAddress}
                                        </p>
                                        {searchResult.patientName && (
                                            <p className="text-xs text-neutral-500">{searchResult.patientName}</p>
                                        )}
                                        {searchResult.role && (
                                            <p className="text-xs text-neutral-500">{searchResult.role}</p>
                                        )}
                                        {searchResult.reason && (
                                            <p className="text-xs text-neutral-500 capitalize">Access source: {searchResult.reason}</p>
                                        )}
                                    </div>
                                    <Link
                                        href={`/doctor/upload?patient=${searchResult.walletAddress}`}
                                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                                    >
                                        Request access / Upload
                                    </Link>
                                </div>
                            ) : (
                                <p className="text-neutral-600 dark:text-neutral-400">{searchResult.message || "No eligible patient found for this doctor."}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Welcome + Availability (below search bar) */}
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                            {t.portal.doctorHome.welcome}, {doctorName || `Dr. ${session?.user?.email?.split('@')[0] || 'Developer'}`}!
                        </h2>
                        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                            {session?.user?.email || 'dev@example.com'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">Available today</span>
                        <Switch
                            checked={availability === "Available today"}
                            onCheckedChange={(checked) => handleAvailabilityChange(checked ? "Available today" : "")}
                        />
                    </div>
                </div>

                {/* Stats with Line Dividers */}
                <div className="flex items-start gap-8 mb-12">
                    {/* Total Patients */}
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-3 mb-2">
                            <span className="text-5xl font-bold text-neutral-900 dark:text-neutral-50">
                                {stats?.totalPatients || 0}
                            </span>
                            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{t.portal.doctorHome.totalPatients}</h3>
                    </div>

                    {/* Separator */}
                    <span className="text-3xl text-neutral-300 dark:text-neutral-600 mt-2">|</span>

                    {/* Active Permissions */}
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-3 mb-2">
                            <span className="text-5xl font-bold text-green-600 dark:text-green-400">
                                {stats?.activePermissions || 0}
                            </span>
                            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{t.portal.doctorHome.activePermissions}</h3>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Diagnosed Diseases Pie Chart */}
                    <div>
                        <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-6">
                            {t.portal.doctorHome.patientsDiagnosed}
                        </h3>

                        <div className="flex items-center gap-8">
                            {/* Pie Chart */}
                            <div className="relative w-48 h-48 flex-shrink-0">
                                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                                    {diseases.map((disease, index) => {
                                        const startAngle = diseases
                                            .slice(0, index)
                                            .reduce((sum, d) => sum + (d.percentage / 100) * 360, 0);
                                        return (
                                            <path
                                                key={disease.name}
                                                d={createPieSlice(disease.percentage, startAngle)}
                                                fill={disease.color}
                                                className="hover:opacity-80 transition-opacity cursor-pointer"
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                            {stats?.totalPatients || 0}
                                        </p>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t.portal.doctorHome.patients}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex-1 space-y-3">
                                {diseases.map((disease) => (
                                    <div key={disease.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: disease.color }}
                                            />
                                            <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                                {disease.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                                                {disease.count}
                                            </span>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                ({disease.percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Most Prescribed Medications */}
                    <div>
                        <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-6">
                            {t.portal.doctorHome.mostPrescribed}
                        </h3>

                        <div className="space-y-4">
                            {medications.map((medication, index) => {
                                const percentage = (medication.prescriptions / totalMedications) * 100;
                                return (
                                    <div key={medication.name}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                                                {medication.name}
                                            </span>
                                            <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                                {medication.prescriptions} {t.portal.doctorHome.prescriptions}
                                            </span>
                                        </div>
                                        <div className="relative h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                                            <div
                                                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: medication.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Total */}
                        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                    {t.portal.doctorHome.totalPrescriptions}
                                </span>
                                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                                    {totalMedications}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
        </div>
    );
}
