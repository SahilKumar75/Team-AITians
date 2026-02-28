"use client";

import { useEffect } from "react";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { FooterSection } from "@/components/ui/footer-section";
import { Upload, Users, Shield, Trash2 } from "lucide-react";
import { PatientUploadModal } from "@/components/patient/PatientUploadModal";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ethers } from "ethers";
import { fetchJSONFromIPFS, uploadJSON } from "@/lib/ipfs";
import { fetchIdentity, getAccessGrantsForPatient, revokeRecordAccess } from "@/lib/blockchain";

interface GrantEntry {
  doctorAddress: string;
  doctorName: string;
}

export default function PatientUploadPage() {
  const { data: session, status } = useAuthSession();
  const { user, getSigner } = useAuth();
  const { tx } = useLanguage();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [grants, setGrants] = useState<GrantEntry[]>([]);
  const [revoking, setRevoking] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadAccess();
  }, [status, session?.user?.walletAddress]);

  async function loadAccess() {
    const addr = session?.user?.walletAddress ?? user?.walletAddress;
    if (!addr) {
      setGrants([]);
      return;
    }
    try {
      const onChain = await getAccessGrantsForPatient(addr);
      const uniq = Array.from(new Set(onChain.map((g) => g.doctorAddress.toLowerCase())));
      const resolved: GrantEntry[] = await Promise.all(
        uniq.map(async (doctorAddress) => {
          const identity = await fetchIdentity(doctorAddress);
          return {
            doctorAddress,
            doctorName: identity?.title ? `Dr. ${identity.title}` : "Doctor",
          };
        })
      );
      setGrants(resolved);
    } catch {
      setGrants([]);
    }
  }

  async function handleRevoke(doctorAddress: string) {
    const addr = session?.user?.walletAddress ?? user?.walletAddress;
    if (!addr) return;
    setRevoking(doctorAddress);
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
        parseInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || "80002")
      );
      const signer = getSigner(provider);
      if (!signer) throw new Error("Wallet signer unavailable");
      const records = await getAccessGrantsForPatient(addr);
      const target = records.filter((g) => g.doctorAddress.toLowerCase() === doctorAddress.toLowerCase());
      for (const grant of target) {
        let newCid = "";
        try {
          const manifest = await fetchJSONFromIPFS(grant.encDekIpfsCid) as { keys?: Record<string, string> };
          const keys = manifest?.keys ?? {};
          const docKey = doctorAddress.toLowerCase();
          if (keys[docKey] !== undefined) {
            const { [docKey]: _removed, ...remaining } = keys;
            newCid = await uploadJSON({ ...manifest, keys: remaining });
          }
        } catch {
          // IPFS manifest update failed — still proceed with on-chain revoke
        }
        await revokeRecordAccess(signer, grant.recordId, doctorAddress, newCid);
      }
      await loadAccess();
    } finally {
      setRevoking("");
    }
  }

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
            <Upload className="h-7 w-7" />
            {tx("Upload Documents")}
          </h1>
          <p className="text-muted-foreground mt-2">
            Upload personal medical documents. They are encrypted and stored on IPFS.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            {tx("Upload a file")}
          </button>

          <section className="mt-10 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">{tx("Who can access your documents")}</h2>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {tx("Manage and revoke access from this screen.")}
            </p>
            {grants.length === 0 ? (
              <div className="text-sm text-neutral-500 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {tx("No doctors currently have access.")}
              </div>
            ) : (
              <div className="space-y-2">
                {grants.map((g) => (
                  <div key={g.doctorAddress} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{g.doctorName}</p>
                      <p className="text-xs text-neutral-500 font-mono">{g.doctorAddress}</p>
                    </div>
                    <button
                      onClick={() => handleRevoke(g.doctorAddress)}
                      disabled={revoking === g.doctorAddress}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {tx("Revoke")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <FooterSection />
      <PatientUploadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUploadSuccess={() => { }}
      />
    </>
  );
}
