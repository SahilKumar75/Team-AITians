/**
 * Stub responses for API routes that have no client implementation yet
 * (dashboard, search, patients, voice, AI, emergency, language).
 * Used when NEXT_PUBLIC_USE_CLIENT_DATA=true so static export never calls /api/*.
 */

import { KEYS } from "./storage-keys";
import { getFallbackVoiceResponse, matchVoiceActionFromTranscript } from "@/lib/voice/action-catalog";
import type { Language } from "@/lib/i18n/translations";
import type { VoiceConversationMessage, VoiceIntentResult, VoiceRole } from "@/lib/voice/types";
import {
  buildHealthInsights,
  safeHealthInsightsLanguage,
  type HealthInsightsInput,
  type HealthInsightsResult,
} from "@/lib/ai/health-insights";

export interface VoiceNoteClient {
  id: string;
  chiefComplaint: string;
  historyOfPresent: string;
  examination: string;
  diagnosis: string;
  plan: string;
  medications: string;
  followUp: string;
  rawTranscript?: string;
  status: string;
  createdAt: string;
}

export function getDoctorDashboardClient(): Promise<{
  totalPatients?: number;
  pendingAccess?: number;
  recentRecords?: unknown[];
}> {
  return Promise.resolve({ totalPatients: 0, pendingAccess: 0, recentRecords: [] });
}

export function getDoctorSearchClient(_q: string): Promise<{ doctors: { id: string; name: string; email?: string }[] }> {
  return Promise.resolve({ doctors: [] });
}

export function getDoctorPatientsClient(_status?: string): Promise<{ patients: unknown[] }> {
  return Promise.resolve({ patients: [] });
}

export function getVoiceNotesClient(wallet: string | null): Promise<{ notes: unknown[] }> {
  if (typeof window === "undefined" || !wallet) return Promise.resolve({ notes: [] });
  try {
    const raw = localStorage.getItem(KEYS.voiceNotes(wallet));
    const arr = raw ? (JSON.parse(raw) as VoiceNoteClient[]) : [];
    return Promise.resolve({ notes: Array.isArray(arr) ? arr : [] });
  } catch {
    return Promise.resolve({ notes: [] });
  }
}

export function getVoiceNoteClient(id: string, wallet: string | null): Promise<unknown | null> {
  return getVoiceNotesClient(wallet).then(({ notes }) => {
    const n = (notes as { id?: string }[]).find((x) => x.id === id);
    return n ?? null;
  });
}

export function updateVoiceNoteStatusClient(
  wallet: string | null,
  id: string,
  status: "draft" | "finalized" | "sent"
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined" || !wallet) {
    return Promise.resolve({ success: false, error: "Wallet not available" });
  }
  try {
    const raw = localStorage.getItem(KEYS.voiceNotes(wallet));
    const list = raw ? (JSON.parse(raw) as VoiceNoteClient[]) : [];
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return Promise.resolve({ success: false, error: "Note not found" });
    list[idx] = { ...list[idx], status };
    localStorage.setItem(KEYS.voiceNotes(wallet), JSON.stringify(list));
    return Promise.resolve({ success: true });
  } catch {
    return Promise.resolve({ success: false, error: "Failed to update note status" });
  }
}

function pickKeywordLine(transcript: string, words: string[]): string {
  const lines = transcript
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lowerWords = words.map((w) => w.toLowerCase());
  for (const line of lines) {
    const l = line.toLowerCase();
    if (lowerWords.some((w) => l.includes(w))) return line;
  }
  return "";
}

function toSentence(value: string, fallback: string): string {
  const v = value.trim();
  if (!v) return fallback;
  return v.endsWith(".") ? v : `${v}.`;
}

export function createVoiceSoapNoteClient(
  wallet: string | null,
  transcript: string
): Promise<{ success: boolean; noteId?: string; error?: string }> {
  if (typeof window === "undefined" || !wallet) {
    return Promise.resolve({ success: false, error: "Wallet not available" });
  }

  const chiefComplaint = pickKeywordLine(transcript, ["pain", "fever", "cough", "complaint", "issue"]);
  const diagnosis = pickKeywordLine(transcript, ["diagnosis", "impression", "likely", "suspected"]);
  const medications = pickKeywordLine(transcript, ["tablet", "medicine", "medication", "dose", "mg", "syrup"]);
  const followUp = pickKeywordLine(transcript, ["follow up", "review", "after", "week", "days"]);

  const note: VoiceNoteClient = {
    id: `note-${Date.now()}`,
    chiefComplaint: toSentence(chiefComplaint, "Clinical consultation captured by voice."),
    historyOfPresent: toSentence(transcript, "No history captured."),
    examination: "General examination discussed during consultation.",
    diagnosis: toSentence(diagnosis, "Provisional diagnosis recorded."),
    plan: "Continue treatment plan and monitor symptoms.",
    medications: toSentence(medications, "Medication advice discussed."),
    followUp: toSentence(followUp, "Follow-up suggested as clinically required."),
    rawTranscript: transcript,
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(KEYS.voiceNotes(wallet));
    const list = raw ? (JSON.parse(raw) as VoiceNoteClient[]) : [];
    const next = [note, ...(Array.isArray(list) ? list : [])].slice(0, 100);
    localStorage.setItem(KEYS.voiceNotes(wallet), JSON.stringify(next));
    return Promise.resolve({ success: true, noteId: note.id });
  } catch {
    return Promise.resolve({ success: false, error: "Failed to save voice note" });
  }
}

export function getPatientPermissionsClient(): Promise<{ permissions: unknown[] }> {
  return Promise.resolve({ permissions: [] });
}

export function getPatientDoctorsSearchClient(_query: string): Promise<{ doctors: unknown[] }> {
  return Promise.resolve({ doctors: [] });
}

export function grantAccessClient(_body: { doctorAddress: string }): Promise<{ success: boolean }> {
  return Promise.resolve({ success: true });
}

export function getHealthInsightsClient(input?: HealthInsightsInput): Promise<HealthInsightsResult> {
  const language = safeHealthInsightsLanguage(input?.language);
  return Promise.resolve(buildHealthInsights(input ?? {}, language));
}

export function getVoiceIntentClient(args: {
  transcript: string;
  language: Language;
  role: VoiceRole;
  pathname: string;
  conversationHistory?: VoiceConversationMessage[];
}): Promise<VoiceIntentResult> {
  const { transcript, language, role, pathname } = args;
  const lower = transcript.toLowerCase();

  const extractSimpleFormArgs = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const name = transcript.match(/(?:name|नाम)\s*(?:is|:|है|आहे|बा)?\s*([^\.,;]+)/i)?.[1]?.trim();
    const phone = transcript.match(/(?:phone|mobile|फोन)\s*(?:is|:|है|आहे|बा)?\s*([0-9+\-\s]{6,})/i)?.[1]?.trim();
    const age = transcript.match(/(?:age|उम्र)\s*(?:is|:|है|आहे|बा)?\s*([0-9]{1,3})/i)?.[1]?.trim();
    if (name) out.name = name;
    if (phone) out.phone = phone;
    if (age) out.age = age;
    return out;
  };

  if (
    lower.includes("stop listening") ||
    lower.includes("सुनना बंद") ||
    lower.includes("ऐकणे बंद") ||
    lower.includes("सुने बंद")
  ) {
    return Promise.resolve({
      type: "action",
      actionId: "stop_listening",
      response:
        language === "hi"
          ? "अभी सुनना बंद कर रही हूँ।"
          : language === "mr"
            ? "आता ऐकणे थांबवत आहे."
            : language === "bh"
              ? "अब सुने बंद करत बानी।"
              : "Stopping listening now.",
      autoListen: false,
      responseLanguage: language,
    });
  }

  if (/\b(fill|form|details|भरो|तपशील|डिटेल)\b/.test(lower)) {
    const extracted = extractSimpleFormArgs();
    return Promise.resolve({
      type: "action",
      actionId: "fill_form_fields",
      args: Object.keys(extracted).length > 0 ? extracted : undefined,
      response:
        language === "hi"
          ? "ठीक है, फील्ड और वैल्यू बोलिए।"
          : language === "mr"
            ? "ठीक आहे, फील्ड आणि व्हॅल्यू बोला."
            : language === "bh"
              ? "ठीक बा, फील्ड आ वैल्यू बोलीं।"
              : "Sure. Say field and value and I will fill it.",
      autoListen: true,
      responseLanguage: language,
    });
  }

  if (/\b(submit|save|continue|सबमिट|सेव|आगे|पुढे)\b/.test(lower)) {
    return Promise.resolve({
      type: "action",
      actionId: "submit_form",
      response:
        language === "hi"
          ? "ठीक है, फॉर्म सबमिट कर रही हूँ।"
          : language === "mr"
            ? "ठीक आहे, फॉर्म सबमिट करत आहे."
            : language === "bh"
              ? "ठीक बा, फॉर्म सबमिट करत बानी।"
              : "Okay, submitting the form.",
      autoListen: false,
      responseLanguage: language,
    });
  }

  const actionId = matchVoiceActionFromTranscript({
    transcript,
    language,
    role,
    pathname,
  });

  if (actionId) {
    return Promise.resolve({
      type: "action",
      actionId,
      response:
        language === "hi"
          ? "ठीक है, कमांड लागू कर रही हूँ।"
          : language === "mr"
            ? "ठीक आहे, कमांड लागू करत आहे."
            : language === "bh"
              ? "ठीक बा, कमांड लागू करत बानी।"
              : "Done. Executing your command.",
      autoListen: false,
      responseLanguage: language,
    });
  }
  const healthSignal =
    lower.includes("stomach") ||
    lower.includes("pain") ||
    lower.includes("fever") ||
    lower.includes("hurt") ||
    lower.includes("दर्द") ||
    lower.includes("बुखार") ||
    lower.includes("पेट");
  if (healthSignal) {
    const response =
      language === "hi"
        ? "मैं डॉक्टर नहीं हूँ, लेकिन शुरुआती मदद दे सकती हूँ। अगर पेट दर्द तेज है, उल्टी या बुखार है, तो तुरंत डॉक्टर से मिलें या इमरजेंसी खोलें।"
        : language === "mr"
          ? "मी डॉक्टर नाही, पण प्राथमिक मदत सांगू शकते. पोटदुखी तीव्र असेल, उलटी किंवा ताप असेल तर लगेच डॉक्टरांना भेटा किंवा इमर्जन्सी उघडा."
          : language === "bh"
            ? "हम डॉक्टर ना हई, बाकिर शुरुआती मदद बता सकीले। पेट में तेज दर्द, उल्टी या बुखार होखे त तुरंत डॉक्टर से मिलीं या इमरजेंसी खोलीं।"
            : "I am not a doctor, but I can give first-step guidance. If stomach pain is severe, with vomiting or fever, contact a doctor now or open emergency.";
    return Promise.resolve({
      type: "chat",
      response,
      autoListen: true,
      responseLanguage: language,
    });
  }

  return Promise.resolve({
    type: "fallback",
    response: getFallbackVoiceResponse(language),
    autoListen: false,
    responseLanguage: language,
    reason: "client_keyword_fallback",
  });
}

export function notifyEmergencyClient(): Promise<{ success: boolean }> {
  return Promise.resolve({ success: true });
}

export function getEmergencyClient(_address: string): Promise<{ profile?: unknown; records?: unknown[] }> {
  return Promise.resolve({});
}

export function getLanguageClient(): Promise<{ language: string }> {
  if (typeof window === "undefined") return Promise.resolve({ language: "en" });
  try {
    const lang = localStorage.getItem(KEYS.language) || "en";
    return Promise.resolve({ language: lang });
  } catch {
    return Promise.resolve({ language: "en" });
  }
}

export function setLanguageClient(language: string): Promise<{ success: boolean }> {
  if (typeof window === "undefined") return Promise.resolve({ success: false });
  try {
    localStorage.setItem(KEYS.language, language);
    return Promise.resolve({ success: true });
  } catch {
    return Promise.resolve({ success: false });
  }
}
