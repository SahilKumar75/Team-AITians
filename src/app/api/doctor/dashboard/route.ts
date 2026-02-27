import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getGrantedPatientsForDoctor, getRecordsUploadedByDoctor } from "@/lib/blockchain";
import { loadProfileFromIdentity, resolveIdentity } from "@/lib/server/identity-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const wallet = (request.nextUrl.searchParams.get("wallet") || "").trim();
    const identifier = (request.nextUrl.searchParams.get("identifier") || "").trim();
    const key = wallet || identifier;
    if (!key) {
      return NextResponse.json({
        stats: { totalPatients: 0, activePermissions: 0, totalRecords: 0 },
        diseases: [],
        medications: [],
        availability: "",
      });
    }

    let doctorWallet = "";
    if (ethers.isAddress(key)) {
      doctorWallet = key;
    } else {
      const { identity } = await resolveIdentity(key);
      if (!identity || identity.role.toLowerCase() !== "doctor") {
        return NextResponse.json({
          stats: { totalPatients: 0, activePermissions: 0, totalRecords: 0 },
          diseases: [],
          medications: [],
          availability: "",
        });
      }
      doctorWallet = identity.walletAddress;
    }

    const [uploadedRecordsResult, grantedPatientsResult] = await Promise.allSettled([
      getRecordsUploadedByDoctor(doctorWallet),
      getGrantedPatientsForDoctor(doctorWallet),
    ]);
    const uploadedRecords = uploadedRecordsResult.status === "fulfilled" ? uploadedRecordsResult.value : [];
    const grantedPatients = grantedPatientsResult.status === "fulfilled" ? grantedPatientsResult.value : [];

    let availability = "";
    if (identifier) {
      try {
        const { identity } = await resolveIdentity(identifier);
        if (identity && identity.role.toLowerCase() === "doctor") {
          const { profile } = await loadProfileFromIdentity(identity);
          availability = typeof profile?.availability === "string" ? profile.availability : "";
        }
      } catch (e) {
        console.warn("doctor dashboard: availability fetch failed", e);
      }
    }

    return NextResponse.json({
      stats: {
        totalPatients: grantedPatients.length,
        activePermissions: uploadedRecords.length,
        totalRecords: uploadedRecords.length,
      },
      diseases: [],
      medications: [],
      availability,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load doctor dashboard" },
      { status: 500 }
    );
  }
}
