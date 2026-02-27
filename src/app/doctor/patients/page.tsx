"use client";

import { useEffect, useState } from "react";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { fetchJSONFromIPFS } from "@/lib/ipfs";
import {
    getGrantedPatientsForDoctor,
    isHealthRegistryConfigured,
    fetchIdentityByWallet,
    getProvider,
} from "@/lib/blockchain";
import {
    Users,
    CheckCircle,
    Upload,
    Search,
    Loader2,
    WifiOff,
    Eye,
} from "lucide-react";
import Link from "next/link";

interface PatientGrant {
    id: string;
    patientAddress: string;
    patientName: string;
    patientEmail: string;
    grantedAt: string;
}

export default function DoctorPatientsPage() {
    const { data: session, status } = useAuthSession();
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [patients, setPatients] = useState<PatientGrant[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [chainAvailable, setChainAvailable] = useState(true);

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

            setLoading(false);
            await loadPatients();
        }

        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, status, router]);

    async function loadPatients() {
        const doctorAddress = user?.walletAddress ?? session?.user?.walletAddress;
        if (!doctorAddress) return;

        if (!isHealthRegistryConfigured()) {
            setChainAvailable(false);
            setPatients([]);
            return;
        }

        try {
            const grants = await getGrantedPatientsForDoctor(doctorAddress);

            // Resolve block numbers to actual timestamps
            const provider = getProvider();

            // Resolve patient identity names from IdentityRegistry (by wallet, not identifier)
            const resolved: PatientGrant[] = await Promise.all(
                grants.map(async (g, i) => {
                    let name = `Patient (${g.patient.slice(0, 8)}…)`;
                    let email = g.patient;
                    try {
                        const identity = await fetchIdentityByWallet(g.patient);
                        if (identity) {
                            if (identity.title) {
                                name = identity.title;
                            } else if (identity.lockACid) {
                                // Fallback: fetch name from lockA IPFS profile
                                try {
                                    const lockA = (await fetchJSONFromIPFS(identity.lockACid)) as any;
                                    const profileCid = lockA?.profileCid;
                                    if (profileCid) {
                                        const profile = (await fetchJSONFromIPFS(profileCid)) as any;
                                        const profileObj = profile?.profile ?? profile;
                                        if (profileObj?.name) name = profileObj.name;
                                        else if (profileObj?.fullName) name = profileObj.fullName;
                                    }
                                } catch { /* IPFS profile fetch failed */ }
                            }
                            email = identity.walletAddress;
                        }
                    } catch (err) {
                        console.error("Identity fetch failed for", g.patient, err);
                    }

                    // Convert block number to actual date
                    let grantedAt = new Date().toISOString();
                    if (g.timestamp && g.timestamp > 0) {
                        try {
                            const block = await provider.getBlock(g.timestamp);
                            if (block?.timestamp) {
                                grantedAt = new Date(block.timestamp * 1000).toISOString();
                            }
                        } catch {
                            // block fetch failed, keep current date
                        }
                    }

                    return {
                        id: g.recordId ?? `grant-${i}`,
                        patientAddress: g.patient,
                        patientName: name,
                        patientEmail: email,
                        grantedAt,
                    };
                })
            );
            setPatients(resolved);
        } catch {
            setChainAvailable(false);
            setPatients([]);
        }
    }

    const filtered = patients.filter(
        (p) =>
            p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.patientEmail.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
            <Navbar />

            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                                My Patients
                            </h1>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400">
                            Patients who have granted you access to their medical records
                        </p>
                    </div>

                    {/* Chain unavailable banner */}
                    {!chainAvailable && (
                        <div className="mb-6 flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
                            <WifiOff className="w-5 h-5 flex-shrink-0" />
                            <span>
                                HealthRegistry contract is not configured. Patient list will
                                appear here once the contract is deployed and{" "}
                                <code className="font-mono">
                                    NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS
                                </code>{" "}
                                is set.
                            </span>
                        </div>
                    )}

                    {/* Search */}
                    <div className="mb-6">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search patients by name or email"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Patient cards */}
                    {filtered.length === 0 ? (
                        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-12 text-center">
                            <Users className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
                                No patients found
                            </h3>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                {searchQuery
                                    ? "Try adjusting your search"
                                    : "Patients who grant you access will appear here"}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filtered.map((patient) => (
                                <div
                                    key={patient.id}
                                    className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                                                {patient.patientName
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")
                                                    .toUpperCase()
                                                    .slice(0, 2)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                                                    {patient.patientName}
                                                </h3>
                                                <p className="text-sm text-neutral-500 font-mono">
                                                    {patient.patientAddress}
                                                </p>
                                                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mt-1">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span>
                                                        Access granted{" "}
                                                        {new Date(patient.grantedAt).toLocaleDateString(
                                                            "en-IN",
                                                            {
                                                                day: "numeric",
                                                                month: "short",
                                                                year: "numeric",
                                                            }
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/doctor/queue?patient=${patient.patientAddress}`}
                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Manage Queue
                                            </Link>
                                            <Link
                                                href={`/doctor/records?patient=${patient.patientAddress}`}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                                            >
                                                <Eye className="w-4 h-4" />
                                                View Records
                                            </Link>
                                            <Link
                                                href={`/doctor/upload?patient=${patient.patientAddress}`}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                                            >
                                                <Upload className="w-4 h-4" />
                                                Upload Record
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
