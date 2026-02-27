import type { Language } from "@/lib/i18n/translations";
import type { VoiceActionDefinition, VoiceActionId, VoiceRole } from "@/lib/voice/types";

export const GLOBAL_VOICE_ACTIONS: VoiceActionDefinition[] = [
  {
    id: "navigate_home",
    label: "Go home",
    keywords: {
      en: ["home", "dashboard", "go home"],
      hi: ["होम", "घर", "डैशबोर्ड"],
      mr: ["होम", "मुख्य", "डॅशबोर्ड"],
      bh: ["होम", "घर", "डैशबोर्ड"],
    },
  },
  {
    id: "navigate_records",
    label: "Open records",
    keywords: {
      en: ["records", "medical records", "documents"],
      hi: ["रिकॉर्ड", "दस्तावेज"],
      mr: ["नोंदी", "दस्तऐवज"],
      bh: ["रिकॉर्ड", "कागज"],
    },
  },
  {
    id: "navigate_journey",
    label: "Open journey",
    keywords: {
      en: ["journey", "queue", "appointment"],
      hi: ["यात्रा", "कतार", "अपॉइंटमेंट"],
      mr: ["प्रवास", "रांग", "अपॉइंटमेंट"],
      bh: ["यात्रा", "कतार", "अपॉइंटमेंट"],
    },
  },
  {
    id: "navigate_emergency",
    label: "Open emergency",
    keywords: {
      en: ["emergency", "emergency qr"],
      hi: ["आपातकाल", "इमरजेंसी", "आपात"],
      mr: ["आपत्कालीन", "इमर्जन्सी"],
      bh: ["इमरजेंसी", "आपात"],
    },
  },
  {
    id: "navigate_permissions",
    label: "Open access",
    keywords: {
      en: ["permissions", "access", "doctor access"],
      hi: ["पहुंच", "एक्सेस", "परमिशन"],
      mr: ["परवानगी", "प्रवेश"],
      bh: ["एक्सेस", "अनुमति"],
    },
  },
  {
    id: "navigate_settings",
    label: "Open settings",
    keywords: {
      en: ["settings", "preferences"],
      hi: ["सेटिंग्स", "प्रेफरेंस"],
      mr: ["सेटिंग्स", "प्राधान्य"],
      bh: ["सेटिंग्स"],
    },
  },
  {
    id: "navigate_help",
    label: "Open help",
    keywords: {
      en: ["help", "support"],
      hi: ["मदद", "सहायता"],
      mr: ["मदत", "सपोर्ट"],
      bh: ["मदद", "सहायता"],
    },
  },
  {
    id: "navigate_back",
    label: "Go back",
    keywords: {
      en: ["go back", "back"],
      hi: ["वापस", "पीछे"],
      mr: ["मागे", "परत"],
      bh: ["वापस", "पीछे"],
    },
  },
  {
    id: "switch_language",
    label: "Switch language",
    keywords: {
      en: ["change language", "switch language", "hindi", "marathi", "bhojpuri", "english"],
      hi: ["भाषा बदलो", "हिंदी", "मराठी", "भोजपुरी", "अंग्रेजी"],
      mr: ["भाषा बदला", "हिंदी", "मराठी", "भोजपुरी", "इंग्रजी"],
      bh: ["भाषा बदल", "हिंदी", "मराठी", "भोजपुरी", "अंग्रेजी"],
    },
  },
  {
    id: "toggle_theme",
    label: "Toggle theme",
    keywords: {
      en: ["dark mode", "light mode", "toggle theme"],
      hi: ["डार्क मोड", "लाइट मोड", "थीम बदलो"],
      mr: ["डार्क मोड", "लाइट मोड", "थीम बदला"],
      bh: ["डार्क मोड", "लाइट मोड"],
    },
  },
  {
    id: "repeat_last_response",
    label: "Repeat",
    keywords: {
      en: ["repeat", "say again"],
      hi: ["दोहराओ", "फिर से बोलो"],
      mr: ["पुन्हा सांगा", "परत बोला"],
      bh: ["फिर से बोल", "दोहराव"],
    },
  },
  {
    id: "fill_form_fields",
    label: "Fill details",
    keywords: {
      en: ["fill details", "fill form", "my name is", "set my", "enter details"],
      hi: ["फॉर्म भरो", "डिटेल्स भरो", "मेरा नाम", "सेट करो"],
      mr: ["फॉर्म भरा", "तपशील भरा", "माझं नाव", "सेट करा"],
      bh: ["फॉर्म भरीं", "डिटेल्स भरीं", "हमार नाम", "सेट करीं"],
    },
  },
  {
    id: "submit_form",
    label: "Submit form",
    keywords: {
      en: ["submit", "save form", "continue", "next step"],
      hi: ["सबमिट", "सेव", "आगे बढ़ो", "अगला"],
      mr: ["सबमिट", "सेव्ह", "पुढे जा", "पुढचा"],
      bh: ["सबमिट", "सेव", "आगे बढ़ीं", "अगिला"],
    },
  },
  {
    id: "stop_listening",
    label: "Stop listening",
    keywords: {
      en: ["stop listening", "stop voice", "mute mic", "be quiet"],
      hi: ["सुनना बंद", "वॉइस बंद", "माइक बंद"],
      mr: ["ऐकणे बंद", "आवाज बंद", "माइक बंद"],
      bh: ["सुने बंद", "आवाज बंद", "माइक बंद"],
    },
  },
];

export const ROLE_VOICE_ACTIONS: VoiceActionDefinition[] = [
  { id: "patient_upload_record", label: "Upload record", roles: ["patient"] },
  { id: "patient_open_timeline", label: "Open timeline", roles: ["patient"] },
  { id: "patient_share_journey", label: "Share journey", roles: ["patient"] },
  { id: "patient_open_emergency_qr", label: "Emergency QR", roles: ["patient"] },
  { id: "doctor_open_queue", label: "Open doctor queue", roles: ["doctor"] },
  { id: "doctor_open_voice", label: "Open voice notes", roles: ["doctor"] },
  { id: "doctor_open_records", label: "Open doctor records", roles: ["doctor"] },
  { id: "doctor_open_patients", label: "Open patients", roles: ["doctor"] },
  { id: "doctor_finalize_note", label: "Finalize note", roles: ["doctor"], paths: ["/doctor/voice/"] },
  { id: "doctor_send_note", label: "Send note", roles: ["doctor"], paths: ["/doctor/voice/"] },
  { id: "hospital_open_admin", label: "Open hospital queue", roles: ["hospital"] },
  { id: "hospital_open_doctors", label: "Open doctors", roles: ["hospital"] },
  { id: "hospital_open_upload", label: "Open upload", roles: ["hospital"] },
];

function includeByRole(action: VoiceActionDefinition, role: VoiceRole): boolean {
  return !action.roles || action.roles.length === 0 || action.roles.includes(role);
}

function includeByPath(action: VoiceActionDefinition, pathname: string): boolean {
  if (!action.paths || action.paths.length === 0) return true;
  return action.paths.some((path) => pathname.startsWith(path));
}

export function getAvailableVoiceActions(
  role: VoiceRole,
  pathname: string,
  pageActions: VoiceActionDefinition[] = []
): VoiceActionDefinition[] {
  const merged = [...GLOBAL_VOICE_ACTIONS, ...ROLE_VOICE_ACTIONS, ...pageActions];
  return merged.filter((action) => includeByRole(action, role) && includeByPath(action, pathname));
}

export function getHintActions(role: VoiceRole, pathname: string, pageActions: VoiceActionDefinition[] = []): VoiceActionDefinition[] {
  return getAvailableVoiceActions(role, pathname, pageActions).slice(0, 8);
}

function pickLangKeywords(action: VoiceActionDefinition, language: Language): string[] {
  const lang = action.keywords?.[language] ?? [];
  const en = action.keywords?.en ?? [];
  return [...lang, ...en];
}

export function matchVoiceActionFromTranscript(args: {
  transcript: string;
  language: Language;
  role: VoiceRole;
  pathname: string;
  pageActions?: VoiceActionDefinition[];
}): VoiceActionId | string | null {
  const { transcript, language, role, pathname, pageActions = [] } = args;
  const text = transcript.toLowerCase().trim();
  const available = getAvailableVoiceActions(role, pathname, pageActions);

  for (const action of available) {
    const keywords = pickLangKeywords(action, language);
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return action.id;
    }
  }

  return null;
}

export function inferLanguageFromTranscript(transcript: string, fallback: Language): Language {
  const text = transcript.toLowerCase();
  if (/[\u0900-\u097f]/.test(text)) {
    if (
      /\b(का|बा|भइल|रउआ|हमार|तनी|कइसे|काहे)\b/.test(text) ||
      text.includes("भोजपुरी")
    ) {
      return "bh";
    }
    if (
      /\b(काय|आहे|मध्ये|नाही|तुम्ही|माझे|झाले)\b/.test(text) ||
      text.includes("मराठी")
    ) {
      return "mr";
    }
    if (fallback === "mr") return "mr";
    if (fallback === "bh") return "bh";
    return "hi";
  }
  if (text.includes("bhojpuri")) return "bh";
  if (text.includes("marathi")) return "mr";
  if (text.includes("hindi")) return "hi";
  if (text.includes("english")) return "en";
  return fallback;
}

export function getFallbackVoiceResponse(language: Language): string {
  const map: Record<Language, string> = {
    en: "I could not process that right now. You can still say commands like open records or open help.",
    hi: "मैं अभी इसे प्रोसेस नहीं कर पाई। आप 'रिकॉर्ड खोलो' या 'मदद खोलो' जैसे कमांड बोल सकते हैं।",
    mr: "मी आत्ता ते प्रक्रिया करू शकले नाही. तुम्ही 'नोंदी उघडा' किंवा 'मदत उघडा' असे कमांड बोलू शकता.",
    bh: "हम अभी ई प्रोसेस ना कर पइनी। रउआ 'रिकॉर्ड खोल' या 'मदद खोल' जइसन कमांड बोल सकत बानी।",
  };
  return map[language] || map.en;
}
