/**
 * Doctor feature — Model (API client).
 * When NEXT_PUBLIC_USE_CLIENT_DATA=true, uses client-data layer (no /api calls).
 */
import type { DoctorProfileData } from "./model";
import type { DoctorProfileResponse } from "./model";
import { useClientData } from "@/lib/client-data";
import { getDoctorProfileClient, updateDoctorProfileClient } from "@/lib/client-data";
import { loadRoleProfileFromChain, saveRoleProfileToChain } from "@/lib/role-profile-registry";
import { Wallet } from "ethers";
import { getProvider } from "@/lib/blockchain";

const BASE = typeof window !== "undefined" ? "" : process.env.NEXTAUTH_URL ?? "";

export async function getDoctorProfile(identifier?: string): Promise<DoctorProfileResponse | null> {
  if (typeof window !== "undefined" && typeof identifier === "string" && identifier.trim()) {
    try {
      const onChain = await loadRoleProfileFromChain(identifier);
      if (onChain && Object.keys(onChain).length > 0) {
        return { doctor: onChain as unknown as DoctorProfileData };
      }
    } catch {
      // fallback to existing paths
    }
  }

  if (useClientData() && typeof identifier === "string") {
    return Promise.resolve(getDoctorProfileClient(identifier) as unknown as DoctorProfileResponse | null);
  }
  const qs = identifier ? `?identifier=${encodeURIComponent(identifier)}` : "";
  const res = await fetch(`${BASE}/api/doctor/profile${qs}`);
  const data = await res.json();
  if (!res.ok) return null;
  return data;
}

export async function updateDoctorProfile(
  data: Partial<DoctorProfileData>,
  identifier?: string
): Promise<{ success: boolean }> {
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("swasthya_active_session");
      const parsed = raw ? (JSON.parse(raw) as { privateKey?: string; identifier?: string; role?: string }) : null;
      const effectiveIdentifier = identifier || parsed?.identifier;
      if (parsed?.privateKey && effectiveIdentifier) {
        const signer = new Wallet(parsed.privateKey, getProvider());
        const wallet = await signer.getAddress().catch(() => undefined);
        const existing = (await loadRoleProfileFromChain(effectiveIdentifier, wallet)) ?? {};
        const merged = { ...existing, ...data } as Record<string, unknown>;
        await saveRoleProfileToChain(effectiveIdentifier, signer, merged, wallet);
        return { success: true };
      }
    } catch {
      // fallback to configured mode below
    }
  }
  if (useClientData() && typeof identifier === "string") {
    return updateDoctorProfileClient(identifier, data);
  }
  const res = await fetch(`${BASE}/api/doctor/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to update doctor profile");
  return json;
}
