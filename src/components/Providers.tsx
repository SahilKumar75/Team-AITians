"use client";

import { AuthProvider } from "@/features/auth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { VoiceCommandProvider } from "@/components/VoiceCommandProvider";

/** Architecture: single auth source (AuthContext), no third-party auth. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AccessibilityProvider>
            <VoiceCommandProvider>{children}</VoiceCommandProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
