"use client";
import React, { useState, useEffect } from "react";
import { HoveredLink, Menu, MenuItem } from "@/components/ui/navbar-menu";
import { ProfileDropdown } from "@/components/ui/profile-dropdown";
import { Magnetic } from "@/components/core/magnetic";
import { StarOfLife } from "@/components/icons/StarOfLife";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { Moon, Sun, Activity, Home, AlertCircle, FileText, Users, Navigation, Mic } from "lucide-react";
import { useAuthSession } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BlockchainStatus } from "@/components/BlockchainStatus";
import { useClientData } from "@/lib/client-data";
import { getPatientStatus } from "@/features/patient/api";
import { getDoctorProfile } from "@/features/doctor/api";

interface NavbarProps {
  connection?: { account: string } | null;
  minimal?: boolean; // New prop for registration pages
}

const NAV_PROFILE_CACHE_TTL_MS = Math.max(10_000, Number(process.env.NEXT_PUBLIC_NAV_PROFILE_CACHE_TTL_MS || 60_000));
const navProfileCache = new Map<string, { expiresAt: number; name: string; image: string | null }>();
const navProfileInflight = new Map<string, Promise<{ name: string; image: string | null }>>();

export function Navbar({ connection, minimal = false }: NavbarProps) {
  const [active, setActive] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobile, setIsMobile] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("User");
  const { data: session } = useAuthSession();
  const pathname = usePathname();
  const { t, tx } = useLanguage();

  const effectiveRole = session?.user?.role ?? null;
  const fallbackName =
    session?.user?.email?.split("@")[0]?.trim() ||
    session?.user?.walletAddress?.slice(0, 6) ||
    "User";
  const isRegistrationRoute =
    pathname === "/patient/register" ||
    pathname === "/doctor/register" ||
    pathname === "/hospital/register";

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initialTheme = savedTheme || systemTheme;
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch profile display name and image with short TTL cache.
  useEffect(() => {
    const currentUser = session?.user;
    if (!currentUser?.id) {
      setDisplayName("User");
      setProfilePicture(null);
      return;
    }

    const cacheKey = [
      currentUser.role || "",
      (currentUser.walletAddress || "").toLowerCase(),
      (currentUser.email || "").toLowerCase(),
    ].join("|");

    const now = Date.now();
    const cached = navProfileCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      setDisplayName(cached.name || fallbackName);
      setProfilePicture(cached.image);
      return;
    }

    const run = navProfileInflight.get(cacheKey) || (async () => {
      let resolvedName = currentUser.email?.split("@")[0] || "User";
      let resolvedImage: string | null = null;
      try {
        if (useClientData()) {
          if (currentUser.role === "patient") {
            const data = await getPatientStatus(currentUser.walletAddress ?? undefined);
            const nameCandidate = typeof data?.fullName === "string" ? data.fullName.trim() : "";
            if (nameCandidate) resolvedName = nameCandidate;
            resolvedImage = data.profilePicture ?? null;
          } else if (currentUser.role === "doctor") {
            const data = await getDoctorProfile(currentUser.email ?? undefined);
            const nameCandidate = typeof data?.doctor?.name === "string" ? data.doctor.name.trim() : "";
            if (nameCandidate) resolvedName = nameCandidate;
            resolvedImage = data?.doctor?.profilePicture ?? null;
          } else if (currentUser.role === "hospital") {
            const res = await fetch(`/api/hospital/profile?identifier=${encodeURIComponent(currentUser.email ?? "")}`);
            if (res.ok) {
              const data = await res.json();
              const nameCandidate = typeof data?.hospital?.name === "string" ? data.hospital.name.trim() : "";
              if (nameCandidate) resolvedName = nameCandidate;
              resolvedImage = data?.hospital?.profilePicture ?? null;
            }
          }
        } else {
          const endpoint =
            currentUser.role === "patient"
              ? `/api/patient/status?wallet=${encodeURIComponent(currentUser.walletAddress ?? "")}`
              : currentUser.role === "hospital"
                ? `/api/hospital/profile?identifier=${encodeURIComponent(currentUser.email ?? "")}`
                : `/api/doctor/profile?identifier=${encodeURIComponent(currentUser.email ?? "")}`;
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            const nameCandidate =
              (typeof data?.fullName === "string" && data.fullName.trim()) ||
              (typeof data?.name === "string" && data.name.trim()) ||
              (typeof data?.doctor?.fullName === "string" && data.doctor.fullName.trim()) ||
              (typeof data?.doctor?.name === "string" && data.doctor.name.trim()) ||
              (typeof data?.hospital?.name === "string" && data.hospital.name.trim()) ||
              "";
            if (nameCandidate) resolvedName = nameCandidate;
            resolvedImage = data.profilePicture || data?.doctor?.profilePicture || data?.hospital?.profilePicture || null;
          }
        }
      } catch (error) {
        console.error("Error fetching navbar profile:", error);
      }
      const value = { name: (resolvedName || fallbackName).trim(), image: resolvedImage };
      navProfileCache.set(cacheKey, { expiresAt: Date.now() + NAV_PROFILE_CACHE_TTL_MS, ...value });
      return value;
    })();

    navProfileInflight.set(cacheKey, run);
    run
      .then((value) => {
        setDisplayName(value.name);
        setProfilePicture(value.image);
      })
      .finally(() => navProfileInflight.delete(cacheKey));
  }, [session?.user?.id, session?.user?.role, session?.user?.walletAddress, session?.user?.email, fallbackName]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Registration pages: profile is incomplete, so hide account/language/theme controls.
  if (isRegistrationRoute || minimal) {
    return (
      <header className="w-full z-40 fixed top-0 left-0 bg-transparent">
        <BlockchainStatus />
        <div className="w-full px-4 md:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <Magnetic intensity={0.2} springOptions={{ bounce: 0.1 }} actionArea="global" range={200}>
              <div className="flex items-center gap-2 h-[44px] px-4 bg-white dark:bg-neutral-800 rounded-full shadow-sm cursor-default">
                <StarOfLife className="w-6 h-6 md:w-8 md:h-8 text-red-600 dark:text-red-500 flex-shrink-0" />
                <span className="text-xs md:text-sm text-neutral-900 dark:text-neutral-100 whitespace-nowrap tracking-wide font-bold">
                  Swasthya Sanchar
                </span>
              </div>
            </Magnetic>
          </div>
        </div>
      </header>
    );
  }

  // Mobile Bottom Navigation
  if (isMobile && session && pathname !== '/') {
    return (
      <>
        {/* Top bar with logo and controls */}
        <header className="w-full z-40 fixed top-0 left-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StarOfLife className="w-6 h-6 text-red-600 dark:text-red-500" />
                <span className="text-xs text-neutral-900 dark:text-neutral-100 font-bold">Swasthya Sanchar</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label={tx("Toggle theme")}
                >
                  {theme === "light" ? (
                    <Moon className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                  ) : (
                    <Sun className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                  )}
                </button>
                <LanguageSelector />
              </div>
            </div>
          </div>
        </header>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pb-safe">
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
            {effectiveRole === "patient" ? (
              <>
                <Link
                  href="/patient/home"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/patient/home"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.home}</span>
                </Link>


                <Link
                  href="/patient/emergency"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/patient/emergency"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.emergency}</span>
                </Link>

                <Link
                  href="/patient/records"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/patient/records"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.records}</span>
                </Link>

                <Link
                  href="/patient/journey"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname?.startsWith("/patient/journey")
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Navigation className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.journey}</span>
                </Link>

                <Link
                  href="/patient/timeline"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/patient/timeline"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Activity className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.timeline}</span>
                </Link>

                <Link
                  href="/patient/permissions"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/patient/permissions"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.access}</span>
                </Link>
              </>
            ) : effectiveRole === "hospital" ? (
              <>
                <Link
                  href="/hospital/home"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/hospital/home"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.home}</span>
                </Link>
                <Link
                  href="/hospital/admin"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/hospital/admin"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.queue}</span>
                </Link>
                <Link
                  href="/hospital/upload"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/hospital/upload"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.uploadRecords}</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/doctor/home"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/doctor/home"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.home}</span>
                </Link>

                <Link
                  href="/doctor/patients"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/doctor/patients"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.patients}</span>
                </Link>

                <Link
                  href="/doctor/queue"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname === "/doctor/queue"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Navigation className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.queue}</span>
                </Link>

                <Link
                  href="/doctor/voice"
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px] ${pathname?.startsWith("/doctor/voice")
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Mic className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.nav.voice}</span>
                </Link>
              </>
            )}

            {/* Profile in bottom nav */}
            <div className="flex flex-col items-center gap-1 px-3 py-2">
              <ProfileDropdown
                user={{
                  name: displayName || fallbackName,
                  email: session?.user?.email || "",
                  image: profilePicture,
                }}
                role={effectiveRole || "patient"}
                theme={theme}
                onThemeToggle={toggleTheme}
                openUpward={true}
              />
            </div>
          </div>
        </nav>
      </>
    );
  }

  // Desktop Navbar (original with improvements)
  return (
    <header className="w-full z-40 fixed top-0 left-0 bg-transparent">
      <BlockchainStatus />
      <div className="w-full px-6 py-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          {/* Left: Logo + Title (Capsule) */}
          <div className="shrink-0">
            <Magnetic
              intensity={0.2}
              springOptions={{ bounce: 0.1 }}
              actionArea="global"
              range={200}
            >
              <div className="flex items-center gap-2 h-[44px] px-4 bg-white dark:bg-neutral-800 rounded-full shadow-sm cursor-default">
                <Magnetic
                  intensity={0.1}
                  springOptions={{ bounce: 0.1 }}
                  actionArea="global"
                  range={200}
                >
                  <StarOfLife className="w-8 h-8 text-red-600 dark:text-red-500 flex-shrink-0" />
                </Magnetic>
                <Magnetic
                  intensity={0.1}
                  springOptions={{ bounce: 0.1 }}
                  actionArea="global"
                  range={200}
                >
                  <span className="text-sm text-neutral-900 dark:text-neutral-100 whitespace-nowrap tracking-wide" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold' }}>Swasthya Sanchar</span>
                </Magnetic>
              </div>
            </Magnetic>
          </div>

          {/* Center: Navigation Links */}
          <div className="min-w-0 flex justify-center">
            {session && pathname !== '/' && (
              <div className="hidden lg:flex w-full justify-center min-w-0">
                <div className="max-w-full overflow-x-auto bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm px-1 h-[44px] flex items-center gap-0.5 [scrollbar-width:none] [-ms-overflow-style:none]">
                  <Menu setActive={setActive}>
                    <Link
                      href={
                        effectiveRole === "patient"
                          ? "/patient/home"
                          : effectiveRole === "doctor"
                            ? "/doctor/home"
                            : effectiveRole === "hospital"
                              ? "/hospital/home"
                              : "/patient/home"
                      }
                      className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/patient/home" || pathname === "/doctor/home" || pathname === "/hospital/home"
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                        }`}
                    >
                      {t.nav.home}
                    </Link>

                    {effectiveRole === "patient" ? (
                      <>

                        <Link
                          href="/patient/emergency"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/patient/emergency"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.emergency}
                        </Link>
                        <Link
                          href="/patient/records"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/patient/records"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.medicalRecords}
                        </Link>
                        <Link
                          href="/patient/journey"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname?.startsWith("/patient/journey")
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.journey}
                        </Link>
                        <Link
                          href="/patient/timeline"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/patient/timeline"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.timeline}
                        </Link>
                        <Link
                          href="/patient/permissions"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/patient/permissions"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.doctorAccess}
                        </Link>
                      </>
                    ) : effectiveRole === "hospital" ? (
                      <>
                        <Link
                          href="/hospital/admin"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/hospital/admin"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.queue}
                        </Link>
                        <Link
                          href="/hospital/doctors"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/hospital/doctors"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.doctors}
                        </Link>
                        <Link
                          href="/hospital/upload"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/hospital/upload"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.uploadRecords}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/doctor/patients"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/doctor/patients"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.patients}
                        </Link>
                        <Link
                          href="/doctor/queue"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/doctor/queue"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.queue}
                        </Link>
                        <Link
                          href="/doctor/voice"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname?.startsWith("/doctor/voice")
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.voice}
                        </Link>
                        <Link
                          href="/doctor/upload"
                          className={`px-3 py-2 text-sm font-medium rounded-full transition-all h-[36px] flex items-center ${pathname === "/doctor/upload"
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 hover:shadow-sm"
                            }`}
                        >
                          {t.nav.uploadRecords}
                        </Link>
                      </>
                    )}
                  </Menu>
                </div>
              </div>
            )}
          </div>

          {/* Right: Avatar + Theme Toggle + Language */}
          <div className="justify-self-end shrink-0 flex items-center gap-0.5 h-[44px] px-1 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm">
            {session?.user && pathname !== '/' && (
              <div className="flex items-center h-full">
                <ProfileDropdown
                  user={{
                    name: displayName || fallbackName,
                    email: session?.user?.email || "",
                    image: profilePicture,
                  }}
                  role={effectiveRole || "patient"}
                  theme={theme}
                  onThemeToggle={toggleTheme}
                />
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 h-[32px] w-[32px] flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              aria-label={tx("Toggle theme")}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
              ) : (
                <Sun className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
              )}
            </button>

            <LanguageSelector />
          </div>
        </div>
      </div>
    </header>
  );
}
