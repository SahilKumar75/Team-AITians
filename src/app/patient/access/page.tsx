"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function PatientAccessPage() {
  const router = useRouter();
  const { status } = useAuthSession();

  useEffect(() => {
    if (status !== "loading") {
      router.replace("/patient/permissions");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
}
