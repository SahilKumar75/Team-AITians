import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { loadProfileFromIdentity, resolveIdentity, asString } from "@/lib/server/identity-profile";

function toEmergencyData(
  walletAddress: string,
  profile: Record<string, unknown>
) {
  return {
    name: asString(profile.fullName || profile.name, "Patient"),
    dateOfBirth: asString(profile.dateOfBirth),
    gender: asString(profile.gender),
    bloodGroup: asString(profile.bloodGroup),
    phone: asString(profile.phone),
    email: asString(profile.email),
    address: asString(profile.address || profile.streetAddress),
    city: asString(profile.city),
    state: asString(profile.state),
    pincode: asString(profile.pincode),
    emergencyName: asString(profile.emergencyName),
    emergencyRelation: asString(profile.emergencyRelation),
    emergencyPhone: asString(profile.emergencyPhone),
    allergies: asString(profile.allergies),
    chronicConditions: asString(profile.chronicConditions),
    currentMedications: asString(profile.currentMedications),
    previousSurgeries: asString(profile.previousSurgeries),
    height: asString(profile.height),
    weight: asString(profile.weight),
    waistCircumference: asString(profile.waistCircumference),
    profilePicture: asString(profile.profilePicture),
    walletAddress,
    privacySettings: {
      gender: true,
      phone: false,
      email: false,
      address: false,
      height: false,
      weight: false,
      waistCircumference: false,
      previousSurgeries: false,
    },
  };
}

export function generateStaticParams() {
  return [{ address: "placeholder" }];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    if (!address || address === "placeholder") {
      return NextResponse.json({ error: "Missing patient address" }, { status: 400 });
    }
    const decoded = decodeURIComponent(address);
    if (!ethers.isAddress(decoded)) {
      return NextResponse.json({ error: "Invalid patient wallet address" }, { status: 400 });
    }

    const { identity } = await resolveIdentity(decoded);
    if (!identity || identity.role.toLowerCase() !== "patient") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    const { profile } = await loadProfileFromIdentity(identity);
    if (!profile) {
      return NextResponse.json({ error: "Emergency profile not available" }, { status: 404 });
    }

    const body = toEmergencyData(identity.walletAddress, profile);
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load emergency profile" },
      { status: 500 }
    );
  }
}

