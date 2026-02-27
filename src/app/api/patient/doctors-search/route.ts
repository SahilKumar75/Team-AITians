import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { listDoctorsFromIdentityRegistry } from "@/lib/server/doctor-directory";
import { loadProfileFromIdentity, resolveIdentity } from "@/lib/server/identity-profile";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOCTORS_SEARCH_CACHE_TTL_MS = Math.max(
  3000,
  Number(process.env.PATIENT_DOCTORS_SEARCH_CACHE_TTL_MS || 15000)
);
const doctorsSearchCache = new Map<string, { expiresAt: number; payload: unknown }>();
const doctorsSearchInflight = new Map<string, Promise<unknown>>();
const VISITED_DOCTORS_CACHE_TTL_MS = Math.max(
  10_000,
  Number(process.env.PATIENT_VISITED_DOCTORS_CACHE_TTL_MS || 180_000)
);
const visitedDoctorsCache = new Map<
  string,
  {
    expiresAt: number;
    wallets: string[];
    lastSeenTsByDoctor: Map<string, number>;
    journeyHospitalId: string;
    journeyHospitalName: string;
  }
>();
const DOCTORS_SEARCH_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.PATIENT_DOCTORS_SEARCH_TIMEOUT_MS || 12000)
);

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Search timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pickJourneyHospitalContext(
  patientProfile: Record<string, unknown> | null
): { hospitalId: string; hospitalName: string } {
  const rows = Array.isArray(patientProfile?.journeyHistory)
    ? patientProfile!.journeyHistory
    : [];
  if (rows.length === 0) return { hospitalId: "", hospitalName: "" };

  let bestActive: { ts: number; hospitalId: string; hospitalName: string } | null = null;
  let bestAny: { ts: number; hospitalId: string; hospitalName: string } | null = null;

  rows.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const obj = row as Record<string, unknown>;
    const hospitalId = asString(obj.hospitalId);
    const hospitalName = asString(obj.hospitalName);
    if (!hospitalId && !hospitalName) return;

    const ts = asTimestamp(obj.startedAt || obj.lastSeenAt || obj.updatedAt);
    const status = asString(obj.status).toLowerCase();
    const candidate = { ts, hospitalId, hospitalName };

    if (!bestAny || candidate.ts >= bestAny.ts) bestAny = candidate;
    if (status === "active" && (!bestActive || candidate.ts >= bestActive.ts)) {
      bestActive = candidate;
    }
  });

  const chosen = bestActive || bestAny;
  return chosen
    ? { hospitalId: chosen.hospitalId, hospitalName: chosen.hospitalName }
    : { hospitalId: "", hospitalName: "" };
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("query") || "").trim();
  const patientWallet = (request.nextUrl.searchParams.get("patientWallet") || "")
    .trim()
    .toLowerCase();

  if (!q) return NextResponse.json({ success: true, doctors: [] });
  if (!patientWallet || !ethers.isAddress(patientWallet)) {
    return NextResponse.json(
      { success: false, doctors: [], error: "Missing patient wallet context." },
      { status: 400 }
    );
  }
  if (ethers.isAddress(q)) {
    return NextResponse.json(
      {
        success: false,
        doctors: [],
        error: "Search by doctor name, email, or phone only.",
      },
      { status: 400 }
    );
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
      let payload: object;
      try {
        payload = (await withTimeout(inflight as Promise<object>, DOCTORS_SEARCH_TIMEOUT_MS)) as object;
      } catch {
        payload = {
          success: true,
          doctors: [],
          source: "timeout",
          message: "Search timed out. Please try again in a few seconds.",
        };
      }
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" },
      });
    }

    const task = (async () => {
      const mapDoctor = (d: {
        id: string;
        name: string;
        specialization: string;
        hospital: string;
        walletAddress: string;
        email: string;
        phone: string;
        hospitalId: string;
        departmentIds: string[];
      }) => ({
        id: d.id,
        name: d.name,
        specialization: d.specialization,
        hospital: d.hospital,
        walletAddress: d.walletAddress,
        email: d.email,
        phone: d.phone,
        hospitalId: d.hospitalId,
        departmentIds: d.departmentIds,
      });

      let visitedDoctorWallets = new Set<string>();
      let lastSeenTsByDoctor = new Map<string, number>();
      let journeyHospitalId = "";
      let journeyHospitalName = "";

      const visitedCached = visitedDoctorsCache.get(patientWallet);
      if (visitedCached && visitedCached.expiresAt > Date.now()) {
        visitedDoctorWallets = new Set(visitedCached.wallets);
        lastSeenTsByDoctor = new Map(visitedCached.lastSeenTsByDoctor);
        journeyHospitalId = visitedCached.journeyHospitalId;
        journeyHospitalName = visitedCached.journeyHospitalName;
      } else {
        const patientResolved = await resolveIdentity(patientWallet);
        if (!patientResolved.identity || patientResolved.identity.role.toLowerCase() !== "patient") {
          return { success: true, doctors: [] };
        }
        const { profile: patientProfile } = await loadProfileFromIdentity(patientResolved.identity);
        const journeyCtx = pickJourneyHospitalContext(patientProfile);
        journeyHospitalId = journeyCtx.hospitalId;
        journeyHospitalName = journeyCtx.hospitalName;

        const lastSeen = Array.isArray(patientProfile?.lastDoctorsSeen)
          ? patientProfile.lastDoctorsSeen
          : [];
        lastSeen.forEach((row) => {
          if (!row || typeof row !== "object") return;
          const wallet =
            typeof (row as { doctorWallet?: unknown }).doctorWallet === "string"
              ? (row as { doctorWallet: string }).doctorWallet.trim().toLowerCase()
              : "";
          if (!wallet || !ethers.isAddress(wallet) || isBlockedWallet(wallet)) return;
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
          journeyHospitalId,
          journeyHospitalName,
        });
      }

      // Strict policy: doctors must be from the same hospital where journey started.
      if (!journeyHospitalId && !journeyHospitalName) {
        return {
          success: true,
          doctors: [],
          source: "journey-hospital-required",
          message: "Start a hospital journey first to find doctors from that hospital.",
        };
      }

      let filtered = [] as Awaited<ReturnType<typeof listDoctorsFromIdentityRegistry>>;
      if (visitedDoctorWallets.size > 0) {
        const doctors = await listDoctorsFromIdentityRegistry({
          query: q,
          wallets: Array.from(visitedDoctorWallets),
          hospitalId: journeyHospitalId,
          hospitalName: journeyHospitalName,
        });
        filtered = doctors
          .filter((d) => !isBlockedWallet(d.walletAddress))
          .filter((d) => visitedDoctorWallets.has((d.walletAddress || "").toLowerCase()))
          .sort((a, b) => {
            const at = lastSeenTsByDoctor.get((a.walletAddress || "").toLowerCase()) || 0;
            const bt = lastSeenTsByDoctor.get((b.walletAddress || "").toLowerCase()) || 0;
            return bt - at;
          });
      }

      // If not found in visited list, search globally but still inside same hospital.
      if (filtered.length === 0) {
        const broad = await listDoctorsFromIdentityRegistry({
          query: q,
          hospitalId: journeyHospitalId,
          hospitalName: journeyHospitalName,
        });
        const doctors = broad
          .filter((d) => !isBlockedWallet(d.walletAddress))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 30);
        return {
          success: true,
          doctors: doctors.map(mapDoctor),
          source: "identity-registry-same-hospital",
          message:
            visitedDoctorWallets.size === 0
              ? "Showing matching doctors from your current journey hospital."
              : "No visited doctor matched. Showing matching doctors from your current journey hospital.",
        };
      }

      return {
        success: true,
        doctors: filtered.map(mapDoctor),
        source: "identity-registry+patient-journey-same-hospital",
      };
    })();

    doctorsSearchInflight.set(cacheKey, task);
    let payload: object;
    try {
      payload = (await withTimeout(task as Promise<object>, DOCTORS_SEARCH_TIMEOUT_MS)) as object;
    } catch {
      payload = {
        success: true,
        doctors: [],
        source: "timeout",
        message: "Search timed out. Please try again in a few seconds.",
      };
    } finally {
      doctorsSearchInflight.delete(cacheKey);
    }

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
