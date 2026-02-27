"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createVoiceSoapNoteClient } from "@/lib/client-data";
import { useLanguage } from "@/contexts/LanguageContext";
import { toLocale } from "@/lib/i18n/locale";

interface VoiceRecorderProps {
  onTranscriptReady?: (transcript: string) => void;
  onNoteGenerated?: (noteId: string) => void;
  language?: string;
  disabled?: boolean;
}

export function VoiceRecorder({
  onTranscriptReady,
  onNoteGenerated,
  language,
  disabled = false,
}: VoiceRecorderProps) {
  const { user } = useAuth();
  const { tx, language: selectedLanguage } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    (Boolean((window as any).SpeechRecognition) || Boolean((window as any).webkitSpeechRecognition));

  const startRecording = useCallback(() => {
    if (!isSupported || disabled) {
      setError(tx("Speech recognition not supported"));
      return;
    }
    setError("");
    setTranscript("");
    setDuration(0);

    const Recognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language || toLocale(selectedLanguage);

    recognition.onresult = (event: any) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + " ";
        }
      }
      if (final) {
        setTranscript((prev) => prev + final);
      }
    };
    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") setError(event.error || "Recognition error");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, [isSupported, disabled, language]);

  const stopRecording = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    const finalTranscript = transcript.trim();
    if (!finalTranscript) {
      setError(tx("No speech detected"));
      return;
    }

    onTranscriptReady?.(finalTranscript);

    setIsProcessing(true);
    setError("");
    try {
      const result = await createVoiceSoapNoteClient(user?.walletAddress ?? null, finalTranscript);
      if (!result.success) throw new Error(result.error || tx("Failed to generate note"));
      if (result.noteId) onNoteGenerated?.(result.noteId);
    } catch (e: any) {
      setError(e.message || tx("Failed to generate clinical note"));
    } finally {
      setIsProcessing(false);
    }
  }, [language, onNoteGenerated, onTranscriptReady, selectedLanguage, transcript, tx, user?.walletAddress]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 bg-neutral-50 dark:bg-neutral-800">
        <p className="text-neutral-600 dark:text-neutral-400">
          {tx("Voice recording is not supported in this browser. Use Chrome or Edge.")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 bg-white dark:bg-neutral-800"
      role="region"
          aria-label="Voice documentation"
        >
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
        {tx("Voice Documentation")}
      </h3>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing || disabled}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : isProcessing
              ? "bg-neutral-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          aria-pressed={isRecording}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" aria-hidden />
          ) : isRecording ? (
            <Square className="w-10 h-10 text-white" aria-hidden />
          ) : (
            <Mic className="w-10 h-10 text-white" aria-hidden />
          )}
        </button>

        <div className="text-center">
          {isRecording && (
            <>
              <div className="text-2xl font-mono text-red-600 dark:text-red-400">
                {formatDuration(duration)}
              </div>
              <p className="text-sm text-neutral-500">{tx("Recording. Tap stop when done.")}</p>
            </>
          )}
          {isProcessing && (
            <p className="text-sm text-blue-600 dark:text-blue-400">{tx("Generating SOAP note...")}</p>
          )}
          {!isRecording && !isProcessing && (
            <p className="text-sm text-neutral-500">{tx("Tap to start recording consultation")}</p>
          )}
        </div>
      </div>

      {transcript && (
        <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{tx("Live transcript")}</p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">{transcript}</p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
