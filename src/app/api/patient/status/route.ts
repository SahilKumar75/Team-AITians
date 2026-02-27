import { NextRequest, NextResponse } from "next/server";
import {
  asNullableString,
  asString,
  loadProfileFromIdentity,
  resolveIdentity,
} from "@/lib/server/identity-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const STATUS_CACHE_TTL_MS = Math.max(3000, Number(process.env.PATIENT_STATUS_CACHE_TTL_MS || 15000));
const patientStatusCache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();
const statusInflight = new Map<string, Promise<Record<string, unknown>>>();

const EMPTY_PROFILE = {
  walletAddress: null as string | null,
  isRegisteredOnChain: false,
  fullName: null as string | null,
  dateOfBirth: null as string | null,
  gender: null as string | null,
  bloodGroup: null as string | null,
  phone: null as string | null,
  address: null as string | null,
  city: null as string | null,
  state: null as string | null,
  pincode: null as string | null,
  emergencyName: null as string | null,
  emergencyRelation: null as string | null,
  emergencyPhone: null as string | null,
  allergies: null as string | null,
  chronicConditions: null as string | null,
  currentMedications: null as string | null,
  previousSurgeries: null as string | null,
  height: null as string | null,
  weight: null as string | null,
  profilePicture: null as string | null,
};

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    const identifier = request.nextUrl.searchParams.get("identifier");
    const key = wallet || identifier;
    if (!key) return NextResponse.json(EMPTY_PROFILE);
    const cacheKey = key.trim().toLowerCase();
    const now = Date.now();
    const cached = patientStatusCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload, {
        headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
      });
    }

    const inflight = statusInflight.get(cacheKey);
    if (inflight) {
      const payload = await inflight;
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
      });
    }

    const task = (async (): Promise<Record<string, unknown>> => {
      const { identity } = await resolveIdentity(key);
      if (!identity || identity.role.toLowerCase() !== "patient") {
        return EMPTY_PROFILE as unknown as Record<string, unknown>;
      }

      const { profile } = await loadProfileFromIdentity(identity);
      const p = profile || {};
      const payload: Record<string, unknown> = {
        walletAddress: identity.walletAddress,
        isRegisteredOnChain: true,
        fullName: asNullableString(p.fullName ?? p.name),
        dateOfBirth: asNullableString(p.dateOfBirth),
        gender: asNullableString(p.gender),
        bloodGroup: asNullableString(p.bloodGroup),
        phone: asNullableString(p.phone),
        address: asNullableString(p.address ?? p.streetAddress),
        city: asNullableString(p.city),
        state: asNullableString(p.state),
        pincode: asNullableString(p.pincode),
        emergencyName: asNullableString(p.emergencyName),
        emergencyRelation: asNullableString(p.emergencyRelation),
        emergencyPhone: asNullableString(p.emergencyPhone),
        allergies: asNullableString(p.allergies),
        chronicConditions: asNullableString(p.chronicConditions),
        currentMedications: asNullableString(p.currentMedications),
        previousSurgeries: asNullableString(p.previousSurgeries),
        height: asNullableString(p.height),
        weight: asNullableString(p.weight),
        profilePicture: asNullableString(p.profilePicture),
        lastDoctorsSeen: Array.isArray(p.lastDoctorsSeen) ? p.lastDoctorsSeen : [],
        familySharingPrefs:
          p.familySharingPrefs && typeof p.familySharingPrefs === "object"
            ? p.familySharingPrefs
            : { shareJourneyByDefault: false, shareRecordsWithFamily: false },
        email: asString(p.email),
      };
      patientStatusCache.set(cacheKey, { expiresAt: Date.now() + STATUS_CACHE_TTL_MS, payload });
      return payload;
    })();

    statusInflight.set(cacheKey, task);
    const payload = await task.finally(() => statusInflight.delete(cacheKey));
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load patient status" },
      { status: 500 }
    );
  }
}
