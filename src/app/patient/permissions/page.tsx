"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ethers } from "ethers";
import { fetchJSONFromIPFS, uploadJSON } from "@/lib/ipfs";
import {
  ArrowLeft,
  Users,
  Shield,
  Clock,
  UserPlus,
  Loader2,
  Wifi,
} from "lucide-react";
import {
  GrantAccessModal,
  type GrantEntry,
} from "@/components/patient/GrantAccessModal";
import { getAccessGrantsForPatient, fetchIdentityByWallet, revokeRecordAccess } from "@/lib/blockchain";
import { listDoctorsByWalletsFromSubgraph } from "@/lib/subgraph-directory";
import { Trash2 } from "lucide-react";
import { formatDateByLanguage } from "@/lib/i18n/format";

export default function DoctorPermissionsPage() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const { user, getSigner } = useAuth();
  const { tx, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<GrantEntry[]>([]);
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null); // doctorAddress
  const [revoking, setRevoking] = useState<string | null>(null); // doctorAddress
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const loadSeqRef = useRef(0);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((resolve) => {
          timer = setTimeout(() => resolve(fallback), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function asNonEmptyString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  function isGenericDoctorText(value: string): boolean {
    const v = value.trim().toLowerCase();
    return !v || v === "doctor" || v === "dr" || v === "dr.";
  }

  function toDoctorDisplayName(value: string): string {
    const v = value.trim();
    if (!v) return "";
    return /^dr\.?\s+/i.test(v) ? v : `Dr. ${v}`;
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
    if (status === "authenticated" || status !== "loading") {
      setLoading(false);
      loadPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  async function loadPermissions(forceRefresh = false) {
    const seq = ++loadSeqRef.current;
    const addr = user?.walletAddress ?? session?.user?.walletAddress ?? null;
    if (!addr) {
      if (seq === loadSeqRef.current) {
        setPermissions([]);
        setLoading(false);
      }
      return;
    }

    if (seq === loadSeqRef.current) setLoading(true);
    try {
      const qs = new URLSearchParams({
        patientAddress: addr,
        ...(forceRefresh ? { forceRefresh: "1" } : {}),
      }).toString();
      const res = await fetch(`/api/patient/permissions?${qs}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success?: boolean;
        permissions?: Array<{
          doctorAddress: string;
          recordIds: string[];
          encDekIpfsCid: string;
          doctorName?: string;
          specialization?: string;
          hospital?: string;
        }>;
      };
      const permissionRows = Array.isArray(json.permissions) ? json.permissions : [];
      const patientAddr = addr.toLowerCase();
      const rows = permissionRows.filter((p) => (p.doctorAddress || "").toLowerCase() !== patientAddr);
      const baseMap = new Map<string, GrantEntry>();
      rows.forEach((grant) => {
        const docAddr = (grant.doctorAddress || "").toLowerCase();
        if (!docAddr) return;
        const apiName = asNonEmptyString(grant.doctorName);
        const apiSpecialization = asNonEmptyString(grant.specialization);
        const apiHospital = asNonEmptyString(grant.hospital);
        baseMap.set(docAddr, {
          doctorAddress: grant.doctorAddress,
          doctorName: !isGenericDoctorText(apiName)
            ? toDoctorDisplayName(apiName)
            : `${tx("Doctor")} (${grant.doctorAddress.slice(0, 6)}…${grant.doctorAddress.slice(-4)})`,
          specialization: !isGenericDoctorText(apiSpecialization) ? apiSpecialization : tx("General Physician"),
          hospital: apiHospital || tx("Verified on Chain"),
          grantedAt: new Date().toISOString(),
          txHash: "on-chain",
        });
      });

      if (seq !== loadSeqRef.current) return;
      setPermissions(Array.from(baseMap.values()));
      setLoading(false);

      // Enrich names/specialization/hospital in background; don't block page render.
      void (async () => {
        const doctors = await Promise.allSettled(
          rows.map(async (grant) => ({
            grant,
            identity: await withTimeout(fetchIdentityByWallet(grant.doctorAddress), 4500, null),
          }))
        );

        const resolved = doctors
          .filter((d): d is PromiseFulfilledResult<{ grant: (typeof rows)[number]; identity: Awaited<ReturnType<typeof fetchIdentityByWallet>> }> => d.status === "fulfilled")
          .map((d) => d.value);

        const walletsNeedingName = resolved.map(({ grant }) => grant.doctorAddress);

        const subgraphDoctors = walletsNeedingName.length > 0
          ? await withTimeout(listDoctorsByWalletsFromSubgraph(walletsNeedingName), 4500, [])
          : [];
        const subgraphNameMap = new Map(
          subgraphDoctors.map((d) => [d.walletAddress.toLowerCase(), d])
        );

        const enrichedMap = new Map<string, GrantEntry>(baseMap);
        const enrichedRows = await Promise.all(
          resolved.map(async ({ grant, identity }) => {
            const fallbackName = `${tx("Doctor")} (${grant.doctorAddress.slice(0, 6)}…${grant.doctorAddress.slice(-4)})`;
            const fallbackSpecialization = tx("General Physician");
            const docAddr = grant.doctorAddress.toLowerCase();
            const subDoc = subgraphNameMap.get(docAddr);

            const subgraphName = asNonEmptyString(subDoc?.name);
            const identityTitle = asNonEmptyString(identity?.title);
            const apiName = asNonEmptyString(grant.doctorName);
            const apiSpecialization = asNonEmptyString(grant.specialization);
            const apiHospital = asNonEmptyString(grant.hospital);

            let chosenName = "";
            if (!isGenericDoctorText(apiName)) {
              chosenName = apiName;
            } else if (!isGenericDoctorText(subgraphName)) {
              chosenName = subgraphName;
            } else if (!isGenericDoctorText(identityTitle)) {
              chosenName = identityTitle;
            }

            // Last fallback for name: read fullName from doctor's profile payload.
            if (!chosenName && identity?.lockACid) {
              try {
                const lockPayload = await withTimeout(fetchJSONFromIPFS(identity.lockACid), 3500, null as unknown);
                const lockObj = (lockPayload && typeof lockPayload === "object") ? (lockPayload as Record<string, unknown>) : null;
                const profileCid = asNonEmptyString(lockObj?.profileCid);
                if (profileCid) {
                  const profileRaw = await withTimeout(fetchJSONFromIPFS(profileCid), 3500, null as unknown);
                  const profileObj = (profileRaw && typeof profileRaw === "object") ? (profileRaw as Record<string, unknown>) : null;
                  const profile = (profileObj?.profile && typeof profileObj.profile === "object")
                    ? (profileObj.profile as Record<string, unknown>)
                    : profileObj;
                  const profileName = asNonEmptyString(profile?.fullName) || asNonEmptyString(profile?.name);
                  if (!isGenericDoctorText(profileName)) {
                    chosenName = profileName;
                  }
                }
              } catch {
                // Non-blocking enrichment path: ignore profile fetch failures.
              }
            }

            const doctorName = chosenName ? toDoctorDisplayName(chosenName) : fallbackName;
            const specialization = !isGenericDoctorText(apiSpecialization)
              ? apiSpecialization
              : !isGenericDoctorText(asNonEmptyString(subDoc?.specialization))
                ? asNonEmptyString(subDoc?.specialization)
                : (!isGenericDoctorText(identityTitle) ? identityTitle : fallbackSpecialization);

            return {
              docAddr,
              entry: {
                doctorAddress: grant.doctorAddress,
                doctorName,
                specialization,
                hospital: apiHospital || subDoc?.hospital || tx("Verified on Chain"),
                grantedAt: new Date().toISOString(),
                txHash: "on-chain",
              } as GrantEntry,
            };
          })
        );

        enrichedRows.forEach(({ docAddr, entry }) => {
          enrichedMap.set(docAddr, entry);
        });

        if (seq === loadSeqRef.current) {
          setPermissions(Array.from(enrichedMap.values()));
        }
      })();
    } catch (err) {
      console.error("Failed to load permissions:", err);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }

  const handleRevoke = async (doctorAddress: string) => {
    const patientAddress = user?.walletAddress;
    if (!patientAddress) {
      showToast("error", tx("Wallet not available. Please log in again."));
      return;
    }

    const addr = user?.walletAddress ?? session?.user?.walletAddress ?? null;
    if (!addr) return;

    setConfirmingRevoke(null);
    setRevoking(doctorAddress);
    const errors: string[] = [];
    try {
      // 1. Get all grants for this doctor
      // NOTE: Do NOT use forceRefresh here — it bypasses the Subgraph and goes
      // directly to the RPC which may be flaky. Subgraph data is reliable for
      // finding the correct recordIds/encDekCids to use.
      let grants = await getAccessGrantsForPatient(addr);
      let docGrants = grants.filter(g => g.doctorAddress.toLowerCase() === doctorAddress.toLowerCase());

      // If no grants found in cache/subgraph, try a fresh chain read as last resort
      if (docGrants.length === 0) {
        grants = await getAccessGrantsForPatient(addr, { forceRefresh: true });
        docGrants = grants.filter(g => g.doctorAddress.toLowerCase() === doctorAddress.toLowerCase());
      }

      if (docGrants.length === 0) {
        showToast("error", tx("No active grants found for this doctor. The list may be stale — please refresh."));
        return;
      }

      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
        parseInt(process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || "80002")
      );
      const signer = getSigner(provider);
      if (!signer) {
        showToast("error", tx("Wallet not available"));
        return;
      }

      for (const grant of docGrants) {
        let newCid = "";
        try {
          // 2. Try to fetch and update manifest (best-effort — not blocking)
          const manifest = await fetchJSONFromIPFS(grant.encDekIpfsCid) as Record<string, unknown>;
          const keys = (manifest?.keys as Record<string, unknown>) ?? {};
          const docKey = doctorAddress.toLowerCase();
          if (keys[docKey] !== undefined) {
            const { [docKey]: _removed, ...remainingKeys } = keys;
            const newManifest = { ...manifest, keys: remainingKeys };
            newCid = await uploadJSON(newManifest);
          }
        } catch (ipfsErr) {
          // IPFS manifest update failed — still proceed with on-chain revoke
          console.warn(`IPFS manifest update failed for record ${grant.recordId}, revoking on-chain anyway:`, ipfsErr);
        }

        // 3. Always call revoke on-chain regardless of IPFS success
        const res = await revokeRecordAccess(signer, grant.recordId, doctorAddress, newCid);
        if (res.success) {
          // Optimistic UI: remove doctor card immediately
          setPermissions(prev => prev.filter(p => p.doctorAddress.toLowerCase() !== doctorAddress.toLowerCase()));
        } else {
          errors.push(`Record ${grant.recordId.slice(0, 10)}…: ${res.error}`);
          console.error(`Revoke failed for record ${grant.recordId}:`, res.error);
        }
      }

      if (errors.length > 0) {
        showToast("error", `${tx("Some revocations failed")}: ${errors.join("; ")}`);
      } else {
        showToast("success", tx("Access revoked successfully."));
      }
    } catch (err) {
      console.error("Revoke failed", err);
      showToast("error", `${tx("Failed to revoke access")}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRevoking(null);
      loadPermissions(true); // Refresh with force to get updated list
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <Navbar />

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3 transition-all ${toast.type === "success"
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"
          }`}>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-12 pt-24">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
              {tx("Doctor Access Permissions")}
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              {tx("Manage which doctors can access your medical records")}
            </p>
          </div>
          <button
            onClick={() => setIsGrantModalOpen(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            {tx("Grant Access")}
          </button>
        </div>

        {loading && permissions.length === 0 ? (
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">
              {tx("Loading doctor access permissions...")}
            </p>
          </div>
        ) : permissions.length === 0 ? (
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-12 text-center">
            <Users className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
              {tx("No Doctors Have Access")}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {tx("You haven't granted access to any doctors yet. Use \"Grant Access\" to search and add a doctor.")}
            </p>
            <Link
              href="/patient/home"
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              {tx("Back to Dashboard")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {permissions.map((grant) => (
              <div
                key={grant.doctorAddress}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                    <Wifi className="w-3 h-3" />
                    {tx("On-chain")}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
                  {grant.doctorName}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                  {grant.specialization}
                  {grant.hospital && ` · ${grant.hospital}`}
                </p>
                <p className="text-xs text-neutral-400 font-mono mb-3 truncate">
                  {grant.doctorAddress}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {tx("Granted")}:{" "}
                      {formatDateByLanguage(new Date(grant.grantedAt), language, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Revoke: two-step inline confirm */}
                  {revoking === grant.doctorAddress ? (
                    <span className="inline-flex items-center gap-2 text-sm text-neutral-500 px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {tx("Revoking...")}
                    </span>
                  ) : confirmingRevoke === grant.doctorAddress ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs text-neutral-500">{tx("Sure?")}</span>
                      <button
                        onClick={() => handleRevoke(grant.doctorAddress)}
                        className="px-2 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded transition"
                      >
                        {tx("Yes")}
                      </button>
                      <button
                        onClick={() => setConfirmingRevoke(null)}
                        className="px-2 py-1 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded transition"
                      >
                        {tx("No")}
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingRevoke(grant.doctorAddress)}
                      disabled={!!revoking}
                      className="px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition inline-flex items-center gap-2 disabled:opacity-40"
                      title={tx("Revoke Access")}
                    >
                      <Trash2 className="w-5 h-5" />
                      {tx("Revoke")}
                    </button>
                  )}
                </div>
                {grant.txHash && grant.txHash !== "on-chain" && (
                  <p className="text-xs text-neutral-400 mt-2 font-mono truncate">
                    {tx("Tx")}: {grant.txHash.slice(0, 18)}…
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <GrantAccessModal
        isOpen={isGrantModalOpen}
        onClose={() => setIsGrantModalOpen(false)}
        onGrantSuccess={(grantedEntry) => {
          if (grantedEntry) {
            // ✅ Optimistic UI: add the doctor card immediately
            setPermissions(prev => {
              const exists = prev.some(p => p.doctorAddress.toLowerCase() === grantedEntry.doctorAddress.toLowerCase());
              return exists ? prev : [...prev, grantedEntry];
            });
          }
          // Background refresh to sync with chain
          void loadPermissions(true);
        }}
      />
    </div>
  );
}
