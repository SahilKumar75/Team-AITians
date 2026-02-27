import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getGrantedPatientsForDoctor } from "@/lib/blockchain";
import { asString, loadProfileFromIdentity, resolveIdentity } from "@/lib/server/identity-profile";
import { searchPatientsByNameEmailPhone } from "@/lib/server/patient-directory";
import { listGrantedPatientWalletsForDoctorFromSubgraph } from "@/lib/subgraph-directory";
import { isBlockedWallet } from "@/lib/server/blocked-wallets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DoctorContext {
  wallet: string;
  hospitalId: string;
  departmentIds: Set<string>;
}

function toLower(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toDepartmentSet(profile: Record<string, unknown> | null): Set<string> {
  const raw = Array.isArray(profile?.departmentIds) ? profile.departmentIds : [];
  const normalized = raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toLowerCase());
  return new Set(normalized);
}

function hasJourneyMatchForDoctor(
  patientProfile: Record<string, unknown>,
  doctor: DoctorContext
): boolean {
  const lastSeenRows = Array.isArray(patientProfile.lastDoctorsSeen) ? patientProfile.lastDoctorsSeen : [];
  for (const row of lastSeenRows) {
    if (!row || typeof row !== "object") continue;
    const doctorWallet = toLower((row as { doctorWallet?: unknown }).doctorWallet);
    if (!doctorWallet || doctorWallet !== doctor.wallet) continue;

    const rowHospitalId = toLower((row as { hospitalId?: unknown }).hospitalId);
    if (doctor.hospitalId && rowHospitalId && rowHospitalId !== doctor.hospitalId) continue;

    if (doctor.departmentIds.size > 0) {
      const rowDeptId = toLower((row as { departmentId?: unknown }).departmentId);
      if (!rowDeptId || !doctor.departmentIds.has(rowDeptId)) continue;
    }

    return true;
  }

  const journeyRows = Array.isArray(patientProfile.journeyHistory) ? patientProfile.journeyHistory : [];
  for (const row of journeyRows) {
    if (!row || typeof row !== "object") continue;
    const rowDoctorWallet =
      toLower((row as { allottedDoctorWallet?: unknown }).allottedDoctorWallet) ||
      toLower((row as { doctorWallet?: unknown }).doctorWallet) ||
      toLower((row as { doctorId?: unknown }).doctorId);
    if (!rowDoctorWallet || rowDoctorWallet !== doctor.wallet) continue;

    const rowHospitalId = toLower((row as { hospitalId?: unknown }).hospitalId);
    if (doctor.hospitalId && rowHospitalId && rowHospitalId !== doctor.hospitalId) continue;

    if (doctor.departmentIds.size > 0) {
      const rowDeptId = toLower((row as { departmentId?: unknown }).departmentId);
      if (rowDeptId && !doctor.departmentIds.has(rowDeptId)) continue;
    }

    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") || "").trim();
    const doctorWalletInput = (request.nextUrl.searchParams.get("doctorWallet") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ found: false, message: "Provide patient name, email, or phone." });
    if (!doctorWalletInput || !ethers.isAddress(doctorWalletInput)) {
      return NextResponse.json({ found: false, message: "Doctor wallet context is required." }, { status: 400 });
    }
    if (isBlockedWallet(doctorWalletInput)) {
      return NextResponse.json({ found: false, message: "Doctor account is blocked from directory results." }, { status: 403 });
    }
    if (ethers.isAddress(q)) {
      return NextResponse.json({ found: false, message: "Search by patient name, email, or phone only." }, { status: 400 });
    }

    const doctorResolved = await resolveIdentity(doctorWalletInput);
    if (!doctorResolved.identity || doctorResolved.identity.role.toLowerCase() !== "doctor") {
      return NextResponse.json({ found: false, message: "Doctor profile not found." }, { status: 403 });
    }
    const { profile: doctorProfile } = await loadProfileFromIdentity(doctorResolved.identity);
    const doctorContext: DoctorContext = {
      wallet: doctorResolved.identity.walletAddress.toLowerCase(),
      hospitalId: toLower(doctorProfile?.hospitalId),
      departmentIds: toDepartmentSet(doctorProfile),
    };

    const candidates = await searchPatientsByNameEmailPhone(q, { limit: 20 });
    if (candidates.length === 0) {
      return NextResponse.json({ found: false, message: "No matching patient found." });
    }

    let grantedPatientWallets = new Set<string>();
    try {
      const fromSubgraph = await listGrantedPatientWalletsForDoctorFromSubgraph(doctorContext.wallet);
      grantedPatientWallets = new Set(
        fromSubgraph.map((w) => w.toLowerCase()).filter((w) => !isBlockedWallet(w))
      );
    } catch {
      grantedPatientWallets = new Set<string>();
    }
    if (grantedPatientWallets.size === 0) {
      try {
        const fromChain = await getGrantedPatientsForDoctor(doctorContext.wallet);
        grantedPatientWallets = new Set(
          fromChain
            .map((row) => (row.patient || "").toLowerCase())
            .filter((wallet) => !!wallet && !isBlockedWallet(wallet))
        );
      } catch {
        grantedPatientWallets = new Set<string>();
      }
    }

    const eligible: Array<{
      walletAddress: string;
      role: string;
      fullName: string;
      email: string;
      phone: string;
      reason: "grant" | "journey";
    }> = [];

    for (const patient of candidates) {
      if (isBlockedWallet(patient.walletAddress)) continue;
      const hasGrant = grantedPatientWallets.has((patient.walletAddress || "").toLowerCase());
      const hasJourneyMatch = hasJourneyMatchForDoctor(patient.profile, doctorContext);
      if (!hasGrant && !hasJourneyMatch) continue;

      eligible.push({
        walletAddress: patient.walletAddress,
        role: "patient",
        fullName: patient.fullName,
        email: patient.email,
        phone: patient.phone,
        reason: hasGrant ? "grant" : "journey",
      });
    }

    if (eligible.length === 0) {
      return NextResponse.json({
        found: false,
        message: "No eligible patient found for this doctor (grant/journey-hospital-department-doctor policy).",
      });
    }

    const first = eligible[0];
    return NextResponse.json({
      found: true,
      walletAddress: first.walletAddress,
      role: first.role,
      patientName: first.fullName || asString(first.email, "Patient"),
      reason: first.reason,
      patients: eligible,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { found: false, message: error instanceof Error ? error.message : "Doctor search failed." },
      { status: 500 }
    );
  }
}
