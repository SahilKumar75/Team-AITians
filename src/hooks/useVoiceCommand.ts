"use client";

import { useState, useCallback, useEffect } from "react";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type VoiceCommandIntent =
  | "medications"
  | "allergies"
  | "conditions"
  | "status"
  | "journey"
  | "emergency"
  | "help"
  | "unknown";

interface UseVoiceCommandOptions {
  onResult?: (intent: VoiceCommandIntent, transcript: string) => void;
  onError?: (error: string) => void;
  lang?: string;
  enabled?: boolean;
}

/**
 * @deprecated Legacy keyword-only recognizer. Use VoiceCommandProvider v2 instead.
 */
// Map common phrases (EN/HI) to intents
function matchIntent(transcript: string, lang: string): VoiceCommandIntent {
  const t = transcript.toLowerCase().trim();

  const medicationPhrases = [
    "medications", "medicines", "medicine", "drugs", "दवाइयाँ", "दवा", "मेरी दवाइयाँ", "medicine list"
  ];
  if (medicationPhrases.some((p) => t.includes(p))) return "medications";

  const allergyPhrases = ["allergies", "allergy", "एलर्जी", "allergic"];
  if (allergyPhrases.some((p) => t.includes(p))) return "allergies";

  const conditionPhrases = ["conditions", "chronic", "diagnosis", "स्वास्थ्य", "बीमारी", "condition"];
  if (conditionPhrases.some((p) => t.includes(p))) return "conditions";

  const statusPhrases = ["status", "स्थिति", "कैसे हो", "how am i", "my status"];
  if (statusPhrases.some((p) => t.includes(p))) return "status";

  const journeyPhrases = ["journey", "queue", "कतार", "बारी", "wait", "प्रतीक्षा"];
  if (journeyPhrases.some((p) => t.includes(p))) return "journey";

  const emergencyPhrases = ["emergency", "qr", "आपातकाल", "emergency qr"];
  if (emergencyPhrases.some((p) => t.includes(p))) return "emergency";

  const helpPhrases = ["help", "मदद", "what can you do", "क्या कर सकते हो"];
  if (helpPhrases.some((p) => t.includes(p))) return "help";

  return "unknown";
}

export function useVoiceCommand(options: UseVoiceCommandOptions = {}) {
  const { onResult, onError, lang = "en-IN", enabled = true } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(!!supported);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || !enabled) {
      onError?.("Speech recognition not supported or disabled");
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      onError?.(event.error || "Recognition error");
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript || "";
      setLastTranscript(transcript);
      const intent = matchIntent(transcript, lang);
      onResult?.(intent, transcript);
    };

    recognition.start();
  }, [isSupported, enabled, lang, onResult, onError]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (typeof window !== "undefined" && (window as any).__currentRecognition) {
      (window as any).__currentRecognition?.stop();
    }
  }, []);

  return {
    isListening,
    isSupported,
    lastTranscript,
    startListening,
    stopListening,
  };
}
