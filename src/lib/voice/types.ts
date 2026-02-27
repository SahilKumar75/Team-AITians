import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Language } from "@/lib/i18n/translations";

export type VoiceActionId =
  | "navigate_home"
  | "navigate_records"
  | "navigate_journey"
  | "navigate_emergency"
  | "navigate_permissions"
  | "navigate_settings"
  | "navigate_help"
  | "navigate_back"
  | "patient_upload_record"
  | "patient_open_timeline"
  | "patient_share_journey"
  | "patient_open_emergency_qr"
  | "doctor_open_queue"
  | "doctor_open_voice"
  | "doctor_open_records"
  | "doctor_open_patients"
  | "doctor_finalize_note"
  | "doctor_send_note"
  | "hospital_open_admin"
  | "hospital_open_doctors"
  | "hospital_open_upload"
  | "switch_language"
  | "toggle_theme"
  | "repeat_last_response"
  | "fill_form_fields"
  | "submit_form"
  | "stop_listening";

export type VoiceRole = "patient" | "doctor" | "hospital" | "guest";

export interface PatientVoiceContext {
  name?: string;
  medications?: string;
  allergies?: string;
  conditions?: string;
  bmi?: string;
  bmiCategory?: string;
  bloodGroup?: string;
}

export type VoiceIntentResult =
  | {
      type: "action";
      actionId: VoiceActionId | string;
      args?: Record<string, string | number | boolean>;
      response: string;
      autoListen?: boolean;
      responseLanguage?: string;
    }
  | {
      type: "chat";
      response: string;
      autoListen?: boolean;
      responseLanguage?: string;
    }
  | {
      type: "fallback";
      response: string;
      autoListen?: boolean;
      responseLanguage?: string;
      reason?: string;
    };

export interface VoiceActionDefinition {
  id: VoiceActionId | string;
  label: string;
  roles?: VoiceRole[];
  paths?: string[];
  keywords?: Partial<Record<Language, string[]>>;
  execute?: (ctx: VoiceExecutionContext, args?: Record<string, string | number | boolean>) => void | Promise<void>;
}

export interface VoiceExecutionContext {
  router: AppRouterInstance;
  role: VoiceRole;
  pathname: string;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleTheme?: () => void;
  repeatLastResponse?: () => void;
  pageActions?: VoiceActionDefinition[];
}

export interface VoiceIntentRequestBody {
  transcript: string;
  language: Language;
  role?: VoiceRole;
  pathname?: string;
  patientCtx?: PatientVoiceContext;
  availableActions?: Array<Pick<VoiceActionDefinition, "id" | "label">>;
  visibleFormFields?: string[];
  conversationHistory?: VoiceConversationMessage[];
}

export interface VoiceConversationMessage {
  role: "user" | "assistant";
  text: string;
  language: Language;
  timestamp: number;
}
