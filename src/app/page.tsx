"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { TeamMemberCard } from "@/components/landing/TeamMemberCard";
import { Navbar } from "@/components/Navbar";
import { FooterSection } from "@/components/ui/footer-section";
import { Lock, Zap, Link as LinkIcon, CheckCircle, Globe, Shield } from "lucide-react";
import { AuthenticationLayout, GlassInputWrapper } from "@/components/ui/sign-in";
import {
  ExpandableScreen,
  ExpandableScreenContent,
  ExpandableScreenTrigger,
} from "@/components/ui/expandable-screen";
import { BlockchainFeatureSection } from "@/components/ui/accordion-feature-section";
import { ExpandableHowItWorks } from "@/components/ui/expandable-how-it-works";
import { MatrixText } from "@/components/ui/matrix-text";
import { ScrollProgress } from "@/components/core/scroll-progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { isEmail, isValidIdentifier, isValidPhone, normalizePhone } from "@/lib/identifier";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useAuthSession();
  const { login, register, biometricLogin, registerWebAuthn, hasWebAuthn } = useAuth();
  const [checking, setChecking] = useState(true);
  const { t, tx } = useLanguage();

  // Dynamic data arrays using translations
  const howItWorksData = [
    {
      title: t.landing.howItWorks.step1Title,
      content: <p>{t.landing.howItWorks.step1Content}</p>,
      detailedContent: (
        <div className="space-y-4">
          <p>{t.landing.howItWorks.step1Content}</p>
          <p>Creating your account is the first step to taking control of your medical data. Our secure registration process ensures your identity is verified while maintaining your privacy.</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Secure email verification</li>
            <li>Choose between patient or doctor account</li>
            <li>End-to-end encrypted credentials</li>
            <li>HIPAA compliant data handling</li>
          </ul>
        </div>
      ),
    },
    {
      title: t.landing.howItWorks.step2Title,
      content: <p>{t.landing.howItWorks.step2Content}</p>,
      detailedContent: (
        <div className="space-y-4">
          <p>{t.landing.howItWorks.step2Content}</p>
          <p>Your medical history is encrypted and stored on the blockchain, ensuring that only you have complete control over who can access it.</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Upload existing medical records and documents</li>
            <li>Add allergies, medications, and chronic conditions</li>
            <li>Data is encrypted before blockchain storage</li>
            <li>Immutable and tamper-proof records</li>
            <li>You maintain complete ownership</li>
          </ul>
        </div>
      ),
    },
    {
      title: t.landing.howItWorks.step3Title,
      content: <p>{t.landing.howItWorks.step3Content}</p>,
      detailedContent: (
        <div className="space-y-4">
          <p>{t.landing.howItWorks.step3Content}</p>
          <p>Your personalized QR code is the key to instant, secure access to your medical information. It can be printed, saved to your phone, or added to your medical ID.</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Unique QR code linked to your blockchain profile</li>
            <li>Download and print for physical wallet/ID</li>
            <li>Save to smartphone for digital access</li>
            <li>Share with authorized healthcare providers</li>
            <li>Revoke access anytime</li>
          </ul>
        </div>
      ),
    },
    {
      title: t.landing.howItWorks.step4Title,
      content: <p>{t.landing.howItWorks.step4Content}</p>,
      detailedContent: (
        <div className="space-y-4">
          <p>{t.landing.howItWorks.step4Content}</p>
          <p>In emergency situations, every second counts. First responders can scan your QR code to instantly access critical information that could save your life.</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Instant access to blood type and allergies</li>
            <li>Current medications and dosages</li>
            <li>Emergency contact information</li>
            <li>Chronic conditions and medical history</li>
            <li>No login or wallet required for emergency access</li>
          </ul>
        </div>
      ),
    },
  ];

  const blockchainFeatures = [
    {
      id: 1,
      title: t.landing.blockchain.feature1Title,
      description: t.landing.blockchain.feature1Description,
      image: "/data-ownership.png",
    },
    {
      id: 2,
      title: t.landing.blockchain.feature2Title,
      description: t.landing.blockchain.feature2Description,
      image: "/emergency-ready.png",
    },
    {
      id: 3,
      title: t.landing.blockchain.feature3Title,
      description: t.landing.blockchain.feature3Description,
      image: "/permanent-portable.jpg",
    },
    {
      id: 4,
      title: t.landing.blockchain.feature4Title,
      description: t.landing.blockchain.feature4Description,
      image: "/consent-sharing.jpg",
    },
    {
      id: 5,
      title: t.landing.blockchain.feature5Title,
      description: t.landing.blockchain.feature5Description,
      image: "/global-access.jpg",
    },
    {
      id: 6,
      title: t.landing.blockchain.feature6Title,
      description: t.landing.blockchain.feature6Description,
      image: "/tamper-proof.jpg",
    },
  ];

  const teamMembers = [
    {
      name: t.landing.team.member1Name,
      role: t.landing.team.member1Role,
      bio: t.landing.team.member1Bio,
      image: "/sahil-kumar-singh.jpg",
    },
    {
      name: t.landing.team.member3Name,
      role: t.landing.team.member3Role,
      bio: t.landing.team.member3Bio,
      image: "/akshit.heic",
    },
    {
      name: t.landing.team.member6Name,
      role: t.landing.team.member6Role,
      bio: t.landing.team.member6Bio,
      image: "/manu.heic",
    },
  ];

  /* State for text animation */
  const [index, setIndex] = useState(0);

  /* State for Auth Modals */
  const [activeModal, setActiveModal] = useState<"login" | "signup" | null>(null);

  // Auth form states for login (identifier = email OR phone)
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [canBiometric, setCanBiometric] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showBiometricOffer, setShowBiometricOffer] = useState(false);
  const [registeringBiometric, setRegisteringBiometric] = useState(false);
  const [biometricError, setBiometricError] = useState("");

  // Auth form states for signup
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupRole, setSignupRole] = useState<"patient" | "doctor" | "hospital">("patient");
  const [signupLanguage, setSignupLanguage] = useState<"en" | "hi" | "mr" | "bh">("en");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  /** After signup, auth effect should send user to registration details page, not dashboard. */
  const justSignedUpRoleRef = useRef<"patient" | "doctor" | "hospital" | null>(null);

  useEffect(() => {
    if (!loginIdentifier.trim() || !isValidIdentifier(loginIdentifier)) {
      setCanBiometric(false);
      return;
    }
    let cancelled = false;
    hasWebAuthn(loginIdentifier).then((ok) => {
      if (!cancelled) setCanBiometric(ok);
    });
    return () => { cancelled = true; };
  }, [loginIdentifier, hasWebAuthn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setShowBiometricOffer(false);
    if (!isValidIdentifier(loginIdentifier)) {
      setLoginError(t.auth.invalidCredentials);
      return;
    }
    setLoginLoading(true);
    try {
      await login(loginIdentifier.trim(), loginPassword.trim());
      try {
        const alreadyHasBiometric = await hasWebAuthn(loginIdentifier.trim());
        if (!alreadyHasBiometric) setShowBiometricOffer(true);
      } catch {
        /* Don't let biometric check affect login success */
      }
      router.refresh();
    } catch (err: unknown) {
      setLoginError(t.auth.invalidCredentials);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!loginIdentifier.trim() || !isValidIdentifier(loginIdentifier)) return;
    setLoginError("");
    setBiometricLoading(true);
    try {
      await biometricLogin(loginIdentifier.trim());
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.auth.invalidCredentials;
      setLoginError(message);
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRegisterWebAuthn = async () => {
    setBiometricError("");
    setRegisteringBiometric(true);
    try {
      const ok = await registerWebAuthn(loginIdentifier);
      if (!ok) {
        setBiometricError(tx("Setup was cancelled or failed. You can try again or continue without biometrics."));
        return;
      }
      // Success: credential saved for this device; close modal and let auth redirect take user to portal
      setShowBiometricOffer(false);
      setActiveModal(null);
      router.replace("/");
      router.refresh();
    } catch {
      setBiometricError(tx("Setup failed. You can try again or continue without biometrics."));
    } finally {
      setRegisteringBiometric(false);
    }
  };

  const handleSkipBiometric = () => {
    setBiometricError("");
    setShowBiometricOffer(false);
    setActiveModal(null);
    router.replace("/");
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");

    if (signupPassword !== signupConfirmPassword) {
      setSignupError(t.auth.passwordMismatch);
      return;
    }

    if (signupPassword.length < 8) {
      setSignupError(t.auth.passwordMinLength);
      return;
    }

    if (!isEmail(signupEmail)) {
      setSignupError(tx("Enter a valid email address."));
      return;
    }

    if (!isValidPhone(signupPhone)) {
      setSignupError(tx("Enter a valid phone number."));
      return;
    }
    setSignupLoading(true);
    try {
      justSignedUpRoleRef.current = signupRole;
      const normalizedEmail = signupEmail.trim().toLowerCase();
      const normalizedPhone = normalizePhone(signupPhone);
      if (typeof window !== "undefined") {
        localStorage.setItem("language", signupLanguage);
      }
      await register(normalizedEmail, signupPassword.trim(), signupRole, undefined, {
        email: normalizedEmail,
        phone: normalizedPhone,
        preferredLanguage: signupLanguage,
      });
      // Redirect immediately to registration details — do not rely on effect (avoids race)
      const registerPaths: Record<"patient" | "doctor" | "hospital", string> = {
        patient: "/patient/register",
        doctor: "/doctor/register",
        hospital: "/hospital/register",
      };
      router.replace(registerPaths[signupRole]);
    } catch (err: unknown) {
      justSignedUpRoleRef.current = null;
      const message = err instanceof Error ? err.message : "";
      setSignupError(message || t.auth.errorOccurred);
    } finally {
      setSignupLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const failSafe = setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 4000);

    async function checkAuthAndRedirect() {
      try {
        console.log("[AUTH CHECK] Starting authentication check...");
        console.log("[AUTH CHECK] Session status:", status);
        console.log("[AUTH CHECK] Session data:", session);

        if (status === "loading") {
          console.log("[AUTH CHECK] Still loading session...");
          return;
        }

        if (status === "unauthenticated" || !session?.user) {
          console.log("[AUTH CHECK] No active session - staying on landing page");
          setChecking(false);
          return;
        }

        // Do not redirect while login modal is open or biometric question is showing
        if (activeModal === "login" || showBiometricOffer) {
          console.log("[AUTH CHECK] Login modal or biometric question open - staying so user can complete flow");
          setChecking(false);
          return;
        }
        if (typeof window !== "undefined" && window.location.search.includes("modal=login")) {
          console.log("[AUTH CHECK] URL has modal=login - staying so user can complete flow");
          setChecking(false);
          return;
        }

        // New signup: send to registration details page first (don't clear ref until next tick so a double effect run doesn't send user to home)
        const newSignupRole = justSignedUpRoleRef.current;
        if (newSignupRole) {
          const registerPaths: Record<string, string> = {
            patient: "/patient/register",
            doctor: "/doctor/register",
            hospital: "/hospital/register",
          };
          const path = registerPaths[newSignupRole];
          if (path) {
            console.log("[AUTH CHECK] ✅ New signup – redirecting to registration:", path);
            router.replace(path);
            setTimeout(() => {
              justSignedUpRoleRef.current = null;
            }, 0);
            return;
          }
        }

        // User is authenticated, redirect based on role
        const userRole = session.user.role;
        console.log("[AUTH CHECK] User authenticated with role:", userRole);

        if (userRole === "patient") {
          console.log("[AUTH CHECK] ✅ Redirecting patient to /patient/home");
          router.push("/patient/home");
        } else if (userRole === "doctor") {
          console.log("[AUTH CHECK] ✅ Redirecting doctor to /doctor/home");
          router.push("/doctor/home");
        } else if (userRole === "hospital") {
          console.log("[AUTH CHECK] ✅ Redirecting hospital to /hospital/home");
          router.push("/hospital/home");
        } else {
          console.log("[AUTH CHECK] ⚠️ Unknown role, staying on landing page");
          setChecking(false);
        }
      } catch (error) {
        console.error("[AUTH CHECK] failed:", error);
        setChecking(false);
      }
    }

    checkAuthAndRedirect();
    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
  }, [session, status, router, activeModal, showBiometricOffer]);

  // Open login/signup modal when URL has ?modal=login or ?modal=signup (e.g. from /auth/login)
  useEffect(() => {
    const modal = searchParams.get("modal");
    if (modal === "login") setActiveModal("login");
    else if (modal === "signup") setActiveModal("signup");
  }, [searchParams]);

  if (checking) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">{t.landing.hero.checkingAuth}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-neutral-900">
      {/* Backdrop when login/signup modal is open so user cannot interact with the rest of the page */}
      {(activeModal === "login" || activeModal === "signup") && (
        <div className="fixed inset-0 bg-black/50 z-[45] pointer-events-auto" aria-hidden />
      )}
      {/* Scroll Progress Indicator */}
      <div className="fixed left-0 top-0 z-50 w-full">
        <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800">
          <ScrollProgress
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400"
            springOptions={{
              stiffness: 280,
              damping: 30,
              mass: 0.5,
            }}
          />
        </div>
      </div>
      <Navbar />
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-neutral-200 dark:border-neutral-800">
        <div className="w-full max-w-[95%] mx-auto px-6 lg:px-12 py-24 md:py-32">
          {/* Title and Image Row */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-8">
            <div className="flex flex-col gap-6 z-10">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight whitespace-nowrap">
                <MatrixText className="text-neutral-900 dark:text-neutral-50">{t.landing.hero.title1}</MatrixText>
                <br />
                <MatrixText className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{t.landing.hero.title2}</MatrixText>
              </h1>
              <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl">
                {t.landing.hero.description}
              </p>
            </div>

            <div className="hidden lg:flex relative justify-center items-center h-full min-h-[400px]">
              {/* First Image */}
              <img
                src="/hero-illustration-new.png"
                alt="Health care illustration"
                className="absolute left-0 bottom-0 w-[60%] h-auto object-contain dark:invert mix-blend-multiply dark:mix-blend-screen transition-all duration-300 z-10"
              />
              {/* Second Image - Overlapping and Rotated */}
              <img
                src="/hero-illustration-2.jpg"
                alt="Relaxed health"
                className="absolute right-0 top-10 w-[55%] h-auto object-contain dark:invert mix-blend-multiply dark:mix-blend-screen transition-all duration-300 -rotate-6 z-0"
              />
            </div>
          </div>


          {/* CTA Buttons with Expandable Screens */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {/* Login Expandable Screen */}
            <ExpandableScreen
              layoutId="login-card"
              triggerRadius="8px"
              contentRadius="0px"
              animationDuration={0.5}
              expanded={activeModal === "login"}
              onExpandChange={(expanded) => setActiveModal(expanded ? "login" : null)}
            >
              <div>
                <ExpandableScreenTrigger>
                  <button
                    onClick={() => setActiveModal("login")}
                    className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 font-medium rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-200"
                  >
                    {t.landing.hero.signIn}
                    <svg
                      className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>
                </ExpandableScreenTrigger>

                <ExpandableScreenContent className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="h-full w-full overflow-y-auto">
                    <div className="min-h-screen">
                      <AuthenticationLayout
                        title={t.auth.welcomeBack}
                        description={t.auth.welcomeBackDescription}
                        heroImageSrc="/login-bg.jpg"
                      >
                        {showBiometricOffer ? (
                          <div className="space-y-5 animate-element animate-delay-300">
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                              {tx("Login successful. Enable quick biometric login (fingerprint/face) for this device?")}
                            </p>
                            {biometricError && (
                              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                                {biometricError}
                              </div>
                            )}
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={handleRegisterWebAuthn}
                                disabled={registeringBiometric}
                                className="flex-1 rounded-2xl bg-neutral-900 dark:bg-neutral-100 py-4 font-medium text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
                              >
                                {registeringBiometric ? tx("Setting up…") : tx("Yes, enable")}
                              </button>
                              <button
                                type="button"
                                onClick={handleSkipBiometric}
                                className="flex-1 rounded-2xl border border-neutral-300 dark:border-neutral-600 py-4 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                              >
                                {tx("No, continue")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleLogin} className="space-y-5 animate-element animate-delay-300">
                            <div>
                              <label htmlFor="login-identifier" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                {t.auth.emailOrPhone}
                              </label>
                              <GlassInputWrapper>
                                <input
                                  id="login-identifier"
                                  name="identifier"
                                  type="text"
                                  inputMode="email"
                                  autoComplete="username"
                                  required
                                  value={loginIdentifier}
                                  onChange={(e) => setLoginIdentifier(e.target.value)}
                                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                                  placeholder={t.auth.enterEmailOrPhone}
                                />
                              </GlassInputWrapper>
                            </div>

                            <div>
                              <label htmlFor="login-password" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                {t.auth.password}
                              </label>
                              <GlassInputWrapper>
                                <input
                                  id="login-password"
                                  name="password"
                                  type="password"
                                  autoComplete="current-password"
                                  required
                                  value={loginPassword}
                                  onChange={(e) => setLoginPassword(e.target.value)}
                                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                                  placeholder={t.auth.enterPassword}
                                />
                              </GlassInputWrapper>
                            </div>

                            {loginError && (
                              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                                {loginError}
                              </div>
                            )}

                            {canBiometric && (
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={handleBiometricLogin}
                                  disabled={biometricLoading}
                                  className="w-full rounded-2xl border-2 border-neutral-300 dark:border-neutral-600 py-4 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {biometricLoading ? tx("Verifying…") : tx("Sign in with biometrics")}
                                </button>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                                  {tx("Uses the fingerprint or face you set up on this device (stored locally, not on our servers).")}
                                </p>
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={loginLoading}
                              className="w-full rounded-2xl bg-neutral-900 dark:bg-neutral-100 py-4 font-medium text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loginLoading ? t.auth.signingIn : t.auth.signIn}
                            </button>

                            <div className="text-center text-sm text-neutral-500">
                              {t.auth.dontHaveAccount}{" "}
                              <button
                                type="button"
                                onClick={() => setActiveModal("signup")}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                {t.auth.createOne}
                              </button>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center mt-3">
                              {t.auth.loginHint}
                            </p>
                          </form>
                        )}
                      </AuthenticationLayout>
                    </div>
                  </div>
                </ExpandableScreenContent>
              </div>
            </ExpandableScreen>

            {/* Signup Expandable Screen */}
            <ExpandableScreen
              layoutId="signup-card"
              triggerRadius="8px"
              contentRadius="0px"
              animationDuration={0.5}
              expanded={activeModal === "signup"}
              onExpandChange={(expanded) => setActiveModal(expanded ? "signup" : null)}
            >
              <div>
                <ExpandableScreenTrigger>
                  <button
                    onClick={() => setActiveModal("signup")}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-200"
                  >
                    {t.landing.hero.createAccount}
                  </button>
                </ExpandableScreenTrigger>

                <ExpandableScreenContent className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="h-full w-full overflow-y-auto">
                    <div className="min-h-screen">
                      <AuthenticationLayout
                        title={t.auth.joinSwasthya}
                        description={t.auth.joinSwasthyaDescription}
                        heroImageSrc="/signup-bg.jpg"
                      >
                        <form onSubmit={handleSignup} className="space-y-4 animate-element animate-delay-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="signup-email" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                {t.auth.emailAddress}
                              </label>
                              <GlassInputWrapper>
                                <input
                                  id="signup-email"
                                  name="email"
                                  type="email"
                                  autoComplete="email"
                                  required
                                  value={signupEmail}
                                  onChange={(e) => setSignupEmail(e.target.value)}
                                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                                  placeholder={t.auth.enterEmail}
                                />
                              </GlassInputWrapper>
                            </div>
                            <div>
                              <label htmlFor="signup-phone" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                {tx("Phone Number")}
                              </label>
                              <GlassInputWrapper>
                                <input
                                  id="signup-phone"
                                  name="phone"
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  required
                                  value={signupPhone}
                                  onChange={(e) => setSignupPhone(e.target.value)}
                                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                                  placeholder={tx("10-digit mobile number")}
                                />
                              </GlassInputWrapper>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="signup-password" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                {t.auth.password}
                              </label>
                              <GlassInputWrapper>
                                <input
                                  id="signup-password"
                                  name="password"
                                  type="password"
                                  autoComplete="new-password"
                                  required
                                  value={signupPassword}
                                  onChange={(e) => setSignupPassword(e.target.value)}
                                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                                  placeholder={t.auth.minChars}
                                />
                              </GlassInputWrapper>
                            </div>

                            <div>
                              <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                {t.auth.confirmPassword}
                              </label>
                              <GlassInputWrapper>
                                <input
                                  id="signup-confirm-password"
                                  name="confirmPassword"
                                  type="password"
                                  autoComplete="new-password"
                                  required
                                  value={signupConfirmPassword}
                                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                  className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                                  placeholder={t.auth.confirmPasswordPlaceholder}
                                />
                              </GlassInputWrapper>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">
                              {t.auth.iAmA}
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                              <button
                                type="button"
                                onClick={() => setSignupRole("patient")}
                                className={`px-4 py-3 rounded-2xl transition-all font-medium border ${signupRole === "patient"
                                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                                  : "bg-transparent text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
                                  }`}
                              >
                                {t.auth.patient}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSignupRole("doctor")}
                                className={`px-4 py-3 rounded-2xl transition-all font-medium border ${signupRole === "doctor"
                                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                                  : "bg-transparent text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
                                  }`}
                              >
                                {t.auth.doctor}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSignupRole("hospital")}
                                className={`px-4 py-3 rounded-2xl transition-all font-medium border ${signupRole === "hospital"
                                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                                  : "bg-transparent text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
                                  }`}
                              >
                                {t.auth.hospital}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">
                              Preferred Language
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                { code: 'en' as const, label: 'English' },
                                { code: 'hi' as const, label: 'हिंदी' },
                                { code: 'mr' as const, label: 'मराठी' },
                                { code: 'bh' as const, label: 'भोजपुरी' },
                              ].map((lang) => (
                                <button
                                  key={lang.code}
                                  type="button"
                                  onClick={() => setSignupLanguage(lang.code)}
                                  className={`px-3 py-2 rounded-xl transition-all text-sm font-medium border ${signupLanguage === lang.code
                                    ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                                    : "bg-transparent text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
                                    }`}
                                >
                                  {lang.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {signupError && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                              {signupError}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={signupLoading}
                            className="w-full rounded-2xl bg-neutral-900 dark:bg-neutral-100 py-4 font-medium text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {signupLoading ? t.auth.creatingAccount : t.auth.createAccount}
                          </button>

                          <div className="text-center text-sm text-neutral-500">
                            {t.auth.alreadyHaveAccount}{" "}
                            <button
                              type="button"
                              onClick={() => setActiveModal("login")}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {t.auth.signInLink}
                            </button>
                          </div>
                        </form>
                      </AuthenticationLayout>
                    </div>
                  </div>
                </ExpandableScreenContent>
              </div>
            </ExpandableScreen>
          </div>
        </div>
      </div>



      {/* How It Works Section */}
      <div className="w-full py-20 md:py-28 border-b border-neutral-200 dark:border-neutral-800">
        <div className="mb-8 px-6 md:px-12 lg:px-20">
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
            {t.landing.howItWorks.title}
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            {t.landing.howItWorks.description}
          </p>
        </div>

        <ExpandableHowItWorks data={howItWorksData} />
      </div>
      {/* Key Benefits Section (Accordion) */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <BlockchainFeatureSection
          features={blockchainFeatures}
          title={t.landing.blockchain.title}
          description={t.landing.blockchain.description}
        />
      </div>

      {/* Meet The Team Section */}
      <div className="w-full py-20 md:py-28 border-b border-neutral-200 dark:border-neutral-800">
        <div className="px-6 md:px-12 lg:px-20">
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
            {t.landing.team.title}
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl leading-relaxed mb-10">
            {t.landing.team.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
            {teamMembers.map((member) => (
              <TeamMemberCard
                key={member.name}
                name={member.name}
                role={member.role}
                bio={member.bio}
                image={member.image}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <FooterSection />
    </main >
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900"><div className="animate-pulse text-neutral-500">Loading...</div></div>}>
      <HomeInner />
    </Suspense>
  );
}
