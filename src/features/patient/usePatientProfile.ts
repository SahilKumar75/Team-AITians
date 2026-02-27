"use client";

/**
 * Patient feature — ViewModel.
 * Loads patient profile from API and exposes update; for use in patient portal / profile views.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuthSession } from "@/features/auth";
import { getPatientStatus, updatePatientProfile } from "./api";
import type { PatientProfileData, PatientStatusResponse } from "./model";

function statusToProfile(data: PatientStatusResponse, email: string): PatientProfileData {
  return {
    name: data.fullName ?? email?.split("@")[0] ?? "Patient",
    dateOfBirth: data.dateOfBirth ?? "",
    gender: data.gender ?? "",
    bloodGroup: data.bloodGroup ?? "",
    phone: data.phone ?? "",
    email: email ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    pincode: data.pincode ?? "",
    emergencyName: data.emergencyName ?? "",
    emergencyRelation: data.emergencyRelation ?? "",
    emergencyPhone: data.emergencyPhone ?? "",
    allergies: data.allergies ?? "",
    chronicConditions: data.chronicConditions ?? "",
    currentMedications: data.currentMedications ?? "",
    previousSurgeries: data.previousSurgeries ?? "",
    height: data.height ?? "",
    weight: data.weight ?? "",
    profilePicture: data.profilePicture ?? undefined,
    lastDoctorsSeen: data.lastDoctorsSeen ?? [],
    familySharingPrefs: data.familySharingPrefs ?? { shareJourneyByDefault: false, shareRecordsWithFamily: false },
  };
}

export function usePatientProfile() {
  const { data: session, status } = useAuthSession();
  const [profile, setProfile] = useState<PatientProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.walletAddress) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getPatientStatus(session.user.walletAddress);
      setProfile(statusToProfile(data, session.user.email ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [status, session?.user?.walletAddress, session?.user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(async (data: Partial<PatientProfileData>) => {
    setUpdating(true);
    setError(null);
    try {
      await updatePatientProfile(data, session?.user?.walletAddress ?? undefined);
      setProfile((prev) => (prev ? { ...prev, ...data } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
      throw e;
    } finally {
      setUpdating(false);
    }
  }, [session?.user?.walletAddress]);

  return { profile, loading, updating, error, reload: load, update };
}
