"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, RefreshCw, Volume2, VolumeX, WifiOff, Wifi, Phone, AlertTriangle } from "lucide-react";
import OfflineIndicator from "@/components/OfflineIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { withPublicApiBase } from "@/lib/public-api-url";
import { 
  isZeroNetQR, 
  decodeEmergencyProfile, 
  profileToDisplayData,
  speakEmergencyProfile,
  stopSpeaking,
  getDataFreshness,
  getFreshnessColor,
  getFreshnessMessage,
  type EmergencyProfile
} from "@/lib/zero-net-qr-client";

interface PrivacySettings {
  gender: boolean;
  phone: boolean;
  email: boolean;
  address: boolean;
  height: boolean;
  weight: boolean;
  waistCircumference: boolean;
  previousSurgeries: boolean;
}

interface PatientEmergencyData {
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
  waistCircumference: string;
  profilePicture?: string;
  privacySettings: PrivacySettings;
}

// Cache duration: 7 days
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Utility functions for localStorage caching
function saveToCache(address: string, data: PatientEmergencyData) {
  if (typeof window === 'undefined') return;
  try {
    // Use a hash of the address to avoid overly long keys
    const cacheKey = `emergency_${address.substring(0, 20)}`;
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
  } catch (error) {
    console.warn('Failed to save to cache:', error);
  }
}

function loadFromCache(address: string): PatientEmergencyData | null {
  if (typeof window === 'undefined') return null;
  try {
    const cacheKey = `emergency_${address.substring(0, 20)}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn('Failed to load from cache:', error);
    return null;
  }
}

function getCacheAge(address: string): number | null {
  if (typeof window === 'undefined') return null;
  const cacheKey = `emergency_${address.substring(0, 20)}`;
  const timestamp = localStorage.getItem(`${cacheKey}_timestamp`);
  if (!timestamp) return null;
  return Date.now() - parseInt(timestamp);
}

function formatCacheAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type DataSource = 'zeronet' | 'server' | 'cache';

function extractZeroNetToken(raw: string): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const direct = value.match(/SS1:[A-Za-z0-9\-_]+/);
  if (direct?.[0]) return direct[0];
  const onceDecoded = safeDecode(value);
  const decodedMatch = onceDecoded.match(/SS1:[A-Za-z0-9\-_]+/);
  if (decodedMatch?.[0]) return decodedMatch[0];
  return null;
}

function fromStatusToEmergencyData(
  _walletAddress: string,
  statusPayload: Record<string, unknown>
): PatientEmergencyData {
  const asText = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    name: asText(statusPayload.fullName),
    dateOfBirth: asText(statusPayload.dateOfBirth),
    gender: asText(statusPayload.gender),
    bloodGroup: asText(statusPayload.bloodGroup),
    phone: asText(statusPayload.phone),
    email: asText(statusPayload.email),
    address: asText(statusPayload.address),
    city: asText(statusPayload.city),
    state: asText(statusPayload.state),
    pincode: asText(statusPayload.pincode),
    emergencyName: asText(statusPayload.emergencyName),
    emergencyRelation: asText(statusPayload.emergencyRelation),
    emergencyPhone: asText(statusPayload.emergencyPhone),
    allergies: asText(statusPayload.allergies),
    chronicConditions: asText(statusPayload.chronicConditions),
    currentMedications: asText(statusPayload.currentMedications),
    previousSurgeries: asText(statusPayload.previousSurgeries),
    height: asText(statusPayload.height),
    weight: asText(statusPayload.weight),
    waistCircumference: asText(statusPayload.waistCircumference),
    profilePicture: asText(statusPayload.profilePicture) || undefined,
    privacySettings: {
      gender: true,
      phone: false,
      email: false,
      address: false,
      height: false,
      weight: false,
      waistCircumference: false,
      previousSurgeries: false,
    },
  };
}

export default function EmergencyResponderPage({ params }: { params: { address: string } }) {
  const { t, tx, language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<PatientEmergencyData | null>(null);
  const [error, setError] = useState<string>("");
  const [isOnline, setIsOnline] = useState(true);
  const [dataSource, setDataSource] = useState<DataSource>('cache');
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [zeroNetProfile, setZeroNetProfile] = useState<EmergencyProfile | null>(null);
  const [dataAge, setDataAge] = useState<number>(0);

  // For static export on IPFS, dynamic paths are resolved via /emergency/placeholder?address=...
  // so prefer query param, then fallback to path param.
  const routeAddress = safeDecode(params.address || "");

  const getActiveEmergencyInput = (): string => {
    const queryAddress =
      typeof window !== "undefined"
        ? safeDecode(new URLSearchParams(window.location.search).get("address") || "")
        : "";
    const candidate = queryAddress || routeAddress;
    return candidate === "placeholder" ? "" : candidate;
  };

  const normalizeEmergencyInput = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const extracted = extractZeroNetToken(trimmed);
    if (extracted) return extracted;
    if (isZeroNetQR(trimmed)) return trimmed;
    try {
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const parsed = new URL(trimmed);
        const queryValue = parsed.searchParams.get("address");
        if (queryValue) {
          return normalizeEmergencyInput(safeDecode(queryValue));
        }
        const parts = parsed.pathname.split("/").filter(Boolean);
        const candidate = parts[parts.length - 1] ? safeDecode(parts[parts.length - 1]) : "";
        return candidate ? normalizeEmergencyInput(candidate) : trimmed;
      }
    } catch {
      // Fall through to raw input
    }
    return trimmed;
  };

  useEffect(() => {
    // Set initial online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // If we were using Zero-Net or cache, try to get enhanced data
      if (dataSource !== 'server' && zeroNetProfile?.w) {
        fetchEnhancedData(zeroNetProfile.w);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopSpeaking();
    };
  }, [dataSource, zeroNetProfile]);

  useEffect(() => {
    loadEmergencyData();
  }, [routeAddress]);

  async function loadEmergencyData() {
    try {
      setLoading(true);
      setError("");
      const activeInput = getActiveEmergencyInput();
      const fallbackHref = typeof window !== "undefined" ? window.location.href : "";
      const normalizedInput = normalizeEmergencyInput(activeInput || fallbackHref);
      if (!normalizedInput) {
        setError(tx("Invalid emergency data"));
        return;
      }

      // Check if this is Zero-Net QR data (starts with SS1:)
      const zeroNetToken = extractZeroNetToken(normalizedInput) || (isZeroNetQR(normalizedInput) ? normalizedInput : null);
      if (zeroNetToken) {
        const decoded = decodeEmergencyProfile(zeroNetToken);
        
        if (decoded) {
          setZeroNetProfile(decoded.profile);
          setDataAge(decoded.dataAge);
          setDataSource('zeronet');
          
          // Convert to display format
          const displayData = profileToDisplayData(decoded.profile);
          setPatientData({
            ...displayData,
            phone: '',
            email: '',
            address: '',
            city: '',
            state: '',
            pincode: '',
            previousSurgeries: '',
            height: '',
            weight: '',
            waistCircumference: '',
            profilePicture: undefined,
            privacySettings: {
              gender: true,
              phone: false,
              email: false,
              address: false,
              height: false,
              weight: false,
              waistCircumference: false,
              previousSurgeries: false
            }
          });
          
          // Try to fetch enhanced data in background if online
          if (navigator.onLine && decoded.profile.w) {
            fetchEnhancedData(decoded.profile.w);
          }
          
          setLoading(false);
          return;
        }
      }

      // Legacy mode: treat as wallet address and fetch from server
      await fetchFromServer(normalizedInput);
      
    } catch (error) {
      console.error("Error loading emergency data:", error);
      handleFetchError(getActiveEmergencyInput(), tx("No data available. Please connect to internet."));
    } finally {
      setLoading(false);
    }
  }

  async function fetchFromServer(walletAddress: string) {
    try {
      const emergencyApiUrl = withPublicApiBase(`/api/emergency/${encodeURIComponent(walletAddress)}`);
      const response = await fetch(emergencyApiUrl, { cache: "no-store" });

      if (!response.ok && response.status === 404) {
        const statusUrl = withPublicApiBase(`/api/patient/status?wallet=${encodeURIComponent(walletAddress)}`);
        const statusResponse = await fetch(statusUrl, { cache: "no-store" });
        if (statusResponse.ok) {
          const statusPayload = (await statusResponse.json()) as Record<string, unknown>;
          const mapped = fromStatusToEmergencyData(walletAddress, statusPayload);
          const hasAnyEmergencyData = Boolean(
            statusPayload.isRegisteredOnChain === true ||
            mapped.name ||
            mapped.bloodGroup ||
            mapped.emergencyPhone ||
            mapped.allergies ||
            mapped.currentMedications
          );
          if (hasAnyEmergencyData) {
            setPatientData(mapped);
            setDataSource('server');
            setError("");
            saveToCache(walletAddress, mapped);
            return;
          }
        }
      }

      if (!response.ok) {
        let message = tx("Failed to load patient emergency data");
        if (response.status === 404) {
          message = tx("Patient not found or not registered");
        } else if (response.status >= 500) {
          message = `${tx("Backend server error")} (${response.status})`;
        } else {
          message = `${tx("Failed to load patient emergency data")} (${response.status})`;
        }
        setError(message);
        handleFetchError(walletAddress, message);
        return;
      }

      const data = await response.json();
      setPatientData(data);
      setDataSource('server');
      
      // Save to cache for offline use
      saveToCache(walletAddress, data);
      
    } catch (error) {
      console.error("Fetch error:", error);
      handleFetchError(walletAddress, tx("No data available. Please connect to internet."));
    }
  }

  async function fetchEnhancedData(walletAddress: string) {
    try {
      const emergencyApiUrl = withPublicApiBase(`/api/emergency/${encodeURIComponent(walletAddress)}`);
      const response = await fetch(emergencyApiUrl, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setPatientData(data);
        // Promote to server mode when online data is available.
        setDataSource('server');
        setError("");
        saveToCache(walletAddress, data);
        return;
      }

      if (response.status === 404) {
        const statusUrl = withPublicApiBase(`/api/patient/status?wallet=${encodeURIComponent(walletAddress)}`);
        const statusResponse = await fetch(statusUrl, { cache: "no-store" });
        if (statusResponse.ok) {
          const statusPayload = (await statusResponse.json()) as Record<string, unknown>;
          const mapped = fromStatusToEmergencyData(walletAddress, statusPayload);
          if (mapped.name || mapped.bloodGroup || mapped.emergencyPhone || mapped.allergies) {
            setPatientData(mapped);
            setDataSource('server');
            setError("");
            saveToCache(walletAddress, mapped);
          }
        }
      }
    } catch (error) {
      // Silent fail - Zero-Net data is sufficient
      console.log('Enhanced data unavailable, using Zero-Net data');
    }
  }

  function handleFetchError(rawInput?: string, fallbackMessage?: string) {
    // Try cache fallback
    const normalizedInput = normalizeEmergencyInput(rawInput || getActiveEmergencyInput());
    const cached = loadFromCache(normalizedInput);
    if (cached) {
      setPatientData(cached);
      setDataSource('cache');
      setCacheAge(getCacheAge(normalizedInput));
      setError("");
    } else if (!patientData && fallbackMessage) {
      setError(fallbackMessage);
    }
  }

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else if (zeroNetProfile) {
      const speechLanguage = language === "bh" ? "hi" : language;
      speakEmergencyProfile(zeroNetProfile, speechLanguage);
      setIsSpeaking(true);
      
      // Reset speaking state when done (approximate)
      setTimeout(() => setIsSpeaking(false), 15000);
    }
  };

  const isVisible = (field: keyof PrivacySettings): boolean => {
    if (!patientData) return false;
    // In Zero-Net mode, only certain fields are available
    if (dataSource === 'zeronet') {
      return ['gender'].includes(field);
    }
    return patientData.privacySettings?.[field] ?? false;
  };

  const freshnessLevel = dataSource === 'zeronet' ? getDataFreshness(dataAge) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
          <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">{tx("Loading emergency profile...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-red-600">{tx("Emergency Access")}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t.portal.emergency.firstResponderView}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <OfflineIndicator />
              <div className="hidden sm:flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1">
                {(["en", "hi", "mr", "bh"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-1 text-xs rounded-full transition ${
                      language === lang
                        ? "bg-blue-600 text-white"
                        : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                {t.emergency.backToHome}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Source Banner */}
        {dataSource === 'zeronet' && (
          <div className={`rounded-xl p-4 mb-6 ${getFreshnessColor(freshnessLevel || 'fresh')} border-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <WifiOff className="w-6 h-6" />
                <div>
                  <p className="font-bold text-lg">Zero-Net Mode Active</p>
                  <p className="text-sm">{tx("Data loaded from QR code • Works 100% offline")}</p>
                  {freshnessLevel && (
                    <p className="text-xs mt-1">{getFreshnessMessage(freshnessLevel, language === "en" ? "en" : "hi")}</p>
                  )}
                </div>
              </div>
              
              {/* Voice Button */}
              <button
                onClick={toggleSpeech}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  isSpeaking 
                    ? 'bg-red-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                {isSpeaking ? tx("Stop") : tx("Read Aloud")}
              </button>
            </div>
            
            {/* Language Selector for Voice */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm">{tx("Voice Language")}:</span>
                  {(["hi", "en", "mr", "bh"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                  className={`px-3 py-1 text-sm rounded-full transition ${
                    language === lang
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/50 hover:bg-white/80'
                  }`}
                    >
                      {lang === "hi" ? "हिंदी" : lang === "mr" ? "मराठी" : lang === "bh" ? "भोजपुरी" : "English"}
                    </button>
                  ))}
                </div>
          </div>
        )}

        {dataSource === 'cache' && cacheAge !== null && (
          <div className={`rounded-lg p-4 mb-6 flex items-center justify-between gap-3 ${
            cacheAge > CACHE_DURATION_MS
              ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800'
              : cacheAge > 24 * 60 * 60 * 1000
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-800'
          }`}>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">Viewing Offline Cached Data</p>
                <p className="text-sm">{tx("Last updated")}: {formatCacheAge(cacheAge)}</p>
              </div>
            </div>
            {isOnline && (
              <button
                onClick={loadEmergencyData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                {tx("Sync Now")}
              </button>
            )}
          </div>
        )}

        {dataSource === 'server' && (
          <div className="rounded-lg p-4 mb-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-800 flex items-center gap-3">
            <Wifi className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-100">{tx("Live Data from Server")}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{tx("Connected to blockchain-verified records")}</p>
            </div>
          </div>
        )}

        {/* Emergency Alert Banner */}
        <div className="bg-red-600 dark:bg-red-700 text-white rounded-lg p-4 mb-6 flex items-center gap-3 border border-red-700 dark:border-red-800" role="alert">
          <AlertTriangle className="w-8 h-8 flex-shrink-0" />
          <div>
            <p className="font-semibold text-lg">
              {t.portal.emergency.emergencyInfo}
              {dataSource === 'zeronet' && ` (${tx("Offline Mode")})`}
            </p>
            <p className="text-sm">
              {dataSource === 'zeronet' 
                ? tx("Critical data decoded from QR code - works without internet")
                : tx("Critical patient info from blockchain, accessible via QR scan")
              }
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-900 dark:text-red-100">{error}</p>
          </div>
        )}

        {!patientData && !error && (
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 text-center">
            <p className="text-neutral-600 dark:text-neutral-400">{tx("No patient data available")}</p>
          </div>
        )}

        {patientData && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-lg">
              <div className="flex items-start gap-6 mb-6">
                {/* Profile Picture */}
                {patientData.profilePicture ? (
                  <div className="flex-shrink-0">
                    <img
                      src={patientData.profilePicture}
                      alt={patientData.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-blue-500 dark:border-blue-400 shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-4 border-blue-500 dark:border-blue-400 shadow-lg">
                    <span className="text-3xl font-bold text-white">
                      {patientData.name?.charAt(0).toUpperCase() || 'P'}
                    </span>
                  </div>
                )}

                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
                    {tx("Patient Emergency Profile")}
                  </h2>

                  {/* Personal Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {patientData.name && (
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{tx("Name")}</p>
                        <p className="font-semibold text-lg">{patientData.name}</p>
                      </div>
                    )}
                    {patientData.dateOfBirth && (
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{tx("DOB")}</p>
                        <p className="font-semibold">{patientData.dateOfBirth}</p>
                      </div>
                    )}
                    {patientData.gender && (
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{tx("Gender")}</p>
                        <p className="font-semibold capitalize">{patientData.gender}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Critical Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Blood Type - CRITICAL */}
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
                  <h3 className="font-bold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                    <span className="text-2xl">🩸</span> {t.portal.emergency.bloodType}
                  </h3>
                  <p className="text-4xl font-bold text-red-900 dark:text-red-100">
                    {patientData.bloodGroup || tx("Not specified")}
                  </p>
                </div>

                {/* Allergies - CRITICAL */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-800 rounded-xl p-4">
                  <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span> {t.portal.emergency.allergies}
                  </h3>
                  {patientData.allergies && patientData.allergies !== 'None reported' ? (
                    <div className="flex flex-wrap gap-2">
                      {patientData.allergies.split(',').map((a, i) => (
                        <span 
                          key={i} 
                          className="bg-yellow-200 dark:bg-yellow-800 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {a.trim()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-yellow-800 dark:text-yellow-200">{tx("None reported")}</p>
                  )}
                </div>

                {/* Conditions */}
                <div className="border-2 border-neutral-300 dark:border-neutral-700 rounded-xl p-4">
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    <span className="text-xl">🏥</span> {tx("Medical Conditions")}
                  </h3>
                  {patientData.chronicConditions && patientData.chronicConditions !== 'None reported' ? (
                    <ul className="space-y-1">
                      {patientData.chronicConditions.split(',').map((c, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          {c.trim()}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-neutral-500">{tx("None reported")}</p>
                  )}
                </div>

                {/* Medications */}
                <div className="border-2 border-neutral-300 dark:border-neutral-700 rounded-xl p-4">
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    <span className="text-xl">💊</span> {tx("Current Medications")}
                  </h3>
                  {patientData.currentMedications && patientData.currentMedications !== 'None reported' ? (
                    <ul className="space-y-1">
                      {patientData.currentMedications.split(',').map((m, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          {m.trim()}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-neutral-500">{tx("None reported")}</p>
                  )}
                </div>
              </div>

              {/* Emergency Contact - Always visible */}
              {(patientData.emergencyName || patientData.emergencyPhone) && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-800 rounded-xl p-4">
                  <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5" /> {t.portal.emergency.emergencyContactLabel}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {patientData.emergencyName && (
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{tx("Name")}</p>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">
                          {patientData.emergencyName}
                        </p>
                      </div>
                    )}
                    {patientData.emergencyRelation && (
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{tx("Relationship")}</p>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">
                          {patientData.emergencyRelation}
                        </p>
                      </div>
                    )}
                    {patientData.emergencyPhone && (
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{tx("Phone")}</p>
                        <a 
                          href={`tel:${patientData.emergencyPhone}`} 
                          className="font-semibold text-blue-600 underline text-lg"
                        >
                          {patientData.emergencyPhone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{tx("Privacy Notice")}</p>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 italic">
                  {dataSource === 'zeronet' 
                    ? tx("Showing essential emergency data embedded in QR code. Connect to internet for complete profile.")
                    : tx("Essential information is always visible for safety. Patient controls visibility of optional fields.")
                  }
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => window.print()} 
                className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg"
              >
                🖨️ {tx("Print Info")}
              </button>
              {patientData.emergencyPhone && (
                <a 
                  href={`tel:${patientData.emergencyPhone}`} 
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-semibold text-lg"
                >
                  📞 {tx("Call Emergency Contact")}
                </a>
              )}
            </div>

            {/* Emergency Helplines */}
            <div className="bg-red-600 dark:bg-red-700 text-white rounded-xl p-4 text-center">
              <p className="font-bold text-lg mb-2">🚑 {tx("Emergency Helplines")}</p>
              <div className="flex flex-wrap justify-center gap-4">
                <a href="tel:108" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                  <span className="font-bold">108</span> - {t.portal.emergency.ambulance}
                </a>
                <a href="tel:102" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                  <span className="font-bold">102</span> - {tx("Medical Emergency")}
                </a>
                <a href="tel:112" className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                  <span className="font-bold">112</span> - {tx("All Emergencies")}
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
