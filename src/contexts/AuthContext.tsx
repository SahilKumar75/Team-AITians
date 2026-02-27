"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Provider, Signer } from "ethers";
import {
  createIdentity,
  unlockWithPassword,
  type Role,
  type UnlockedIdentity,
  type IdentityContactMeta,
} from "@/lib/crypto-identity";
import { normalizeIdentifier } from "@/lib/identifier";

/** Session-like user shape for drop-in replacement of next-auth session.user */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  walletAddress: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  /** Same as next-auth: "loading" | "authenticated" | "unauthenticated" */
  status: "loading" | "authenticated" | "unauthenticated";
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    identifier: string,
    password: string,
    role: string,
    license?: string,
    contactMeta?: IdentityContactMeta
  ) => Promise<void>;
  /** Get signer for contract calls (e.g. HealthRegistry.addRecord). Returns null if not authenticated. */
  getSigner: (provider: Provider) => Signer | null;
  logout: () => void;
  biometricLogin: (identifier: string) => Promise<void>;
  registerWebAuthn: (identifier: string) => Promise<boolean>;
  hasWebAuthn: (identifier: string) => Promise<boolean>;
  deviceAccounts: unknown[];
}

const AuthContext = createContext<AuthContextType | null>(null);
const ACTIVE_SESSION_KEY = "swasthya_active_session";

function identityToUser(id: UnlockedIdentity): AuthUser {
  return {
    id: id.wallet.address,
    email: id.identifier,
    role: id.role,
    walletAddress: id.wallet.address,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<UnlockedIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    try {
      const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
      if (!raw) {
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(raw) as { privateKey?: string; role?: Role; identifier?: string };
      if (!parsed.privateKey || !parsed.role || !parsed.identifier) {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
        setLoading(false);
        return;
      }
      import("ethers").then(({ Wallet }) => {
        const wallet = new Wallet(parsed.privateKey);
        setIdentity({ wallet, role: parsed.role as Role, identifier: parsed.identifier as string });
        setLoading(false);
      }).catch(() => {
        sessionStorage.removeItem(ACTIVE_SESSION_KEY);
        setLoading(false);
      });
    } catch {
      setLoading(false);
    }
  }, []);

  const user: AuthUser | null = identity
    ? identityToUser(identity)
    : null;
  const status: AuthContextType["status"] = loading
    ? "loading"
    : user
      ? "authenticated"
      : "unauthenticated";

  const hasWebAuthn = useCallback(async (identifier: string) => {
    if (typeof window === "undefined") return false;
    const credIdB64 = localStorage.getItem(`webauthn_cred_${normalizeIdentifier(identifier)}`);
    return !!credIdB64;
  }, []);

  const registerWebAuthn = useCallback(async (identifier: string) => {
    try {
      const { createWebAuthnCredential } = await import("@/lib/webauthn");
      const rawId = await createWebAuthnCredential(identifier);
      if (!rawId) return false;
      const arr = Array.from(new Uint8Array(rawId));
      const credIdBase64 = btoa(String.fromCharCode.apply(null, arr));
      localStorage.setItem(`webauthn_cred_${normalizeIdentifier(identifier)}`, credIdBase64);
      return true;
    } catch (e) {
      console.error("WebAuthn registration failed:", e);
      return false;
    }
  }, []);

  const biometricLogin = useCallback(async (identifier: string) => {
    const norm = normalizeIdentifier(identifier);
    const credIdBase64 = localStorage.getItem(`webauthn_cred_${norm}`);
    if (!credIdBase64) throw new Error("No biometric credential found for this user");

    const credId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
    const { getWebAuthnAssertion } = await import("@/lib/webauthn");
    const ok = await getWebAuthnAssertion(credId.buffer);
    if (!ok) throw new Error("Biometric verification failed");

    const biometricData = localStorage.getItem(`biometric_data_${norm}`);
    if (!biometricData) throw new Error("Biometrics not enabled for this device. Please log in with password and enable it.");

    const { privateKey, role } = JSON.parse(biometricData);
    const { Wallet } = await import("ethers");
    const wallet = new Wallet(privateKey);
    setIdentity({ wallet, role: role as Role, identifier });
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const id = await unlockWithPassword(identifier, password);
      if (id) {
        setIdentity(id);
      } else throw new Error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (
      identifier: string,
      password: string,
      role: string,
      license?: string,
      contactMeta?: IdentityContactMeta
    ) => {
      setLoading(true);
      try {
        const id = await createIdentity({
          identifier,
          password,
          role: role as Role,
          licenseNumber: license,
          contactMeta,
        });
        setIdentity(id);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getSigner = useCallback((provider: Provider): Signer | null => {
    if (!identity) return null;
    return identity.wallet.connect(provider) as Signer;
  }, [identity]);

  const logout = useCallback(() => {
    setIdentity(null);
  }, []);

  // Auto-update biometric data when identity is available and WebAuthn is registered
  useEffect(() => {
    if (identity && typeof window !== "undefined") {
      const norm = normalizeIdentifier(identity.identifier);
      if (localStorage.getItem(`webauthn_cred_${norm}`)) {
        localStorage.setItem(`biometric_data_${norm}`, JSON.stringify({
          privateKey: identity.wallet.privateKey,
          role: identity.role,
        }));
      }
    }
  }, [identity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!identity) {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    try {
      sessionStorage.setItem(
        ACTIVE_SESSION_KEY,
        JSON.stringify({
          privateKey: identity.wallet.privateKey,
          role: identity.role,
          identifier: identity.identifier,
        })
      );
    } catch {
      // ignore
    }
  }, [identity]);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        loading,
        login,
        register,
        getSigner,
        logout,
        biometricLogin,
        registerWebAuthn,
        hasWebAuthn,
        deviceAccounts: [],
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Drop-in replacement for next-auth useSession() so existing pages work with architecture auth.
 * Returns { data: { user }, status } matching next-auth Session shape.
 */
export function useAuthSession(): {
  data: { user: AuthUser } | null;
  status: "loading" | "authenticated" | "unauthenticated";
} {
  const auth = useAuth();
  return {
    data: auth.user ? { user: auth.user } : null,
    status: auth.status,
  };
}
