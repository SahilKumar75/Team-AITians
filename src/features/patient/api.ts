/**
 * Patient feature — Model (API client).
 * When NEXT_PUBLIC_USE_CLIENT_DATA=true, uses client-data layer (no /api calls).
 */
import type { PatientProfileData } from "./model";
import type { PatientStatusResponse } from "./model";
import { useClientData } from "@/lib/client-data";
import { getPatientStatusClient, updatePatientProfileClient } from "@/lib/client-data";
import { Wallet } from "ethers";
import { getProvider } from "@/lib/blockchain";
import { loadRoleProfileFromChain, saveRoleProfileToChain } from "@/lib/role-profile-registry";

const BASE = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";
const STATUS_CLIENT_CACHE_TTL_MS = Math.max(3000, Number(process.env.NEXT_PUBLIC_PATIENT_STATUS_CLIENT_CACHE_TTL_MS || 15000));
const statusClientCache = new Map<string, { expiresAt: number; value: PatientStatusResponse }>();
const statusClientInflight = new Map<string, Promise<PatientStatusResponse>>();

export async function getPatientStatus(wallet?: string): Promise<PatientStatusResponse> {
  const key = (wallet || "__default__").toLowerCase();
  const now = Date.now();
  const cached = statusClientCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const inflight = statusClientInflight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    if (wallet) {
      try {
        const url = `/api/patient/status?wallet=${encodeURIComponent(wallet)}`;
        const res = await fetch(`${BASE}${url}`);
        if (res.ok) {
          const value = (await res.json()) as PatientStatusResponse;
          statusClientCache.set(key, { expiresAt: Date.now() + STATUS_CLIENT_CACHE_TTL_MS, value });
          return value;
        }
      } catch {
        // fallback paths below
      }
    }
    if (useClientData()) {
      const value = getPatientStatusClient(wallet ?? undefined) as PatientStatusResponse;
      statusClientCache.set(key, { expiresAt: Date.now() + STATUS_CLIENT_CACHE_TTL_MS, value });
      return value;
    }
    const res = await fetch(`${BASE}/api/patient/status`);
    if (!res.ok) throw new Error("Failed to fetch patient status");
    const value = (await res.json()) as PatientStatusResponse;
    statusClientCache.set(key, { expiresAt: Date.now() + STATUS_CLIENT_CACHE_TTL_MS, value });
    return value;
  })();

  statusClientInflight.set(key, task);
  try {
    return await task;
  } finally {
    statusClientInflight.delete(key);
  }
}

export async function updatePatientProfile(
  data: Partial<PatientProfileData>,
  wallet?: string
): Promise<{ success: boolean; message?: string }> {
  if (typeof window !== "undefined" && typeof wallet === "string" && wallet.trim()) {
    try {
      const raw = sessionStorage.getItem("swasthya_active_session");
      const parsed = raw ? (JSON.parse(raw) as { privateKey?: string; identifier?: string; role?: string }) : null;
      if (parsed?.privateKey && parsed?.identifier) {
        const signer = new Wallet(parsed.privateKey, getProvider());
        const existing = (await loadRoleProfileFromChain(parsed.identifier, wallet)) ?? {};
        const merged = {
          ...existing,
          ...data,
          walletAddress: wallet,
          email:
            typeof existing.email === "string" && existing.email.trim()
              ? existing.email
              : parsed.identifier,
        } as Record<string, unknown>;
        await saveRoleProfileToChain(parsed.identifier, signer, merged, wallet);
        return { success: true, message: "Profile updated on-chain and IPFS." };
      }
    } catch {
      // fall back to API mode below
    }
  }
  if (useClientData() && typeof wallet === "string") {
    return updatePatientProfileClient(wallet, data);
  }
  const res = await fetch(`${BASE}/api/patient/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to update patient");
  return json;
}
