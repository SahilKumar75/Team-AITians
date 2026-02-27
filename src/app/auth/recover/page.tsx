"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Recovery page — MRC architecture.
 * 
 * Recovery phrase is REMOVED. Options:
 * 1. Email/phone + password (works from any device — chain + IPFS)
 * 2. Family guardian social recovery (on-chain, coming soon)
 */
export default function AuthRecoverPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "guardian">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLoginRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
      router.push("/patient");
    } catch {
      setError("Invalid credentials. Check your email/phone and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Recover account</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Lost access? Your identity is stored on the blockchain — you can recover from any device.
        </p>

        <div className="flex flex-wrap gap-2 mt-6 border-b border-border">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${mode === "login"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
              }`}
          >
            <Mail className="h-4 w-4" />
            Email + Password
          </button>
          <button
            type="button"
            onClick={() => setMode("guardian")}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${mode === "guardian"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
              }`}
          >
            <Users className="h-4 w-4" />
            Family guardians
          </button>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLoginRecovery} className="mt-4">
            <p className="text-muted-foreground text-xs mb-3">
              Your encrypted key is stored on IPFS and linked to the blockchain.
              Sign in with your email/phone and password from <strong>any device</strong>.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground">Email or Phone</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-primary py-2 text-primary-foreground font-medium disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in from this device"}
            </button>
          </form>
        )}

        {mode === "guardian" && (
          <div className="mt-4 p-4 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm space-y-4">
            <p>
              <strong>Family recovery:</strong> If you forgot your password, two trusted guardians
              can vote on-chain to replace your encrypted key with a new one (re-encrypted with a new password).
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2 font-medium"
              >
                <Mail className="h-4 w-4" />
                Sign in to continue
              </Link>
              <Link
                href="/help"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border py-2 font-medium hover:bg-muted transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                Guardian recovery guide
              </Link>
            </div>
            <span className="block text-xs opacity-70">Guardian voting UI is the next step; guardian list is ready now.</span>
          </div>
        )}

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-primary hover:underline"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
