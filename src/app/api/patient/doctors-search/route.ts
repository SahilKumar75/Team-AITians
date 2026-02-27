import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { listDoctorsFromIdentityRegistry } from "@/lib/server/doctor-directory";
import { loadProfileFromIdentity, resolveIdentity } from "@/lib/server/identity-profile";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const DOCTORS_SEARCH_CACHE_TTL_MS = Math.max(3000, Number(process.env.PATIENT_DOCTORS_SEARCH_CACHE_TTL_MS || 15000));
const doctorsSearchCache = new Map<string, { expiresAt: number; payload: unknown }>();
const doctorsSearchInflight = new Map<string, Promise<unknown>>();
const VISITED_DOCTORS_CACHE_TTL_MS = Math.max(10_000, Number(process.env.PATIENT_VISITED_DOCTORS_CACHE_TTL_MS || 180_000));
const visitedDoctorsCache = new Map<
  string,
  { expiresAt: number; wallets: string[]; lastSeenTsByDoctor: Map<string, number> }
>();

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("query") || "").trim();
  const patientWallet = (request.nextUrl.searchParams.get("patientWallet") || "").trim().toLowerCase();
  if (!q) return NextResponse.json({ success: true, doctors: [] });
  if (!patientWallet || !ethers.isAddress(patientWallet)) {
    return NextResponse.json(
      { success: false, doctors: [], error: "Missing patient wallet context." },
      { status: 400 }
    );
  }
  if (ethers.isAddress(q)) {
    return NextResponse.json({
      success: false,
      doctors: [],
      error: "Search by doctor name, email, or phone only.",
    });
  }

  try {
    const cacheKey = `${patientWallet}|${String(q).toLowerCase()}`;
    const now = Date.now();
    const cached = doctorsSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload as object, {
        headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" },
      });
    }
    const inflight = doctorsSearchInflight.get(cacheKey);
    if (inflight) {
      const payload = (await inflight) as object;
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" },
      });
    }

    const task = (async () => {
      let visitedDoctorWallets = new Set<string>();
      let lastSeenTsByDoctor = new Map<string, number>();
      const visitedCached = visitedDoctorsCache.get(patientWallet);
      if (visitedCached && visitedCached.expiresAt > Date.now()) {
        visitedDoctorWallets = new Set(visitedCached.wallets);
        lastSeenTsByDoctor = new Map(visitedCached.lastSeenTsByDoctor);
      } else {
        const patientResolved = await resolveIdentity(patientWallet);
        if (!patientResolved.identity || patientResolved.identity.role.toLowerCase() !== "patient") {
          return { success: true, doctors: [] };
        }
        const { profile: patientProfile } = await loadProfileFromIdentity(patientResolved.identity);
        const lastSeen = Array.isArray(patientProfile?.lastDoctorsSeen) ? patientProfile.lastDoctorsSeen : [];
        lastSeen.forEach((row) => {
          if (!row || typeof row !== "object") return;
          const wallet = typeof (row as { doctorWallet?: unknown }).doctorWallet === "string"
            ? (row as { doctorWallet: string }).doctorWallet.trim().toLowerCase()
            : "";
          if (!wallet || !ethers.isAddress(wallet)) return;
          if (isBlockedWallet(wallet)) return;
          visitedDoctorWallets.add(wallet);
          const ts = Number((row as { lastSeenAt?: unknown }).lastSeenAt);
          if (Number.isFinite(ts)) {
            const prev = lastSeenTsByDoctor.get(wallet) || 0;
            if (ts > prev) lastSeenTsByDoctor.set(wallet, ts);
          }
        });
        visitedDoctorsCache.set(patientWallet, {
          expiresAt: Date.now() + VISITED_DOCTORS_CACHE_TTL_MS,
          wallets: Array.from(visitedDoctorWallets),
          lastSeenTsByDoctor,
        });
      }
      if (visitedDoctorWallets.size === 0) {
        return {
          success: true,
          doctors: [],
          message: "No previously visited doctors found for this patient.",
        };
      }

      const doctors = await listDoctorsFromIdentityRegistry({
        query: q,
        wallets: Array.from(visitedDoctorWallets),
      });
      const filtered = doctors
        .filter((d) => !isBlockedWallet(d.walletAddress))
        .filter((d) => visitedDoctorWallets.has((d.walletAddress || "").toLowerCase()))
        .sort((a, b) => {
          const at = lastSeenTsByDoctor.get((a.walletAddress || "").toLowerCase()) || 0;
          const bt = lastSeenTsByDoctor.get((b.walletAddress || "").toLowerCase()) || 0;
          return bt - at;
        });
      return {
        success: true,
        doctors: filtered.map((d) => ({
          id: d.id,
          name: d.name,
          specialization: d.specialization,
          hospital: d.hospital,
          walletAddress: d.walletAddress,
          email: d.email,
          phone: d.phone,
          hospitalId: d.hospitalId,
          departmentIds: d.departmentIds,
        })),
        source: "identity-registry+patient-journey",
      };
    })();

    doctorsSearchInflight.set(cacheKey, task);
    const payload = (await task.finally(() => doctorsSearchInflight.delete(cacheKey))) as object;
    doctorsSearchCache.set(cacheKey, { expiresAt: Date.now() + DOCTORS_SEARCH_CACHE_TTL_MS, payload });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, doctors: [], error: error instanceof Error ? error.message : "Doctor search failed" },
      { status: 500 }
    );
  }
}
