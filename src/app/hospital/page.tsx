"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Hospital root: redirect to hospital home (dashboard).
 */
export default function HospitalPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/hospital/home");
  }, [router]);
  return null;
}
