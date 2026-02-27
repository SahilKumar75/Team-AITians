"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Navbar } from "@/components/Navbar";
import { CardFlip, CardFlipFront, CardFlipBack } from "@/components/ui/card-flip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Download,
  Printer,
  Share2,
  Copy,
  AlertCircle,
  Shield,
  Info,
  Wifi,
  WifiOff,
  CheckCircle,
  QrCode,
} from "lucide-react";
import { loadUnifiedPatientProfile } from "@/lib/patient-data-source";
import { buildEmergencyVCard, encodeEmergencyProfileClient } from "@/lib/zero-net-qr-client";

interface PatientStatus {
  fullName?: string;
  profilePicture?: string;
  bloodGroup?: string;
  allergies?: string;
  currentMedications?: string;
  chronicConditions?: string;
  emergencyName?: string;
  emergencyPhone?: string;
}

export default function PatientEmergencyPage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const { t, tx } = useLanguage();
  const walletAddress = session?.user?.walletAddress ?? "";
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<PatientStatus | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [nfcCopied, setNfcCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const payloadFingerprint = useMemo(
    () =>
      [
        walletAddress.toLowerCase(),
        patientData?.fullName || "",
        patientData?.bloodGroup || "",
        patientData?.allergies || "",
        patientData?.currentMedications || "",
        patientData?.chronicConditions || "",
        patientData?.emergencyName || "",
        patientData?.emergencyPhone || "",
      ].join("|"),
    [
      walletAddress,
      patientData?.fullName,
      patientData?.bloodGroup,
      patientData?.allergies,
      patientData?.currentMedications,
      patientData?.chronicConditions,
      patientData?.emergencyName,
      patientData?.emergencyPhone,
    ]
  );

  const stableIssuedAt = useMemo(() => {
    if (typeof window === "undefined" || !walletAddress || !patientData) return undefined;
    const key = `swasthya_emergency_qr_meta_${walletAddress.toLowerCase()}`;
    const now = Math.floor(Date.now() / 1000);
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { fingerprint?: string; issuedAt?: number };
        if (parsed?.fingerprint === payloadFingerprint && typeof parsed.issuedAt === "number") {
          return parsed.issuedAt;
        }
      }
      const next = { fingerprint: payloadFingerprint, issuedAt: now };
      window.localStorage.setItem(key, JSON.stringify(next));
      return now;
    } catch {
      return now;
    }
  }, [walletAddress, patientData, payloadFingerprint]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
    if (status === "authenticated" && walletAddress) {
      (async () => {
        try {
          const unified = await loadUnifiedPatientProfile(walletAddress, session?.user?.email || "");
          setPatientData({
            fullName: unified.fullName,
            profilePicture: unified.profilePicture,
            bloodGroup: unified.bloodGroup,
            allergies: unified.allergies,
            currentMedications: unified.currentMedications,
            chronicConditions: unified.chronicConditions,
            emergencyName: unified.emergencyName,
            emergencyPhone: unified.emergencyPhone,
          });
        } catch (err) {
          console.error("Error fetching patient data:", err);
        } finally {
          setLoading(false);
        }
      })();
    } else if (!walletAddress && status !== "loading") {
      setLoading(false);
    }
  }, [status, router, walletAddress, session?.user?.email]);

  const offlinePayload = useMemo(() => {
    if (!walletAddress || !patientData) return "";
    return encodeEmergencyProfileClient({
      fullName: patientData.fullName,
      dateOfBirth: "",
      gender: "",
      bloodGroup: patientData.bloodGroup,
      allergies: patientData.allergies,
      currentMedications: patientData.currentMedications,
      chronicConditions: patientData.chronicConditions,
      emergencyName: patientData.emergencyName,
      emergencyRelation: "",
      emergencyPhone: patientData.emergencyPhone,
      walletAddress,
      issuedAtUnix: stableIssuedAt,
    });
  }, [
    walletAddress,
    patientData?.fullName,
    patientData?.bloodGroup,
    patientData?.allergies,
    patientData?.currentMedications,
    patientData?.chronicConditions,
    patientData?.emergencyName,
    patientData?.emergencyPhone,
    stableIssuedAt,
  ]);

  const emergencyUrl =
    typeof window !== "undefined" && walletAddress
      ? `${window.location.origin}/emergency/${encodeURIComponent(offlinePayload || walletAddress)}`
      : "";
  const vCardPayload = useMemo(() => {
    if (!walletAddress || !patientData) return "";
    return buildEmergencyVCard(
      {
        fullName: patientData.fullName,
        bloodGroup: patientData.bloodGroup,
        allergies: patientData.allergies,
        currentMedications: patientData.currentMedications,
        chronicConditions: patientData.chronicConditions,
        emergencyName: patientData.emergencyName,
        emergencyPhone: patientData.emergencyPhone,
        walletAddress,
      },
      emergencyUrl
    );
  }, [
    walletAddress,
    patientData?.fullName,
    patientData?.bloodGroup,
    patientData?.allergies,
    patientData?.currentMedications,
    patientData?.chronicConditions,
    patientData?.emergencyName,
    patientData?.emergencyPhone,
    emergencyUrl,
  ]);
  const qrPayload = vCardPayload || emergencyUrl || offlinePayload || walletAddress;

  useEffect(() => {
    if (typeof window === "undefined" || !walletAddress || !offlinePayload) return;
    const seedOffline = async () => {
      try {
        // Warm emergency route and API in browser cache for offline responder PWA mode.
        await fetch(`/emergency/${encodeURIComponent(offlinePayload)}`, { cache: "reload" }).catch(() => null);
        await fetch(`/api/emergency/${encodeURIComponent(walletAddress)}`, { cache: "reload" }).catch(() => null);

        if ("caches" in window) {
          const c = await caches.open("emergency-prefetch-v1");
          await c.add(`/emergency/${encodeURIComponent(offlinePayload)}`).catch(() => null);
          await c.add(`/api/emergency/${encodeURIComponent(walletAddress)}`).catch(() => null);
        }
        setOfflineReady(true);
      } catch {
        setOfflineReady(false);
      }
    };
    seedOffline();
  }, [walletAddress, offlinePayload]);

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "emergency-qr-code.png";
      link.href = pngFile;
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const printQR = () => window.print();
  const copyNfcLink = async () => {
    if (!emergencyUrl) return;
    try {
      await navigator.clipboard.writeText(emergencyUrl);
      setNfcCopied(true);
      setTimeout(() => setNfcCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy NFC link:", err);
    }
  };
  const shareQR = async () => {
    if (navigator.share && emergencyUrl) {
      try {
        await navigator.share({
          title: tx("My Emergency Medical QR Code"),
          text: tx("Scan this QR code to access my emergency medical information"),
          url: emergencyUrl,
        });
      } catch (err) {
        console.log("Share failed:", err);
      }
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100" />
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900">
        <Navbar />
        <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 pt-24">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-8 text-center">
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              {t.portal.emergency.noWallet}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {t.portal.emergency.noWalletDesc}
            </p>
            <Link
              href="/patient/register"
              className="px-6 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition inline-block"
            >
              {t.portal.emergency.goToRegistration}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 pt-24">
        <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
              {t.portal.emergency.medicalCard}
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              {t.portal.emergency.medicalCardDesc}
            </p>
          </div>
          {emergencyUrl && (
            <div className="w-full md:w-[420px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-3">
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                {tx("NFC Tag Link")}
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={emergencyUrl}
                  className="flex-1 px-2 py-1.5 text-xs rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <button
                  type="button"
                  onClick={copyNfcLink}
                  className="px-3 py-1.5 text-xs rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:bg-neutral-700 dark:hover:bg-neutral-200 transition flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {nfcCopied ? tx("Copied") : tx("Copy")}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {tx("Write this URL to an NFC tag for tap-to-open emergency profile.")}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CardFlip height="700px">
            <CardFlipFront className="bg-white dark:bg-neutral-800 rounded-lg border-2 border-neutral-200 dark:border-neutral-700 p-8">
              <div className="h-full flex flex-col">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                    {t.portal.emergency.yourQRCode}
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    {tx("Scan to view emergency info (offline-capable)")}
                  </p>
                </div>
                <div
                  ref={qrRef}
                  className="bg-white p-6 rounded-lg border-4 border-neutral-900 dark:border-neutral-100 mb-4 flex flex-col items-center justify-center flex-1 print:border-8"
                >
                  <QRCodeSVG
                    value={qrPayload}
                    size={280}
                    level="H"
                    includeMargin={true}
                    className="w-full h-auto max-w-[280px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 print:hidden">
                  <button
                    onClick={downloadQR}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    <Download className="w-4 h-4" />
                    {t.portal.emergency.download}
                  </button>
                  <button
                    onClick={printQR}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition font-medium"
                  >
                    <Printer className="w-4 h-4" />
                    {t.portal.emergency.print}
                  </button>
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button
                      onClick={shareQR}
                      className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      <Share2 className="w-4 h-4" />
                      {t.portal.emergency.share}
                    </button>
                  )}
                </div>
                <div className="mt-3 text-xs text-center">
                  {offlineReady ? (
                    <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {tx("Offline cache primed")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <Wifi className="w-3.5 h-3.5" />
                      {tx("Preparing offline cache...")}
                    </span>
                  )}
                </div>
              </div>
            </CardFlipFront>

            <CardFlipBack className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 p-8">
              <div className="h-full flex flex-col">
                <div className="text-center mb-6">
                  <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl w-fit mx-auto mb-3">
                    <WifiOff className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
                    {tx("Zero-Net Protocol")}
                  </h2>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {tx("Works without internet when enabled")}
                  </p>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto">
                  <div className="bg-white/50 dark:bg-neutral-900/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                      {tx("How Zero-Net Works")}
                    </h3>
                    <ul className="space-y-1 text-xs text-green-800 dark:text-green-200">
                      <li>{tx("• Emergency data can be embedded directly in the QR code")}</li>
                      <li>{tx("• No internet needed to read it in offline mode")}</li>
                      <li>{tx("• Works in rural areas, tunnels, or network outages")}</li>
                    </ul>
                  </div>
                  <div className="bg-white/50 dark:bg-neutral-900/50 rounded-lg p-4">
                    <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-semibold">
                      {tx("Blockchain Address (for full records)")}
                    </p>
                    <p className="text-xs font-mono text-green-900 dark:text-green-100 break-all">
                      {walletAddress}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
                  <p className="text-xs text-green-700 dark:text-green-300 text-center">
                    {tx("Flip card to see QR code")}
                  </p>
                </div>
              </div>
            </CardFlipBack>
          </CardFlip>

          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden"
            style={{ height: "700px" }}
          >
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                  </div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                    {t.portal.emergency.firstResponderView}
                  </h2>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {tx("This is what paramedics see when they scan your QR code")}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-700">
                  {patientData?.profilePicture ? (
                    <img
                      src={patientData.profilePicture}
                      alt={patientData.fullName || tx("Patient")}
                      className="w-16 h-16 rounded-full object-cover border-2 border-neutral-300 dark:border-neutral-600 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-300 font-bold text-xl flex-shrink-0">
                      {patientData?.fullName?.charAt(0)?.toUpperCase() ||
                        session?.user?.email?.charAt(0)?.toUpperCase() ||
                        "P"}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                      {patientData?.fullName ||
                        session?.user?.email?.split("@")[0] ||
                        tx("Patient")}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {tx("Patient ID")}: #{walletAddress?.slice(0, 8) || tx("N/A")}
                    </p>
                  </div>
                </div>
                <div className="py-6 space-y-5">
                  <div className="flex items-baseline gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <dt className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide w-32 flex-shrink-0">
                      {t.portal.emergency.bloodType}
                    </dt>
                    <dd className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                      {patientData?.bloodGroup || tx("N/A")}
                    </dd>
                  </div>
                  <div className="flex gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <dt className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide w-32 flex-shrink-0">
                      {t.portal.emergency.allergies}
                    </dt>
                    <dd className="flex-1">
                      {patientData?.allergies ? (
                        <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
                          {patientData.allergies
                            .split(",")
                            .map((a: string, i: number) => (
                              <li key={i}>{a.trim()}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {tx("None reported")}
                        </p>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <dt className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide w-32 flex-shrink-0">
                      {tx("Medications")}
                    </dt>
                    <dd className="flex-1">
                      {patientData?.currentMedications ? (
                        <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
                          {patientData.currentMedications
                            .split(",")
                            .map((m: string, i: number) => (
                              <li key={i}>{m.trim()}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{tx("None")}</p>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <dt className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide w-32 flex-shrink-0">
                      {t.portal.emergency.conditions}
                    </dt>
                    <dd className="flex-1">
                      {patientData?.chronicConditions ? (
                        <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
                          {patientData.chronicConditions
                            .split(",")
                            .map((c: string, i: number) => (
                              <li key={i}>{c.trim()}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{tx("None")}</p>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide w-32 flex-shrink-0">
                      {t.portal.emergency.emergencyContactLabel}
                    </dt>
                    <dd className="flex-1">
                      <div className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
                        <p>
                          <span className="font-semibold">{tx("Name")}:</span>{" "}
                          {patientData?.emergencyName || tx("N/A")}
                        </p>
                        <p>
                          <span className="font-semibold">{tx("Phone")}:</span>{" "}
                          {patientData?.emergencyPhone || tx("N/A")}
                        </p>
                      </div>
                    </dd>
                  </div>
                </div>
              </div>
              <div className="bg-red-600 dark:bg-red-700 px-6 py-4">
                <p className="text-sm text-white font-bold text-center">
                  {t.portal.emergency.helpline}{" "}
                  <a href="tel:108" className="underline hover:text-red-100">108</a>{" "}
                  ({t.portal.emergency.ambulance}) •{" "}
                  <a href="tel:102" className="underline hover:text-red-100">102</a>{" "}
                  ({t.portal.emergency.medical})
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <a
              href={emergencyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition font-medium text-sm"
            >
              <Wifi className="w-4 h-4" />
              {tx("Open emergency page in new tab")}
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {t.portal.emergency.howToUse}
                </h3>
              </div>
              <ol className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                <li className="flex gap-2">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">1.</span>
                  {t.portal.emergency.step1}
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">2.</span>
                  {t.portal.emergency.step2}
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">3.</span>
                  {t.portal.emergency.step3}
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">4.</span>
                  {t.portal.emergency.step4}
                </li>
              </ol>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {t.portal.emergency.infoShared}
                </h3>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  {t.portal.emergency.bloodType}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  {t.portal.emergency.allergies}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  {tx("Current medications")}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  {t.portal.emergency.conditions}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  {t.portal.emergency.emergencyContactLabel}
                </li>
              </ul>
            </div>
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <QrCode className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  {t.portal.emergency.bestPractices}
                </h3>
              </div>
              <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  {t.portal.emergency.practice1}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  {t.portal.emergency.practice5}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  {t.portal.emergency.practice3}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
