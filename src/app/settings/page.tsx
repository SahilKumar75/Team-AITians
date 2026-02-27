"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
    Settings as SettingsIcon, Moon, Sun, Monitor,
    User, Bell, Lock, Globe, Accessibility, Contrast, Move,
    Share2, AlertTriangle, Users
} from "lucide-react";

export default function SettingsPage() {
    const router = useRouter();
    const { data: session, status } = useAuthSession();
    const { theme, toggleTheme } = useTheme();
    const { simpleMode, setSimpleMode, highContrast, setHighContrast, reducedMotion, setReducedMotion } = useAccessibility();
    const { tx } = useLanguage();

    useEffect(() => {
        if (status === "loading") return;
        if (status === "unauthenticated" || !session?.user) {
            router.replace("/");
            return;
        }
    }, [status, session?.user, router]);

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-neutral-900">
            <Navbar />

            <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 pt-24">
                {/* Header */}
                <div className="mb-12">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                            <SettingsIcon className="w-8 h-8 text-neutral-700 dark:text-neutral-300" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50">
                                {tx("Settings")}
                            </h1>
                            <p className="text-lg text-neutral-600 dark:text-neutral-400 mt-1">
                                {tx("Manage your preferences and account settings")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Settings Sections */}
                <div className="space-y-6">
                    {/* Appearance */}
                    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Monitor className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {tx("Appearance")}
                            </h2>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                                {tx("Theme")}
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={theme === 'dark' ? toggleTheme : undefined}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition ${theme === 'light'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                                        }`}
                                >
                                    <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'}`} />
                                    <span className={`text-sm font-medium ${theme === 'light' ? 'text-blue-900 dark:text-blue-100' : 'text-neutral-700 dark:text-neutral-300'}`}>
                                        {tx("Light")}
                                    </span>
                                </button>

                                <button
                                    onClick={theme === 'light' ? toggleTheme : undefined}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition ${theme === 'dark'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                                        }`}
                                >
                                    <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'}`} />
                                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-900 dark:text-blue-100' : 'text-neutral-700 dark:text-neutral-300'}`}>
                                        {tx("Dark")}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Accessibility */}
                    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6" role="region" aria-labelledby="accessibility-heading">
                        <div className="flex items-center gap-3 mb-6">
                            <Accessibility className="w-5 h-5 text-neutral-700 dark:text-neutral-300" aria-hidden />
                            <h2 id="accessibility-heading" className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {tx("Accessibility")}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-neutral-900 dark:text-neutral-50">{tx("Simple Mode")}</p>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                        {tx("Larger buttons and text, fewer options. Better for elderly and low vision.")}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer" aria-label={tx("Toggle Simple Mode")}>
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={simpleMode}
                                        onChange={(e) => setSimpleMode(e.target.checked)}
                                        aria-checked={simpleMode}
                                    />
                                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-neutral-900 dark:text-neutral-50">{tx("High Contrast")}</p>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                        {tx("Stronger borders and text contrast for visibility.")}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer" aria-label={tx("Toggle High Contrast")}>
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={highContrast}
                                        onChange={(e) => setHighContrast(e.target.checked)}
                                        aria-checked={highContrast}
                                    />
                                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-neutral-900 dark:text-neutral-50">{tx("Reduce Motion")}</p>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                        {tx("Minimize animations and transitions.")}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer" aria-label={tx("Toggle Reduce Motion")}>
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={reducedMotion}
                                        onChange={(e) => setReducedMotion(e.target.checked)}
                                        aria-checked={reducedMotion}
                                    />
                                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Patient: Sharing, Emergency, Family (per ARCHITECTURE) */}
                    {session?.user?.role?.toLowerCase() === "patient" && (
                        <>
                            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <Share2 className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                        {tx("Sharing & Access")}
                                    </h2>
                                </div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                                    {tx("Control who can see your records. Per-document share and revoke with doctors.")}
                                </p>
                                <Link
                                    href="/patient/permissions"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                                >
                                    <Share2 className="w-4 h-4" />
                                    {tx("Manage Doctor Access")}
                                </Link>
                            </div>

                            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <AlertTriangle className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                        {tx("Emergency")}
                                    </h2>
                                </div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                                    {tx("Configure what first responders see (Tier 0), pre-approved ER access (Tier 1), and unconscious protocol (Tier 2 with 2 staff co-signatures, 72h expiry).")}
                                </p>
                                <Link
                                    href="/patient/emergency"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    {tx("Emergency QR & Tiers")}
                                </Link>
                            </div>

                            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <Users className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                        {tx("Family & Guardians")}
                                    </h2>
                                </div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                                    {tx("Add guardians for account recovery. If you lose access, they can help restore it.")}
                                </p>
                                <Link
                                    href="/help"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                >
                                    <Users className="w-4 h-4" />
                                    {tx("Manage Family (Coming Soon)")}
                                </Link>
                            </div>
                        </>
                    )}

                    {/* Account */}
                    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <User className="w-5 h-5 text-neutral-700 dark:text-neutral-300" aria-hidden />
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {tx("Account")}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                                    {tx("Email")}
                                </label>
                                <input
                                    type="email"
                                    value={session?.user?.email || ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-50 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                                    {tx("Role")}
                                </label>
                                <input
                                    type="text"
                                    value={session?.user?.role || 'N/A'}
                                    disabled
                                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-50 cursor-not-allowed capitalize"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Bell className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                {tx("Notifications")}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                                        Email Notifications
                                    </p>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                        Receive email updates about your account
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                                        Push Notifications
                                    </p>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                        Receive push notifications on your device
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Privacy & Security */}
                    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Lock className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                                Privacy & Security
                            </h2>
                        </div>

                        <div className="space-y-3">
                            <button className="w-full text-left px-4 py-3 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition">
                                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                                    Change Password
                                </p>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                    Update your password
                                </p>
                            </button>

                            <button className="w-full text-left px-4 py-3 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition">
                                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                                    Two-Factor Authentication
                                </p>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                    Add an extra layer of security
                                </p>
                            </button>

                            <button className="w-full text-left px-4 py-3 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition">
                                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                                    Privacy Settings
                                </p>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                    Manage your data and privacy
                                </p>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
