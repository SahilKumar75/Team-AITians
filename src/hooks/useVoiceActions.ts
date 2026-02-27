"use client";

import { useEffect } from "react";
import { useVoiceAssistant } from "@/components/VoiceCommandProvider";
import type { VoiceActionDefinition } from "@/lib/voice/types";

/**
 * Register context-aware page actions while a page is mounted.
 */
export function useVoiceActions(actions: VoiceActionDefinition[]) {
  const { registerPageActions } = useVoiceAssistant();

  useEffect(() => {
    return registerPageActions(actions);
  }, [actions, registerPageActions]);
}
