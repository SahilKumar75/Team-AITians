"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import { loadRoleProfileFromChain } from "@/lib/role-profile-registry";

/**
 * /doctor — route by registration status.
 * If already registered → /doctor/home. Otherwise → /doctor/register.
 */
export default function DoctorPage() {
  const { data: session, status } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    async function run() {
      if (status === "loading") return;
      if (status === "unauthenticated" || !session?.user) {
        router.push("/auth/login");
        return;
      }
      if (session.user.role !== "doctor") {
        router.push(session.user.role === "patient" ? "/patient/home" : "/");
        return;
      }
      try {
        const profile = await loadRoleProfileFromChain(
          session.user.email || "",
          session.user.walletAddress || undefined
        );
        if (profile && Object.keys(profile).length > 0) {
          // Doctor mode is only for title "Doctor", not other clinician titles.
          const title = typeof profile.title === "string" ? profile.title : "";
          if (title && title !== "Doctor") {
            router.push("/doctor/register?message=doctor-only");
            return;
          }
          router.push("/doctor/home");
        } else {
          router.push("/doctor/register");
        }
      } catch {
        router.push("/doctor/register");
      }
    }
    run();
  }, [status, session?.user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 dark:border-neutral-100" />
    </div>
  );
}
