import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { searchPatientsByNameEmailPhone } from "@/lib/server/patient-directory";
import { isBlockedHospitalId, isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasHospitalJourneyEvidence(profile: Record<string, unknown>, hospitalId: string): boolean {
  const normalizedHospitalId = hospitalId.trim().toLowerCase();
  if (!normalizedHospitalId) return false;

  const lastDoctorsSeen = Array.isArray(profile.lastDoctorsSeen) ? profile.lastDoctorsSeen : [];
  const journeyHistory = Array.isArray(profile.journeyHistory) ? profile.journeyHistory : [];

  const seenInDoctors = lastDoctorsSeen.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const hid = (entry as { hospitalId?: unknown }).hospitalId;
    return typeof hid === "string" && hid.trim().toLowerCase() === normalizedHospitalId;
  });
  if (seenInDoctors) return true;

  return journeyHistory.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const hid = (entry as { hospitalId?: unknown }).hospitalId;
    return typeof hid === "string" && hid.trim().toLowerCase() === normalizedHospitalId;
  });
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") || "").trim();
    const hospitalId = (request.nextUrl.searchParams.get("hospitalId") || "").trim();

    if (!q) {
      return NextResponse.json({ found: false, message: "Provide patient name, email, or phone." });
    }
    if (!hospitalId) {
      return NextResponse.json(
        { found: false, message: "Missing hospital context. Complete hospital registration first." },
        { status: 400 }
      );
    }
    if (ethers.isAddress(q)) {
      return NextResponse.json(
        { found: false, message: "Search by patient name, email, or phone only." },
        { status: 400 }
      );
    }

    if (isBlockedHospitalId(hospitalId)) {
      return NextResponse.json({ found: false, message: "Hospital account is blocked from directory results." }, { status: 403 });
    }

    const candidates = await searchPatientsByNameEmailPhone(q, { limit: 30 });
    const eligible = candidates
      .filter((row) => !isBlockedWallet(row.walletAddress))
      .filter((row) => hasHospitalJourneyEvidence(row.profile, hospitalId));
    if (eligible.length === 0) {
      return NextResponse.json({
        found: false,
        message: "Patient has not started a journey in this hospital yet.",
      });
    }

    const first = eligible[0];

    return NextResponse.json({
      found: true,
      walletAddress: first.walletAddress,
      role: "patient",
      patientName: first.fullName,
      patients: eligible.map((row) => ({
        walletAddress: row.walletAddress,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
      })),
      hospitalId,
    });
  } catch (error) {
    return NextResponse.json(
      { found: false, message: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}
