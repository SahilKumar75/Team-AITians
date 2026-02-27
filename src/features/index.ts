/**
 * Features barrel — MVVM by domain.
 * Views should prefer: import { useAuthSession, usePatientProfile } from "@/features"
 * or from "@/features/auth", "@/features/patient", etc.
 */
export * from "./auth";
export * from "./patient";
export * from "./doctor";
export * from "./hospital";
export * from "./journey";
export * from "./records";
