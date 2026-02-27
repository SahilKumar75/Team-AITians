"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ClipboardList } from "lucide-react";

export default function PatientAuditPage() {
  const { data: session, status } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-7 w-7" />
            Access Log
          </h1>
          <p className="text-muted-foreground mt-2">
            Who accessed what and when. (Audit trail from chain/events coming soon.)
          </p>
          <div className="mt-8 p-6 rounded-lg border border-border bg-card text-muted-foreground">
            No access events yet.
          </div>
        </div>
      </main>
    </>
  );
}
