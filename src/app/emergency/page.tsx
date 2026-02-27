"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, QrCode, ArrowRight } from "lucide-react";

/**
 * Tier 0 public landing: no login required.
 * First responders can scan a patient's QR or enter the emergency URL to view critical info.
 */
export default function EmergencyLandingPage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    // Extract address from full URL or use as-is if it looks like an address/ID
    let path = trimmed;
    try {
      if (trimmed.startsWith("http")) {
        const u = new URL(trimmed);
        path = u.pathname.replace(/^\/+/, ""); // e.g. "emergency/0x..."
        const parts = path.split("/");
        if (parts[0] === "emergency" && parts[1]) path = parts[1];
        else if (parts[0]) path = parts[0];
      } else if (trimmed.includes("/")) {
        const parts = trimmed.split("/").filter(Boolean);
        path = parts[parts.length - 1] || trimmed;
      }
    } catch {
      path = trimmed;
    }
    if (path) router.push(`/emergency/${encodeURIComponent(path)}`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 flex flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-red-600">Emergency Access</h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Tier 0 — No login required</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 mb-8">
          <p className="font-semibold text-red-900 dark:text-red-100 mb-1">
            First responder — patient emergency info
          </p>
          <p className="text-sm text-red-800 dark:text-red-200">
            Scan the patient&apos;s QR code or paste the emergency page URL below to view critical medical information (blood type, allergies, emergency contact).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Emergency page URL or patient ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. https://yoursite.com/emergency/0x... or paste full URL"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 focus:ring-2 focus:ring-red-500 outline-none"
            />
            <button
              type="submit"
              className="px-4 py-3 rounded-lg bg-red-600 text-white font-medium flex items-center gap-2 hover:bg-red-700 transition shrink-0"
            >
              Open
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="mt-8 p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            If you have a QR code: open your camera or a QR scanner app and scan the patient&apos;s emergency QR. It will open this page with their data.
          </p>
        </div>

        <p className="mt-8 text-center">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
