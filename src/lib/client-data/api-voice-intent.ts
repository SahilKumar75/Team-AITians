import type { Language } from "@/lib/i18n/translations";
import type {
  VoiceConversationMessage,
  PatientVoiceContext,
  VoiceActionDefinition,
  VoiceIntentResult,
  VoiceRole,
} from "@/lib/voice/types";

export async function getVoiceIntentAPI(args: {
  transcript: string;
  language: Language;
  role: VoiceRole;
  pathname: string;
  patientCtx?: PatientVoiceContext;
  availableActions?: VoiceActionDefinition[];
  visibleFormFields?: string[];
  conversationHistory?: VoiceConversationMessage[];
}): Promise<VoiceIntentResult> {
  const {
    transcript,
    language,
    role,
    pathname,
    patientCtx,
    availableActions,
    visibleFormFields,
    conversationHistory,
  } = args;

  const res = await fetch("/api/voice-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      language,
      role,
      pathname,
      patientCtx,
      availableActions: (availableActions || []).map((a) => ({ id: a.id, label: a.label })),
      visibleFormFields,
      conversationHistory,
    }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return (await res.json()) as VoiceIntentResult;
}
