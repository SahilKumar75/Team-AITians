"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/features/auth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { VoiceCommandProvider } from "@/components/VoiceCommandProvider";
import { RuntimePageTranslator } from "@/components/RuntimePageTranslator";

declare global {
  interface Window {
    __TEAM_AITIANS_ORIGINAL_FETCH__?: typeof fetch;
    __TEAM_AITIANS_FETCH_PATCHED__?: boolean;
  }
}

/** Architecture: single auth source (AuthContext), no third-party auth. */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const configuredBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
    if (!configuredBase || typeof window === "undefined") return;
    if (window.__TEAM_AITIANS_FETCH_PATCHED__) return;

    const originalFetch = window.fetch.bind(window);
    window.__TEAM_AITIANS_ORIGINAL_FETCH__ = originalFetch;

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const toAbsoluteApiUrl = (raw: string): string => {
        if (!raw.startsWith("/api/")) return raw;
        return `${configuredBase}${raw}`;
      };

      if (typeof input === "string") {
        return originalFetch(toAbsoluteApiUrl(input), init);
      }

      if (input instanceof URL) {
        const urlStr = toAbsoluteApiUrl(input.toString());
        return originalFetch(urlStr, init);
      }

      if (input instanceof Request) {
        const reqUrl = new URL(input.url, window.location.origin);
        const pageOrigin = window.location.origin;
        if (reqUrl.origin === pageOrigin && reqUrl.pathname.startsWith("/api/")) {
          const rewritten = `${configuredBase}${reqUrl.pathname}${reqUrl.search}`;
          return originalFetch(new Request(rewritten, input), init);
        }
        return originalFetch(input, init);
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    window.__TEAM_AITIANS_FETCH_PATCHED__ = true;
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <RuntimePageTranslator />
        <ThemeProvider>
          <AccessibilityProvider>
            <VoiceCommandProvider>{children}</VoiceCommandProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
