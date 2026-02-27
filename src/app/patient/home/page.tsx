"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import {
    FileText, Shield, QrCode, Loader2, CheckCircle,
    Heart, Activity, Droplet, Calendar, AlertCircle,
    TrendingUp, ArrowUpRight, Scale, Sparkles, RefreshCw, Settings, RotateCw,
    Check, X, CalendarDays, Share2, Copy, CheckCircle2
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useVoiceAssistant } from "@/components/VoiceCommandProvider";
import { useVoiceActions } from "@/hooks/useVoiceActions";
import MedicalDataPrompt from "@/components/patient/MedicalDataPrompt";
import CustomAIInputModal, { CustomHealthData } from "@/components/patient/CustomAIInputModal";
import { AnimatedInsightText } from "@/components/ui/AnimatedInsightText";
import { useClientData } from "@/lib/client-data";
import { getHealthInsightsClient } from "@/lib/client-data";
import { loadUnifiedPatientProfile, saveUnifiedPatientProfile } from "@/lib/patient-data-source";
import type { VoiceActionDefinition } from "@/lib/voice/types";
import type { HealthInsightsContent, HealthInsightsInput } from "@/lib/ai/health-insights";
import { normalizeHealthInsightsPayload } from "@/lib/ai/health-insights";
import { getJourney, getJourneys } from "@/features/journey/api";
import { createFamilyJourneyShareLink, type FamilyJourneySharePayload } from "@/lib/journey-share-client";
import { buildEmergencyUrl } from "@/lib/public-app-url";

interface PatientProfile {
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    phone?: string;
    streetAddress?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    allergies?: string;
    chronicConditions?: string;
    currentMedications?: string;
    previousSurgeries?: string;
    emergencyName?: string;
    emergencyRelation?: string;
    emergencyPhone?: string;
    isRegisteredOnChain?: boolean;
    walletAddress?: string;
    height?: string;
    weight?: string;
    profilePicture?: string;
    fullName?: string;
}

export default function PatientHome() {
    const { data: session, status } = useAuthSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<PatientProfile | null>(null);
    const [qrCode, setQrCode] = useState<string>("");
    const { t, tx, language } = useLanguage();

    // AI Health Insights state
    const [showDataPrompt, setShowDataPrompt] = useState(false);
    const [missingFields, setMissingFields] = useState<string[]>([]);
    const [aiInsights, setAiInsights] = useState<HealthInsightsContent | null>(null);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [showInsightsMenu, setShowInsightsMenu] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [showJourneyShareCard, setShowJourneyShareCard] = useState(false);
    const [journeyShareState, setJourneyShareState] = useState<"idle" | "loading" | "ready" | "no_journey" | "error">("idle");
    const [journeyShareUrl, setJourneyShareUrl] = useState("");
    const [journeyShareError, setJourneyShareError] = useState("");
    const [journeyShareCopied, setJourneyShareCopied] = useState(false);

    const { setPatientContext } = useVoiceAssistant();
    const hasRedirected = useRef(false);
    const voiceActions = useMemo<VoiceActionDefinition[]>(
        () => [
            { id: "patient_share_journey", label: "Share journey" },
            { id: "patient_open_timeline", label: "Open timeline" },
            { id: "patient_upload_record", label: "Upload record" },
            { id: "patient_open_emergency_qr", label: "Emergency QR" },
        ],
        []
    );

    useVoiceActions(voiceActions);

    // Sync patient data into the global voice assistant so it can read it back
    useEffect(() => {
        if (!profile) return;
        const h = profile.height ? parseFloat(profile.height) / 100 : null;
        const w = profile.weight ? parseFloat(profile.weight) : null;
        const bmiVal = h && w ? (w / (h * h)).toFixed(1) : null;
        const bmiCat = bmiVal
            ? parseFloat(bmiVal) < 18.5 ? "Underweight"
                : parseFloat(bmiVal) < 25 ? "Normal"
                    : parseFloat(bmiVal) < 30 ? "Overweight"
                        : "Obese"
            : null;
        setPatientContext({
            name: profile.fullName,
            medications: profile.currentMedications || "None",
            allergies: profile.allergies || "None",
            conditions: profile.chronicConditions || "None",
            bmi: bmiVal || undefined,
            bmiCategory: bmiCat || undefined,
            bloodGroup: profile.bloodGroup || undefined,
        });
    }, [profile, setPatientContext]);

    useEffect(() => {
        const wallet = session?.user?.walletAddress;
        if (status === "unauthenticated" && !hasRedirected.current) {
            hasRedirected.current = true;
            router.push("/");
            return;
        }
        if (status === "loading") return;

        if (!wallet) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            try {
                const unified = await loadUnifiedPatientProfile(wallet, session?.user?.email || "");
                const profileData: PatientProfile = {
                    ...unified,
                    fullName: unified.fullName,
                    walletAddress: unified.walletAddress,
                };

                // Don't redirect to register – show home with "complete registration" banner instead (avoids home↔register loop)
                setProfile(profileData);
                validateMedicalData(profileData);

                if ((profileData.isRegisteredOnChain || profileData.walletAddress) && profileData.walletAddress) {
                    const QRCode = (await import("qrcode")).default;
                    const emergencyUrl = buildEmergencyUrl(profileData.walletAddress);
                    const qr = await QRCode.toDataURL(emergencyUrl, { width: 200, margin: 2 });
                    setQrCode(qr);
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [status, session?.user?.walletAddress]); // stable deps to avoid repeated /api/patient/status calls

    // Keep insight copy synced with the selected app language.
    useEffect(() => {
        if (!profile || !aiInsights || loadingInsights) return;
        void generateAIInsights(profile);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);

    const calculateAge = (dob?: string): number | string => {
        if (!dob) return "N/A";
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const calculateAgeNumber = (dob?: string): number => {
        if (!dob) return 30; // Default age if not provided
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const getBloodGroupRarity = (bloodGroup?: string) => {
        const rarityMap: Record<string, { rarity: string; percentage: number }> = {
            "O+": { rarity: t.portal.patientHome.common, percentage: 37.4 },
            "A+": { rarity: t.portal.patientHome.common, percentage: 35.7 },
            "B+": { rarity: t.portal.patientHome.uncommon, percentage: 8.5 },
            "AB+": { rarity: t.portal.patientHome.rare, percentage: 3.4 },
            "O-": { rarity: t.portal.patientHome.veryRare, percentage: 6.6 },
            "A-": { rarity: t.portal.patientHome.rare, percentage: 6.3 },
            "B-": { rarity: t.portal.patientHome.rare, percentage: 1.5 },
            "AB-": { rarity: t.portal.patientHome.extremelyRare, percentage: 0.6 }
        };
        return rarityMap[bloodGroup || ""] || { rarity: t.portal.patientHome.unknown, percentage: 0 };
    };

    const getMedicationCount = () => {
        if (!profile?.currentMedications) return 0;
        return profile.currentMedications.split(',').filter(m => m.trim()).length;
    };

    const calculateBMI = () => {
        if (!profile?.height || !profile?.weight) return null;
        const heightInMeters = parseFloat(profile.height) / 100;
        const weightInKg = parseFloat(profile.weight);
        if (heightInMeters <= 0 || weightInKg <= 0) return null;
        const bmi = weightInKg / (heightInMeters * heightInMeters);
        return bmi.toFixed(1);
    };

    const getBMICategory = (bmi: number) => {
        if (bmi < 18.5) return { category: t.portal.patientHome.underweight, color: 'text-blue-600 dark:text-blue-400' };
        if (bmi < 25) return { category: t.portal.patientHome.normal, color: 'text-green-600 dark:text-green-400' };
        if (bmi < 30) return { category: t.portal.patientHome.overweight, color: 'text-orange-600 dark:text-orange-400' };
        return { category: t.portal.patientHome.obese, color: 'text-red-600 dark:text-red-400' };
    };

    const hasMedicalValue = (value?: string) => typeof value === "string" && value.trim().length > 0;

    // Track missing fields for profile completion while still allowing partial-data insights.
    const validateMedicalData = (data: PatientProfile) => {
        const missing: string[] = [];

        if (!hasMedicalValue(data.allergies)) {
            missing.push('allergies');
        }
        if (!hasMedicalValue(data.chronicConditions)) {
            missing.push('chronic_conditions');
        }
        if (!hasMedicalValue(data.currentMedications)) {
            missing.push('current_medications');
        }

        setMissingFields(missing);
        // Auto-generate insights once with whatever data is currently available.
        if (!aiInsights && !loadingInsights) {
            void generateAIInsights(data);
        }
    };

    const getMissingFieldLabel = (field: string) => {
        const labels: Record<string, string> = {
            allergies: t.patientReg.allergies,
            chronic_conditions: t.patientReg.conditions,
            current_medications: t.patientReg.medications,
        };
        return labels[field] || field;
    };

    // Generate AI health insights
    const generateAIInsights = async (data: PatientProfile) => {
        setLoadingInsights(true);
        try {
            const age = calculateAge(data.dateOfBirth);
            const bmiValue = calculateBMI();
            const bmiNumber = bmiValue ? parseFloat(bmiValue) : 22; // Default BMI if not available
            const bmiCategory = bmiValue ? getBMICategory(bmiNumber).category : 'Normal';

            const requestBody: HealthInsightsInput = {
                age: typeof age === 'number' ? age : 30,
                gender: data.gender || 'Not specified',
                bloodGroup: data.bloodGroup || 'Unknown',
                bmi: bmiNumber,
                bmiCategory,
                allergies: data.allergies || '',
                chronicConditions: data.chronicConditions || '',
                currentMedications: data.currentMedications || '',
                previousSurgeries: data.previousSurgeries || '',
                language,
            };

            console.log('🤖 Generating AI insights with data:', requestBody);

            if (useClientData()) {
                const result = await getHealthInsightsClient(requestBody);
                setAiInsights(normalizeHealthInsightsPayload(result.insights));
            } else {
                const response = await fetch('/api/ai/health-insights', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                if (response.ok) {
                    const result = await response.json();
                    setAiInsights(normalizeHealthInsightsPayload(result.insights));
                } else {
                    const errorText = await response.text();
                    alert(`Failed to generate AI insights: ${errorText}`);
                }
            }
            setShowInsightsMenu(false);
        } catch (error) {
            console.error('💥 Error generating AI insights:', error);
            alert(`Error generating AI insights: ${error}`);
        } finally {
            setLoadingInsights(false);
        }
    };

    // Generate AI insights with custom data
    const generateCustomAIInsights = async (customData: CustomHealthData) => {
        setLoadingInsights(true);
        try {
            const bmiCategory = customData.bmi < 18.5 ? 'Underweight' :
                customData.bmi < 25 ? 'Normal' :
                    customData.bmi < 30 ? 'Overweight' : 'Obese';

            const requestBody: HealthInsightsInput = {
                age: customData.age,
                gender: 'Not specified',
                bloodGroup: customData.bloodGroup,
                bmi: customData.bmi,
                bmiCategory,
                allergies: customData.allergies,
                chronicConditions: customData.chronicConditions,
                currentMedications: customData.currentMedications,
                previousSurgeries: '',
                language,
            };

            console.log('🤖 Generating AI insights with custom data:', requestBody);

            if (useClientData()) {
                const result = await getHealthInsightsClient(requestBody);
                setAiInsights(normalizeHealthInsightsPayload(result.insights));
            } else {
                const response = await fetch('/api/ai/health-insights', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                if (response.ok) {
                    const result = await response.json();
                    setAiInsights(normalizeHealthInsightsPayload(result.insights));
                } else {
                    const errorText = await response.text();
                    alert(`Failed to generate AI insights: ${errorText}`);
                }
            }
        } catch (error) {
            console.error('💥 Error generating AI insights:', error);
            alert(`Error generating AI insights: ${error}`);
        } finally {
            setLoadingInsights(false);
        }
    };

    // Save missing medical data
    const saveMedicalData = async (data: {
        allergies: string;
        chronicConditions: string;
        currentMedications: string;
    }) => {
        const wallet = session?.user?.walletAddress;
        if (!wallet) throw new Error("Not authenticated");
        try {
            const response = await saveUnifiedPatientProfile(wallet, data as unknown as Record<string, unknown>);
            if (response.success) {
                const unified = await loadUnifiedPatientProfile(wallet, session?.user?.email || "");
                const withWallet = { ...unified, fullName: unified.fullName, walletAddress: unified.walletAddress };
                setProfile(withWallet);
                validateMedicalData(withWallet);
            } else {
                throw new Error("Failed to update profile");
            }
        } catch (error) {
            console.error("Error saving medical data:", error);
            throw error;
        }
    };

    const closeJourneyShareCard = () => {
        setShowJourneyShareCard(false);
        setJourneyShareState("idle");
        setJourneyShareUrl("");
        setJourneyShareError("");
        setJourneyShareCopied(false);
    };

    const copyJourneyShareLink = async () => {
        if (!journeyShareUrl) return;
        try {
            await navigator.clipboard.writeText(journeyShareUrl);
            setJourneyShareCopied(true);
            setTimeout(() => setJourneyShareCopied(false), 1800);
        } catch (err) {
            console.error("Failed to copy share link:", err);
        }
    };

    const openJourneyShareCard = async () => {
        setShowJourneyShareCard(true);
        setJourneyShareState("loading");
        setJourneyShareUrl("");
        setJourneyShareError("");
        setJourneyShareCopied(false);

        const wallet = session?.user?.walletAddress;
        if (!wallet) {
            setJourneyShareState("error");
            setJourneyShareError(tx("Wallet not available for sharing right now."));
            return;
        }

        try {
            const journeysResponse = await getJourneys("active", wallet);
            const activeJourney = (journeysResponse.journeys || []).find((j) => j.status === "active") || null;
            if (!activeJourney) {
                setJourneyShareState("no_journey");
                return;
            }

            const journeyResponse = await getJourney(activeJourney.id, wallet);
            const journey = journeyResponse.journey as unknown as {
                id: string;
                hospital?: { name?: string };
                tokenNumber?: string;
                progressPercent?: number;
                status?: string;
                startedAt?: string;
                checkpoints?: Array<{
                    status?: string;
                    updatedAt?: string;
                    queuePosition?: number;
                    estimatedWaitMinutes?: number;
                    department?: { name?: string; floor?: number };
                }>;
            };

            const payload: FamilyJourneySharePayload = {
                journeyId: journey.id,
                hospitalName: journey.hospital?.name || tx("Hospital"),
                tokenNumber: journey.tokenNumber || "",
                progressPercent: journey.progressPercent || 0,
                status: journey.status || "active",
                startedAt: journey.startedAt || new Date().toISOString(),
                checkpoints: (journey.checkpoints || []).map((cp) => ({
                    name: cp.department?.name || tx("Department"),
                    floor: cp.department?.floor,
                    status: cp.status || "pending",
                    queuePosition: cp.queuePosition,
                    estimatedWaitMinutes: cp.estimatedWaitMinutes,
                    updatedAt: cp.updatedAt,
                })),
            };

            const shareLink = await createFamilyJourneyShareLink(payload, window.location.origin, 180);
            setJourneyShareUrl(shareLink);
            setJourneyShareState("ready");
        } catch (err) {
            console.error("Failed to create journey share link:", err);
            setJourneyShareState("error");
            setJourneyShareError(tx("Unable to create share link right now. Please try again."));
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return null;
    }

    const isRegistered = profile?.isRegisteredOnChain || false;
    const bloodInfo = getBloodGroupRarity(profile?.bloodGroup);
    const medicationCount = getMedicationCount();
    const bmi = calculateBMI();
    const bmiInfo = bmi ? getBMICategory(parseFloat(bmi)) : null;

    return (
        <div className="min-h-screen bg-white dark:bg-neutral-900">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                {/* Header */}
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-50" id="patient-welcome">
                            <span className="block text-base md:text-lg font-normal text-neutral-600 dark:text-neutral-400 mb-1">
                                {t.portal.patientHome.welcomeBack},
                            </span>
                            {profile?.fullName || session?.user?.email?.split('@')[0] || 'Developer'}!
                        </h2>
                        <p className="text-neutral-600 dark:text-neutral-400 mt-1 hidden md:block">
                            {session?.user?.email || 'dev@example.com'}
                        </p>
                    </div>

                    {/* Right side: Book Appointment */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            id="share-journey-top-btn"
                            onClick={() => { void openJourneyShareCard(); }}
                            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 text-base"
                            aria-label={t.portal.patientHome.shareJourneyLink}
                        >
                            <Share2 className="w-5 h-5" />
                            {t.portal.patientHome.shareJourneyLink}
                        </button>

                        {/* Journey (start / view) — moved from middle nav capsule */}
                        <button
                            id="journey-btn"
                            onClick={() => router.push('/patient/journey')}
                            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-base"
                            aria-label={tx("Start or view hospital journey")}
                        >
                            <CalendarDays className="w-5 h-5" />
                            {t.nav.journey}
                        </button>
                    </div>
                </div>

                {/* Registration Status Banner */}
                {!isRegistered && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-8">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                                    {t.portal.patientHome.completeRegistration}
                                </p>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                                    {t.portal.patientHome.completeRegistrationDesc}
                                </p>
                                <button
                                    onClick={() => router.push("/patient/register")}
                                    className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                                >
                                    {t.portal.patientHome.registerNow}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isRegistered && profile ? (
                    <>
                        {/* 2-Panel Layout: Left = Patient Info (60%), Right = AI Insights (40%) */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                            {/* Left Panel: Patient Information (60% = 3/5) */}
                            <div className="lg:col-span-3 space-y-8">
                                {/* BMI | Blood Group - Side by Side with Values on Top */}
                                <div className="flex items-start gap-4 md:gap-8">
                                    {/* BMI */}
                                    {bmi && bmiInfo && (
                                        <div className="flex flex-col">
                                            <div className="flex items-baseline gap-2 md:gap-3 mb-1 md:mb-2">
                                                <span className="text-3xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-50">{bmi}</span>
                                                <span className={`text-base md:text-xl font-medium ${bmiInfo.color}`}>{bmiInfo.category}</span>
                                            </div>
                                            <h3 className="text-xs md:text-sm font-medium text-neutral-600 dark:text-neutral-400">{t.portal.patientHome.bodyMassIndex}</h3>
                                        </div>
                                    )}

                                    {/* Separator */}
                                    {bmi && bmiInfo && <span className="text-2xl md:text-3xl text-neutral-300 dark:text-neutral-600 mt-1 md:mt-2">|</span>}

                                    {/* Blood Group */}
                                    <div className="flex flex-col">
                                        <div className="flex items-baseline gap-2 md:gap-3 mb-1 md:mb-2">
                                            <span className="text-3xl md:text-5xl font-bold text-rose-600 dark:text-rose-400">{profile.bloodGroup || tx("N/A")}</span>
                                            <span className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400">
                                                {bloodInfo.rarity} • {bloodInfo.percentage}%
                                            </span>
                                        </div>
                                        <h3 className="text-xs md:text-sm font-medium text-neutral-600 dark:text-neutral-400">{t.portal.patientHome.bloodGroup}</h3>
                                    </div>

                                    {/* Separator */}
                                    {profile?.chronicConditions && <span className="text-2xl md:text-3xl text-neutral-300 dark:text-neutral-600 mt-1 md:mt-2">|</span>}

                                    {/* Diagnosed With */}
                                    {profile?.chronicConditions && (
                                        <div className="flex flex-col">
                                            <div className="flex items-baseline gap-2 md:gap-3 mb-1 md:mb-2">
                                                <span className="text-xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-50 line-clamp-1">{profile.chronicConditions}</span>
                                            </div>
                                            <h3 className="text-xs md:text-sm font-medium text-neutral-600 dark:text-neutral-400">{t.portal.patientHome.diagnosedWith}</h3>
                                        </div>
                                    )}
                                </div>

                                {/* Current Medications */}
                                {profile.currentMedications && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-3">{t.portal.patientHome.currentMedications}</h3>
                                        <div className="ml-4 pl-4 space-y-3 relative">
                                            {profile.currentMedications.split(',').filter(m => m.trim()).map((med, idx, arr) => {
                                                const isLast = idx === arr.length - 1;
                                                return (
                                                    <div key={idx} className="relative">
                                                        {/* Vertical line (only if not last) */}
                                                        {!isLast && (
                                                            <div className="absolute left-[-1rem] top-0 bottom-0 w-0.5 bg-neutral-300 dark:bg-neutral-600"></div>
                                                        )}

                                                        {/* Vertical line for last item (only to the connector) */}
                                                        {isLast && (
                                                            <div className="absolute left-[-1rem] top-0 h-3 w-0.5 bg-neutral-300 dark:bg-neutral-600"></div>
                                                        )}

                                                        {/* Horizontal connector */}
                                                        <div className="absolute left-[-1rem] top-3 w-4 h-0.5 bg-neutral-300 dark:bg-neutral-600"></div>

                                                        {/* Medication info */}
                                                        <div>
                                                            <p className="font-medium text-neutral-900 dark:text-neutral-100">{med.trim()}</p>
                                                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                                                {t.portal.patientHome.selfReportedMedication}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Panel: AI Health Insights (40% = 2/5) */}
                            <div className="lg:col-span-2">
                {/* AI Insights Card wrapper */}
                                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 shadow-sm">
                                    <div className="p-5">
                                        {/* AI Health Insights */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{t.portal.patientHome.aiHealthInsights}</h3>
                                                </div>
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setShowInsightsMenu((prev) => !prev)}
                                                        disabled={loadingInsights}
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition disabled:opacity-40"
                                                        aria-label={t.portal.patientHome.customizeAiInsights}
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>

                                                    {showInsightsMenu && (
                                                        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 z-50 p-4 space-y-3">
                                                            <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">{t.portal.patientHome.customizeInsights}</h4>
                                                            {missingFields.length > 0 && (
                                                                <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2">
                                                                    <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                                                                        {tx("{count} fields are missing", { scope: "insights_settings" }).replace("{count}", String(missingFields.length))}
                                                                    </p>
                                                                    <ul className="mt-1 space-y-1">
                                                                        {missingFields.map((field) => (
                                                                            <li key={field} className="text-xs text-amber-800 dark:text-amber-200">
                                                                                • {getMissingFieldLabel(field)}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            <button
                                                                onClick={() => {
                                                                    setShowInsightsMenu(false);
                                                                    setShowCustomInput(true);
                                                                }}
                                                                className="w-full px-3 py-2 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-700 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-sm rounded-lg transition font-medium"
                                                            >
                                                                {t.portal.patientHome.customizeAiInsights}
                                                            </button>

                                                            {missingFields.length > 0 && (
                                                                <button
                                                                    onClick={() => {
                                                                        setShowInsightsMenu(false);
                                                                        setShowDataPrompt(true);
                                                                    }}
                                                                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-200 text-sm rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition font-medium"
                                                                >
                                                                    {t.portal.patientHome.completeProfile}
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => profile && generateAIInsights(profile)}
                                                                className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition font-medium"
                                                            >
                                                                {t.portal.patientHome.regenerate}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* AI Insights */}
                                            {(
                                                <div className="space-y-3">
                                                    {loadingInsights ? (
                                                        <div className="text-center py-8">
                                                            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                                                            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.portal.patientHome.generatingInsights}</p>
                                                        </div>
                                                    ) : aiInsights ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="rounded-xl border border-green-200/80 dark:border-green-800/50 bg-green-50/40 dark:bg-green-900/10 p-4">
                                                                <h4 className="font-semibold text-lg text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                                                                    <CheckCircle className="w-5 h-5" />
                                                                    {t.portal.patientHome.insightDos}
                                                                </h4>
                                                                <ul className="space-y-3">
                                                                    {aiInsights.dos?.map((item: string, idx: number) => (
                                                                        <li key={idx} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                                                            <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                                                            <AnimatedInsightText text={item} speed="fast" />
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>

                                                            <div className="rounded-xl border border-red-200/80 dark:border-red-800/50 bg-red-50/40 dark:bg-red-900/10 p-4">
                                                                <h4 className="font-semibold text-lg text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                                                                    <AlertCircle className="w-5 h-5" />
                                                                    {t.portal.patientHome.insightDonts}
                                                                </h4>
                                                                <ul className="space-y-3">
                                                                    {aiInsights.donts?.map((item: string, idx: number) => (
                                                                        <li key={idx} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                                                            <X className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                                                            <AnimatedInsightText text={item} speed="fast" />
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-6">
                                                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                                                                {t.portal.patientHome.generatePersonalizedInsights}
                                                            </p>
                                                            <button
                                                                onClick={() => profile && generateAIInsights(profile)}
                                                                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition font-medium"
                                                            >
                                                                {t.portal.patientHome.generateInsights}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>{/* end card inner padding */}
                                </div>{/* end AI card wrapper */}

                                {/* Medical Data Prompt Modal */}
                                <MedicalDataPrompt
                                    isOpen={showDataPrompt}
                                    onClose={() => setShowDataPrompt(false)}
                                    onSave={saveMedicalData}
                                    missingFields={missingFields}
                                />

                                {/* Custom AI Input Modal */}
                                <CustomAIInputModal
                                    isOpen={showCustomInput}
                                    onClose={() => setShowCustomInput(false)}
                                    onGenerate={generateCustomAIInsights}
                                    currentData={{
                                        age: profile?.dateOfBirth ? calculateAgeNumber(profile.dateOfBirth) : 30,
                                        bloodGroup: profile?.bloodGroup || '',
                                        bmi: calculateBMI() ? parseFloat(calculateBMI()!) : 22,
                                        allergies: profile?.allergies || '',
                                        chronicConditions: profile?.chronicConditions || '',
                                        currentMedications: profile?.currentMedications || ''
                                    }}
                                />
                            </div>
                        </div>

                    </>
                ) : (
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-12 text-center">
                        <AlertCircle className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
                        <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                            {t.portal.patientHome.noProfileData}
                        </p>
                    </div>
                )}
            </main>

            {showJourneyShareCard && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-2xl">
                        <div className="p-5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                                    {t.portal.patientHome.shareJourneyTitle}
                                </h3>
                            </div>
                            <button
                                onClick={closeJourneyShareCard}
                                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
                                aria-label={t.common.cancel}
                            >
                                <X className="w-4 h-4 text-neutral-500" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {journeyShareState === "loading" && (
                                <div className="py-8 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                        {tx("Preparing your share link...")}
                                    </p>
                                </div>
                            )}

                            {journeyShareState === "no_journey" && (
                                <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
                                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                                        {tx("No active journey found")}
                                    </p>
                                    <p className="text-xs text-amber-800 dark:text-amber-200 mb-4">
                                        {t.portal.patientHome.shareJourneyHint}
                                    </p>
                                    <button
                                        onClick={() => router.push("/patient/journey/start")}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition"
                                    >
                                        {tx("Start First Journey")}
                                    </button>
                                </div>
                            )}

                            {journeyShareState === "error" && (
                                <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4">
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                        {journeyShareError || tx("Unable to create share link right now. Please try again.")}
                                    </p>
                                    <button
                                        onClick={() => { void openJourneyShareCard(); }}
                                        className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition"
                                    >
                                        {tx("Try again")}
                                    </button>
                                </div>
                            )}

                            {journeyShareState === "ready" && (
                                <>
                                    <div className="rounded-xl border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-4 text-center">
                                        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-1" />
                                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                                            {tx("Share link ready")}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={journeyShareUrl}
                                            readOnly
                                            className="flex-1 bg-transparent text-xs md:text-sm text-neutral-900 dark:text-neutral-100 outline-none"
                                        />
                                        <button
                                            onClick={copyJourneyShareLink}
                                            className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                                            aria-label={tx("Copy link")}
                                        >
                                            {journeyShareCopied ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={copyJourneyShareLink}
                                            className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-700 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg text-sm font-semibold transition"
                                        >
                                            {journeyShareCopied ? tx("Copied") : tx("Copy Link")}
                                        </button>
                                        <a
                                            href={`https://wa.me/?text=${encodeURIComponent(`${tx("Track my hospital journey live")}: ${journeyShareUrl}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition"
                                        >
                                            {tx("Share on WhatsApp")}
                                        </a>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
        </div>
    );
}
