"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import JourneyTracker from "@/components/JourneyTracker";
import { ArrowLeft, X, Copy, CheckCircle2, Phone, Loader2 } from "lucide-react";
import { getJourney } from "@/features/journey/api";
import { createFamilyJourneyShareLink, type FamilyJourneySharePayload } from "@/lib/journey-share-client";

interface ShareModalProps {
  journeyId: string;
  patientWallet?: string | null;
  patientEmail?: string | null;
  onClose: () => void;
}

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}

function ShareModal({ journeyId, patientWallet, onClose }: ShareModalProps) {
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleShare = async () => {
    setError("");
    const recipientPhone = normalizePhone(phone);
    if (!recipientPhone || recipientPhone.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      if (!patientWallet) throw new Error("Patient wallet not available");
      const data = await getJourney(journeyId, patientWallet);
      const journey = data.journey as unknown as {
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
        hospitalName: journey.hospital?.name || "Hospital",
        tokenNumber: journey.tokenNumber || "",
        progressPercent: journey.progressPercent || 0,
        status: journey.status || "active",
        startedAt: journey.startedAt || new Date().toISOString(),
        recipientName: recipientName || "Someone",
        recipientPhone,
        recipientRelation: "contact",
        checkpoints: (journey.checkpoints || []).map((cp) => ({
          name: cp.department?.name || "Department",
          floor: cp.department?.floor,
          status: cp.status || "pending",
          queuePosition: cp.queuePosition,
          estimatedWaitMinutes: cp.estimatedWaitMinutes,
          updatedAt: cp.updatedAt,
        })),
      };
      const link = await createFamilyJourneyShareLink(payload, window.location.origin, 180);
      setShareUrl(link);
    } catch (err) {
      console.error("Share error:", err);
      setError(err instanceof Error ? err.message : "Failed to create share link.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Share Journey
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!shareUrl ? (
          <>
            <div className="space-y-4">
              <p className="text-neutral-600 dark:text-neutral-400">
                Share your live journey status via WhatsApp so they can track your hospital visit in real time.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Recipient Name (optional)</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Mom, Dad, Friend"
                  className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-transparent text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number</label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-transparent text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
              <button
                onClick={handleShare}
                disabled={!phone || loading}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {loading ? "Creating link..." : "Share via WhatsApp"}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-800 dark:text-green-200">Share Link Created!</p>
            </div>
            <div className="bg-neutral-100 dark:bg-neutral-700 rounded-lg p-3 flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-transparent text-sm truncate text-neutral-900 dark:text-neutral-100"
              />
              <button
                onClick={copyToClipboard}
                className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg"
              >
                {copied ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
            <a
              href={`https://wa.me/91${normalizePhone(phone)}?text=${encodeURIComponent(`Track my hospital visit live: ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition"
            >
              <Phone className="w-5 h-5" />
              Send via WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JourneyDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <Link
          href="/patient/journey"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Journeys
        </Link>

        <JourneyTracker
          journeyId={params.id}
          onShare={() => setShowShareModal(true)}
        />

        {showShareModal && (
          <ShareModal
            journeyId={params.id}
            patientWallet={session?.user?.walletAddress ?? null}
            patientEmail={session?.user?.email ?? null}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </main>
    </div>
  );
}
