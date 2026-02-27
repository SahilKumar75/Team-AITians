"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type AccessibilitySettings = {
  simpleMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
};

const defaultSettings: AccessibilitySettings = {
  simpleMode: false,
  highContrast: false,
  reducedMotion: false,
};

interface AccessibilityContextType extends AccessibilitySettings {
  setSimpleMode: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setAccessibility: (s: Partial<AccessibilitySettings>) => void;
}

const STORAGE_KEY = "swasthya-accessibility";

function loadSettings(): AccessibilitySettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
  } catch (_) {}
  return defaultSettings;
}

function saveSettings(s: AccessibilitySettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (_) {}
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<AccessibilitySettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSettingsState(loadSettings());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    saveSettings(settings);

    const root = document.documentElement;
    root.classList.toggle("simple-mode", settings.simpleMode);
    root.classList.toggle("high-contrast", settings.highContrast);
    root.classList.toggle("reduce-motion", settings.reducedMotion);
  }, [mounted, settings]);

  const setAccessibility = (partial: Partial<AccessibilitySettings>) => {
    setSettingsState((prev) => ({ ...prev, ...partial }));
  };

  const value: AccessibilityContextType = {
    ...settings,
    setSimpleMode: (v) => setAccessibility({ simpleMode: v }),
    setHighContrast: (v) => setAccessibility({ highContrast: v }),
    setReducedMotion: (v) => setAccessibility({ reducedMotion: v }),
    setAccessibility,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (ctx === undefined) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return ctx;
}
