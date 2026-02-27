"use client";

/**
 * Doctor feature — ViewModel.
 * Loads doctor profile from API; for use in doctor portal / profile views.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuthSession } from "@/features/auth";
import { getDoctorProfile, updateDoctorProfile } from "./api";
import type { DoctorProfileData } from "./model";

export function useDoctorProfile() {
  const { data: session, status } = useAuthSession();
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== "authenticated" || session?.user?.role !== "doctor") {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getDoctorProfile(session?.user?.email ?? undefined);
      if (data?.doctor) {
        const d = data.doctor;
        setProfile({
          name: d.name,
          email: d.email ?? session?.user?.email ?? "",
          phone: d.phone ?? "",
          licenseNumber: d.licenseNumber,
          specialization: d.specialization ?? "",
          qualification: d.qualification ?? "",
          experience: d.experience ?? "",
          hospital: d.hospital ?? "",
          city: d.city ?? "",
          state: d.state ?? "",
          walletAddress: "",
          isAuthorized: true,
          hospitalId: d.hospitalId,
          departmentIds: d.departmentIds ?? [],
          availability: d.availability,
          currentQueue: d.currentQueue,
        });
      } else {
        setProfile(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load doctor profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [status, session?.user?.role, session?.user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(async (data: Partial<DoctorProfileData>) => {
    setUpdating(true);
    setError(null);
    try {
      await updateDoctorProfile(data, session?.user?.email ?? undefined);
      setProfile((prev) => (prev ? { ...prev, ...data } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
      throw e;
    } finally {
      setUpdating(false);
    }
  }, [session?.user?.email]);

  return { profile, loading, updating, error, reload: load, update };
}
