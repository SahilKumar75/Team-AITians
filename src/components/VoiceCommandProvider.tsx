"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, MicOff, Loader2, X, WifiOff, Sparkles, Bot } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeProvider";
import { useAuthSession } from "@/contexts/AuthContext";
import { getVoiceIntentClient } from "@/lib/client-data";
import { getVoiceIntentAPI } from "@/lib/client-data/api-voice-intent";
import { toLocale } from "@/lib/i18n/locale";
import {
  getAvailableVoiceActions,
  getFallbackVoiceResponse,
  getHintActions,
  inferLanguageFromTranscript,
} from "@/lib/voice/action-catalog";
import { executeVoiceAction } from "@/lib/voice/action-executor";
import type {
  PatientVoiceContext,
  VoiceConversationMessage,
  VoiceActionDefinition,
  VoiceIntentResult,
  VoiceRole,
} from "@/lib/voice/types";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceCommandContextType {
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  isOfflineFallback: boolean;
  lastTranscript: string;
  lastResponse: string;
  startListening: () => void;
  stopListening: () => void;
  setPatientContext: (ctx: PatientVoiceContext) => void;
  registerPageActions: (actions: VoiceActionDefinition[]) => () => void;
}

type VoicePhase = "idle" | "listening" | "processing" | "executing" | "speaking";

const VOICE_HISTORY_LIMIT = 24;

const FEMALE_VOICE_KEYWORDS = [
  "female",
  "woman",
  "girl",
  "samantha",
  "karen",
  "moira",
  "tessa",
  "veena",
  "lekha",
  "neerja",
  "aditi",
  "zira",
  "hazel",
  "susan",
  "google हिन्दी",
  "google hindi",
];

function pickFemaleVoice(bcp47: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const langCode = bcp47.split("-")[0].toLowerCase();
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langCode));
  const femaleInLang = langVoices.find((v) =>
    FEMALE_VOICE_KEYWORDS.some((kw) => v.name.toLowerCase().includes(kw))
  );
  if (femaleInLang) return femaleInLang;
  const anyFemale = voices.find((v) => FEMALE_VOICE_KEYWORDS.some((kw) => v.name.toLowerCase().includes(kw)));
  return anyFemale || langVoices[0] || null;
}

function speak(text: string, locale: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !text) return;

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = locale;
  utter.rate = 0.9;
  utter.pitch = 1.08;
  utter.volume = 1.0;

  if (onEnd) utter.onend = onEnd;

  const doSpeak = () => {
    const voice = pickFemaleVoice(locale);
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
  }
}

function conversationStorageKey(userId?: string | null): string {
  return `voice_conversation::${userId || "guest"}`;
}

function collectVisibleFormFieldHints(): string[] {
  if (typeof document === "undefined") return [];
  const fields = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input:not([type='hidden']), textarea, select"
    )
  )
    .filter((el) => !el.disabled)
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

  const hints = new Set<string>();
  fields.forEach((el) => {
    const candidates = [
      el.getAttribute("aria-label"),
      el.getAttribute("placeholder"),
      el.getAttribute("name"),
      el.id,
    ];
    if (el.id && typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      document.querySelectorAll(`label[for='${CSS.escape(el.id)}']`).forEach((label) => {
        candidates.push(label.textContent);
      });
    }
    const wrappedLabel = el.closest("label");
    if (wrappedLabel?.textContent) candidates.push(wrappedLabel.textContent);

    candidates
      .map((v) => (v || "").trim())
      .filter((v) => Boolean(v) && v.slice(0, 59) === v)
      .forEach((v) => hints.add(v));
  });

  return Array.from(hints).slice(0, 30);
}

function speechErrorMessage(
  errorCode: string | undefined,
  tx: (text: string) => string,
  micPermission: string
): string {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      if (micPermission === "granted") {
        return tx("Microphone is allowed, but speech recognition is blocked by browser policy. Reload and try again.");
      }
      return tx("Microphone permission is blocked. Please allow mic access in browser settings.");
    case "audio-capture":
      return tx("No microphone was found. Please connect or enable a microphone.");
    case "network":
      return tx("Voice recognition network error. Please check your internet connection.");
    case "no-speech":
      return tx("I could not hear anything. Tap the mic and try speaking again.");
    case "aborted":
      return tx("Voice listening was stopped.");
    default:
      return tx("Voice recognition failed. Please try again.");
  }
}

const VoiceCommandContext = createContext<VoiceCommandContextType | null>(null);

export function useVoiceAssistant() {
  const ctx = useContext(VoiceCommandContext);
  if (!ctx) throw new Error("useVoiceAssistant must be used inside VoiceCommandProvider");
  return ctx;
}

export function VoiceCommandProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { language, setLanguage, tx } = useLanguage();
  const { toggleTheme } = useTheme();
  const { data: session } = useAuthSession();

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [showDock, setShowDock] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [conversation, setConversation] = useState([] as VoiceConversationMessage[]);
  const [patientCtx, setPatientCtxState] = useState<PatientVoiceContext>({});
  const [pageActions, setPageActions] = useState([] as VoiceActionDefinition[]);
  const [micPermission, setMicPermission] = useState("unknown");

  const recognitionRef = useRef(null as any);
  const startListeningRef = useRef<() => void>(() => {});
  const manualStopRef = useRef(false);
  const autoListenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const role: VoiceRole = useMemo(() => {
    const raw = session?.user?.role;
    if (raw === "doctor" || raw === "hospital") return raw;
    if (raw === "patient") return "patient";
    return "guest";
  }, [session?.user?.role]);

  const conversationKey = useMemo(() => conversationStorageKey(session?.user?.id || null), [session?.user?.id]);

  const availableActions = useMemo(
    () => getAvailableVoiceActions(role, pathname, pageActions),
    [role, pathname, pageActions]
  );

  const hintActions = useMemo(() => getHintActions(role, pathname, pageActions), [role, pathname, pageActions]);

  const repeatLastResponse = useCallback(() => {
    if (!lastResponse) return;
    speak(lastResponse, toLocale(language));
  }, [lastResponse, language]);

  const registerPageActions = useCallback((actions: VoiceActionDefinition[]) => {
    setPageActions(actions);
    return () => {
      setPageActions([]);
    };
  }, []);

  const appendConversation = useCallback(
    (message: VoiceConversationMessage) => {
      setConversation((prev) => [...prev, message].slice(-VOICE_HISTORY_LIMIT));
    },
    []
  );

  useEffect(() => {
    const supported =
      typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(supported);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(conversationKey);
      if (!raw) {
        setConversation([]);
        return;
      }
      const parsed = JSON.parse(raw) as VoiceConversationMessage[];
      if (!Array.isArray(parsed)) {
        setConversation([]);
        return;
      }
      const normalized = parsed
        .filter((m) => !!m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
        .slice(-VOICE_HISTORY_LIMIT);
      setConversation(normalized);
    } catch {
      setConversation([]);
    }
  }, [conversationKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(conversationKey, JSON.stringify(conversation.slice(-VOICE_HISTORY_LIMIT)));
    } catch {
      // Ignore storage errors in private mode.
    }
  }, [conversation, conversationKey]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.abort?.();
    } catch {
      // Ignore abort errors.
    }
    try {
      recognition?.stop?.();
    } catch {
      // Ignore stop errors.
    }
    setIsListening(false);
    setVoicePhase("idle");
    setLastResponse(tx("Voice listening was stopped."));
  }, [tx]);

  const executeIntentResult = useCallback(
    async (result: VoiceIntentResult) => {
      const response = result.response || getFallbackVoiceResponse(language);
      const resultLanguage =
        result.responseLanguage === "hi" || result.responseLanguage === "mr" || result.responseLanguage === "bh"
          ? result.responseLanguage
          : language;
      const responseLocale = toLocale(resultLanguage);

      setLastResponse(response);
      setShowDock(true);
      setVoicePhase("speaking");
      appendConversation({
        role: "assistant",
        text: response,
        language: resultLanguage,
        timestamp: Date.now(),
      });

      const onSpeakEnd = () => {
        setVoicePhase("idle");
        if (result.autoListen) {
          if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current);
          autoListenTimeoutRef.current = setTimeout(() => {
            startListeningRef.current();
            autoListenTimeoutRef.current = null;
          }, 500);
        }
      };

      speak(response, responseLocale, onSpeakEnd);

      if (result.type === "action") {
        if (result.actionId === "stop_listening") {
          stopListening();
          return;
        }
        setVoicePhase("executing");
        const executed = await executeVoiceAction(
          result.actionId,
          {
            router,
            role,
            pathname,
            language,
            setLanguage,
            toggleTheme,
            repeatLastResponse,
            pageActions,
          },
          result.args
        );

        if (!executed) {
          setLastResponse(getFallbackVoiceResponse(language));
          setVoicePhase("idle");
        }
      }
    },
    [appendConversation, language, pageActions, pathname, repeatLastResponse, role, router, setLanguage, stopListening, toggleTheme]
  );

  const processTranscript = useCallback(
    async (transcript: string) => {
      const clean = transcript.trim();
      if (!clean) return;
      const interactionLanguage = inferLanguageFromTranscript(clean, language);
      const visibleFormFields = collectVisibleFormFieldHints();
      const currentUserMessage: VoiceConversationMessage = {
        role: "user",
        text: clean,
        language: interactionLanguage,
        timestamp: Date.now(),
      };
      const requestHistory = [...conversation.slice(-15), currentUserMessage];

      setIsProcessing(true);
      setVoicePhase("processing");
      setLastTranscript(clean);
      setShowDock(true);
      appendConversation(currentUserMessage);

      try {
        let result: VoiceIntentResult;

        try {
          result = await getVoiceIntentAPI({
            transcript: clean,
            language: interactionLanguage,
            role,
            pathname,
            patientCtx,
            availableActions,
            visibleFormFields,
            conversationHistory: requestHistory,
          });
          setIsOfflineFallback(false);
        } catch (error) {
          console.warn("Voice intent API unavailable, using local fallback", error);
          setIsOfflineFallback(true);
          result = await getVoiceIntentClient({
            transcript: clean,
            language: interactionLanguage,
            role,
            pathname,
            conversationHistory: requestHistory,
          });
        }

        await executeIntentResult(result);
      } catch (error) {
        console.error("Voice processing failed", error);
        const fallback = getFallbackVoiceResponse(interactionLanguage);
        setLastResponse(fallback);
        speak(fallback, toLocale(interactionLanguage));
        setVoicePhase("speaking");
      } finally {
        setIsProcessing(false);
        if (!isListening) setVoicePhase("idle");
      }
    },
    [appendConversation, availableActions, conversation, executeIntentResult, isListening, language, pathname, patientCtx, role]
  );

  const startListening = useCallback(async () => {
    setShowDock(true);

    if (!isSupported) {
      const message = tx("Voice recognition is not supported on this browser.");
      setLastResponse(message);
      setVoicePhase("idle");
      return;
    }
    if (isListening || isProcessing) return;
    if (typeof window === "undefined") return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      const message = tx("Voice recognition is not supported on this browser.");
      setLastResponse(message);
      setVoicePhase("idle");
      return;
    }
    setVoicePhase("listening");

    let resolvedPermission = micPermission;
    if (navigator?.permissions?.query) {
      try {
        const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
        resolvedPermission = (result.state as "granted" | "denied" | "prompt") || "unknown";
        setMicPermission(resolvedPermission);
      } catch {
        resolvedPermission = "unknown";
        setMicPermission(resolvedPermission);
      }
    }

    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        resolvedPermission = "granted";
        setMicPermission("granted");
      } catch {
        // Do not hard-stop here. Some browsers still allow SpeechRecognition
        // even when explicit getUserMedia probing fails.
        resolvedPermission = "denied";
        setMicPermission("denied");
      }
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors from stale recognition instances.
    }

    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      manualStopRef.current = false;
      const localeChain =
        language === "bh"
          ? ["hi-IN", "en-IN"]
          : language === "mr"
            ? ["mr-IN", "hi-IN", "en-IN"]
            : [toLocale(language), "en-IN"];
      let localeIndex = 0;

      const startWithCurrentLocale = () => {
        recognition.lang = localeChain[localeIndex] || "en-IN";
        recognition.start();
      };

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoicePhase("listening");
        setLastResponse(tx("Listening..."));
      };
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        setVoicePhase("idle");
        if (manualStopRef.current) {
          manualStopRef.current = false;
        }
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        setVoicePhase("idle");
        if (manualStopRef.current && event?.error === "aborted") {
          manualStopRef.current = false;
          setLastResponse(tx("Voice listening was stopped."));
          return;
        }
        if (event?.error === "language-not-supported" && localeIndex < localeChain.length - 1) {
          localeIndex += 1;
          setLastResponse(`${tx("Voice locale fallback active")}: ${localeChain[localeIndex]}`);
          try {
            startWithCurrentLocale();
            return;
          } catch {
            // Continue to regular error message path.
          }
        }
        recognitionRef.current = null;
        const message = speechErrorMessage(event?.error, tx, resolvedPermission);
        setLastResponse(message);
      };
      recognition.onresult = (event: any) => {
        if (manualStopRef.current) return;
        const transcript =
          Array.from(event.results || [])
            .map((row: any) => row?.[0]?.transcript || "")
            .join(" ")
            .trim() || "";
        if (!transcript?.trim()) {
          setLastResponse(tx("I could not hear anything. Tap the mic and try speaking again."));
          return;
        }
        void processTranscript(transcript);
      };

      startWithCurrentLocale();
    } catch (error) {
      console.error("Unable to start voice recognition", error);
      recognitionRef.current = null;
      setIsListening(false);
      setVoicePhase("idle");
      setLastResponse(tx("Unable to start voice recognition. Please refresh and try again."));
    }
  }, [isListening, isProcessing, isSupported, language, micPermission, processTranscript, tx]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  useEffect(() => {
    return () => {
      if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current);
    };
  }, []);

  const setPatientContext = useCallback((ctx: PatientVoiceContext) => {
    setPatientCtxState(ctx);
  }, []);

  const phaseLabel = useMemo(() => {
    if (voicePhase === "listening") return tx("Listening...");
    if (voicePhase === "processing") return tx("Understanding...");
    if (voicePhase === "executing") return tx("Executing command...");
    if (voicePhase === "speaking") return tx("Responding...");
    return tx("Tap to talk");
  }, [tx, voicePhase]);

  return (
    <VoiceCommandContext.Provider
      value={{
        isListening,
        isProcessing,
        isSupported,
        isOfflineFallback,
        lastTranscript,
        lastResponse,
        startListening,
        stopListening,
        setPatientContext,
        registerPageActions,
      }}
    >
      {children}

      {isSupported && (
        <div className="fixed bottom-20 right-4 z-[9999] flex flex-col items-end gap-3 md:bottom-6">
          {showDock && (
            <div className="w-[21rem] max-w-[90vw] rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 shadow-2xl backdrop-blur p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    {tx("Voice Assistant")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDock(false)}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  aria-label={tx("Close voice panel")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isOfflineFallback && (
                <div className="mb-3 rounded-lg border border-amber-300/70 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <WifiOff className="w-3.5 h-3.5" />
                  {tx("Limited offline mode: cached translation + reduced voice commands.")}
                </div>
              )}

              {!isOfflineFallback && (
                <div className="mb-3 rounded-lg border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{tx("Dynamic AI voice mode active")}</span>
                </div>
              )}

              <div className="mb-3 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300">
                {phaseLabel}
              </div>

              <div className="mb-3 max-h-36 overflow-y-auto space-y-2 pr-1">
                {conversation.slice(-4).map((message, idx) => (
                  <p
                    key={`${message.role}-${message.timestamp}-${idx}`}
                    className={`text-sm leading-snug ${
                      message.role === "assistant"
                        ? "font-medium text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-700 dark:text-neutral-200"
                    }`}
                  >
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {message.role === "assistant" ? "Aarohi" : tx("You")}:
                    </span>{" "}
                    {message.text}
                  </p>
                ))}
                {conversation.length === 0 && lastResponse && (
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-snug">
                    <span className="text-xs text-blue-500">Aarohi:</span> {lastResponse}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {hintActions.map((action) => (
                  <span
                    key={String(action.id)}
                    className="rounded-full border border-neutral-200 dark:border-neutral-700 px-2.5 py-1 text-[11px] text-neutral-600 dark:text-neutral-300"
                  >
                    {tx(action.label)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (isListening || recognitionRef.current) {
                stopListening();
              } else {
                if (isProcessing) return;
                void startListening();
              }
            }}
            aria-label={isListening ? tx("Stop listening") : tx("Start voice command")}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${
              isListening
                ? "bg-red-500 hover:bg-red-600 ring-4 ring-red-300/60 animate-pulse"
                : isProcessing
                  ? "bg-blue-500 cursor-wait"
                  : "bg-neutral-900 dark:bg-white hover:scale-105"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : isListening ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white dark:text-neutral-900" />
            )}
          </button>

          <span
            className={`text-xs font-medium ${
              voicePhase === "listening"
                ? "text-red-500 dark:text-red-400"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            {phaseLabel}
          </span>
        </div>
      )}
    </VoiceCommandContext.Provider>
  );
}
