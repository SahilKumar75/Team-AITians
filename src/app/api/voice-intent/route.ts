import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getFallbackVoiceResponse,
  inferLanguageFromTranscript,
  matchVoiceActionFromTranscript,
} from "@/lib/voice/action-catalog";
import type { VoiceConversationMessage, VoiceIntentRequestBody, VoiceIntentResult, VoiceRole } from "@/lib/voice/types";
import type { Language } from "@/lib/i18n/translations";
import { isGeminiTemporarilyDisabledError, withGeminiModelFallback } from "@/lib/ai/gemini";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const languageNames: Record<Language, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  bh: "Bhojpuri",
};

function safeLanguage(input: unknown): Language {
  if (input === "hi" || input === "mr" || input === "bh") return input;
  return "en";
}

function safeRole(input: unknown): VoiceRole {
  if (input === "patient" || input === "doctor" || input === "hospital") return input;
  return "guest";
}

function localize(messageMap: Record<Language, string>, language: Language): string {
  return messageMap[language] || messageMap.en;
}

function normalizeToken(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, "");
}

function extractFormArgs(transcript: string, visibleFormFields: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  if (!visibleFormFields || visibleFormFields.length === 0) return args;

  const keys = visibleFormFields.map((field) => ({
    original: field,
    normalized: normalizeToken(field),
  }));
  const parts = transcript.split(/[,;]| and | aur | और | अनि | आ /gi).map((p) => p.trim()).filter(Boolean);

  parts.forEach((part) => {
    const lower = part.toLowerCase();
    const sepMatch = part.match(/\s*(?:is|=|:|है|आहे|बा)\s*/i);
    let left = part;
    let right = "";
    if (sepMatch) {
      const idx = part.toLowerCase().indexOf(sepMatch[0].toLowerCase());
      left = part.slice(0, idx).trim();
      right = part.slice(idx + sepMatch[0].length).trim();
    } else {
      const pair = part.split(/\s+/);
      if (pair.length >= 2) {
        left = pair[0];
        right = pair.slice(1).join(" ").trim();
      }
    }
    if (!right) return;

    const leftToken = normalizeToken(left);
    const matched = keys.find((k) => k.normalized === leftToken || k.normalized.includes(leftToken) || leftToken.includes(k.normalized));
    if (!matched) return;
    args[matched.original] = right;
  });

  // Common direct captures if label words appear in transcript.
  const capture = (pattern: RegExp) => {
    const m = transcript.match(pattern);
    return m?.[1]?.trim();
  };
  keys.forEach((k) => {
    if (args[k.original]) return;
    if (k.normalized.includes("name") || k.normalized.includes("नाम")) {
      args[k.original] = capture(/(?:name|नाम)\s*(?:is|:|है|आहे|बा)?\s*([^\.,;]+)/i) || "";
    } else if (k.normalized.includes("phone") || k.normalized.includes("mobile") || k.normalized.includes("फोन")) {
      args[k.original] = capture(/(?:phone|mobile|फोन)\s*(?:is|:|है|आहे|बा)?\s*([0-9+\-\s]{6,})/i) || "";
    } else if (k.normalized.includes("age") || k.normalized.includes("उम्र")) {
      args[k.original] = capture(/(?:age|उम्र)\s*(?:is|:|है|आहे|बा)?\s*([0-9]{1,3})/i) || "";
    }
  });

  Object.keys(args).forEach((key) => {
    if (!args[key]) delete args[key];
  });

  return args;
}

function buildLocalFallback(args: {
  transcript: string;
  language: Language;
  role: VoiceRole;
  pathname: string;
  visibleFormFields?: string[];
}): VoiceIntentResult {
  const text = args.transcript.toLowerCase();

  if (/\b(stop listening|mute mic|सुनना बंद|ऐकणे बंद|सुने बंद)\b/.test(text)) {
    return {
      type: "action",
      actionId: "stop_listening",
      response: localize(
        {
          en: "Stopping listening now.",
          hi: "अभी सुनना बंद कर रही हूँ।",
          mr: "आता ऐकणे थांबवत आहे.",
          bh: "अब सुने बंद करत बानी।",
        },
        args.language
      ),
      autoListen: false,
      responseLanguage: args.language,
    };
  }

  if (
    /\b(stomach|pain|fever|headache|hurt|दर्द|बुखार|पेट|डोकेदुखी|ताप)\b/.test(text)
  ) {
    return {
      type: "chat",
      response: localize(
        {
          en: "I am not a doctor, but I can help with first steps. If symptoms are severe or worsening, please seek medical care immediately.",
          hi: "मैं डॉक्टर नहीं हूँ, लेकिन शुरुआती मदद बता सकती हूँ। लक्षण गंभीर हों तो तुरंत डॉक्टर से मिलें।",
          mr: "मी डॉक्टर नाही, पण सुरुवातीचे मार्गदर्शन देऊ शकते. लक्षणे गंभीर असतील तर त्वरित डॉक्टरांकडे जा.",
          bh: "हम डॉक्टर ना हई, बाकिर शुरुआती मदद बता सकीले। लक्षण गंभीर होखे त तुरंत डॉक्टर से मिलीं।",
        },
        args.language
      ),
      autoListen: true,
      responseLanguage: args.language,
    };
  }

  if (
    args.visibleFormFields &&
    args.visibleFormFields.length > 0 &&
    /\b(name|age|phone|email|address|gender|blood|allerg|medication|details|भरो|डिटेल|फॉर्म|तपशील)\b/.test(text)
  ) {
    const extracted = extractFormArgs(args.transcript, args.visibleFormFields);
    return {
      type: "action",
      actionId: "fill_form_fields",
      args: Object.keys(extracted).length > 0 ? extracted : undefined,
      response: localize(
        {
          en: "I can fill this form. Say field and value, for example: name is Riya and phone is 98...",
          hi: "मैं यह फॉर्म भर सकती हूँ। बोलिए: नाम रीया है और फोन 98... ",
          mr: "मी हा फॉर्म भरू शकते. असे बोला: नाव रिया आणि फोन 98...",
          bh: "हम ई फॉर्म भर सकीले। बोलीं: नाम रिया बा अउर फोन 98...",
        },
        args.language
      ),
      autoListen: true,
      responseLanguage: args.language,
    };
  }

  const actionId = matchVoiceActionFromTranscript({
    transcript: args.transcript,
    language: args.language,
    role: args.role,
    pathname: args.pathname,
  });

  if (actionId) {
    return {
      type: "action",
      actionId,
      response: localize(
        {
          en: "Done. Executing your command.",
          hi: "ठीक है, आपका कमांड पूरा कर रही हूँ।",
          mr: "ठीक आहे, तुमचा कमांड चालू करत आहे.",
          bh: "ठीक बा, रउआ कमांड अभी चलावत बानी।",
        },
        args.language
      ),
      autoListen: false,
      responseLanguage: args.language,
    };
  }

  return {
    type: "fallback",
    response: getFallbackVoiceResponse(args.language),
    autoListen: false,
    responseLanguage: args.language,
    reason: "local_fallback_unmatched",
  };
}

function parseVoiceResult(rawText: string, language: Language): VoiceIntentResult | null {
  let text = rawText.trim();
  if (text.startsWith("```json")) text = text.replace(/^```json/, "");
  if (text.startsWith("```")) text = text.replace(/^```/, "");
  if (text.endsWith("```")) text = text.replace(/```$/, "");
  text = text.trim();

  try {
    const parsed = JSON.parse(text) as Partial<VoiceIntentResult> & {
      type?: string;
      actionId?: string;
      response?: string;
      autoListen?: boolean;
      responseLanguage?: string;
      args?: Record<string, string | number | boolean>;
      reason?: string;
    };

    const response = typeof parsed.response === "string" && parsed.response.trim() ? parsed.response : getFallbackVoiceResponse(language);
    const autoListen = parsed.autoListen === true;
    const responseLanguage =
      typeof parsed.responseLanguage === "string" ? safeLanguage(parsed.responseLanguage) : language;

    if (parsed.type === "action" && typeof parsed.actionId === "string") {
      return {
        type: "action",
        actionId: parsed.actionId,
        args: parsed.args && typeof parsed.args === "object" ? parsed.args : undefined,
        response,
        autoListen,
        responseLanguage,
      };
    }

    if (parsed.type === "chat") {
      return {
        type: "chat",
        response,
        autoListen,
        responseLanguage,
      };
    }

    if (parsed.type === "fallback") {
      return {
        type: "fallback",
        response,
        autoListen,
        responseLanguage,
        reason: typeof parsed.reason === "string" ? parsed.reason : "model_fallback",
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VoiceIntentRequestBody;
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const requestedLanguage = safeLanguage(body?.language);
    const language = inferLanguageFromTranscript(transcript, requestedLanguage);
    const role = safeRole(body?.role);
    const pathname = typeof body?.pathname === "string" ? body.pathname : "/";

    if (!transcript) {
      return NextResponse.json({
        type: "fallback",
        response: localize(
          {
            en: "I did not catch that. Please try again.",
            hi: "मैं समझ नहीं पाई। कृपया दोबारा बोलें।",
            mr: "मला समजले नाही. कृपया पुन्हा बोला.",
            bh: "हम ना समझ पइनी। कृपया दुबारा बोलल जाव।",
          },
          language
        ),
        autoListen: true,
        responseLanguage: language,
        reason: "empty_transcript",
      } satisfies VoiceIntentResult);
    }

    if (!genAI) {
      return NextResponse.json(
        buildLocalFallback({
          transcript,
          language,
          role,
          pathname,
          visibleFormFields: Array.isArray(body?.visibleFormFields) ? body.visibleFormFields : undefined,
        })
      );
    }

    const targetLang = languageNames[language] || "English";
    const patientCtx = body.patientCtx || {};
    const availableActions = Array.isArray(body.availableActions)
      ? body.availableActions
          .filter((a) => a && typeof a.id === "string" && typeof a.label === "string")
          .map((a) => ({ id: a.id, label: a.label }))
      : [];
    const visibleFormFields = Array.isArray(body.visibleFormFields)
      ? body.visibleFormFields.filter((s): s is string => typeof s === "string").slice(0, 30)
      : [];
    const conversationHistory = Array.isArray(body.conversationHistory)
      ? body.conversationHistory
          .filter((m): m is VoiceConversationMessage => {
            return (
              !!m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.text === "string" &&
              typeof m.timestamp === "number"
            );
          })
          .slice(-16)
      : [];

    const systemPrompt = `You are Aarohi, a multilingual voice assistant for a healthcare app.
User language: ${targetLang}. Respond in ${targetLang}.

Role context: ${role}
Current route: ${pathname}

Available actions (prefer these IDs only when command-like intent exists):
${JSON.stringify(availableActions)}

Visible form fields on current page:
${JSON.stringify(visibleFormFields)}

Patient context:
${JSON.stringify(patientCtx)}

Conversation history (oldest to newest):
${JSON.stringify(conversationHistory)}

Classify transcript into one of exactly 3 types:
1) action: command to operate app (navigation/settings/voice actions)
2) chat: normal conversational query
3) fallback: unclear/unsupported request

Output MUST be raw JSON only, matching this schema:
{
  "type": "action" | "chat" | "fallback",
  "actionId": "string required when type=action",
  "args": {"key":"value"},
  "response": "short speech response in ${targetLang}",
  "autoListen": boolean,
  "responseLanguage": "${language}",
  "reason": "optional fallback reason"
}

Rules:
- If user asks to change language, return type=action with actionId=switch_language and args.language set to one of: en|hi|mr|bh.
- If user asks to change theme/light/dark, return type=action with actionId=toggle_theme.
- If user asks to stop listening, return type=action with actionId=stop_listening and autoListen=false.
- If user speaks form details and visible form fields exist, return type=action with actionId=fill_form_fields and args like {"name":"Riya","phone":"98..."}.
- If user asks to save/submit/continue and a form context exists, return type=action with actionId=submit_form.
- If user asks health advice, return type=chat and include safe disclaimer briefly.
- For minor symptoms (e.g., stomach pain), provide cautious first-step guidance and suggest emergency if red flags are present.
- If command is ambiguous, return fallback.
- Never include markdown.

Transcript: ${JSON.stringify(transcript)}`;

    let result;
    try {
      result = await withGeminiModelFallback(genAI, async ({ model }) => model.generateContent(systemPrompt));
    } catch (modelError) {
      if (isGeminiTemporarilyDisabledError(modelError)) {
        return NextResponse.json(
          buildLocalFallback({
            transcript,
            language,
            role,
            pathname,
            visibleFormFields,
          })
        );
      }
      throw modelError;
    }
    const parsed = parseVoiceResult(result.response.text(), language);

    if (parsed) {
      return NextResponse.json(parsed);
    }

    return NextResponse.json({
      type: "fallback",
      response: getFallbackVoiceResponse(language),
      autoListen: false,
      responseLanguage: language,
      reason: "parse_failed",
    } satisfies VoiceIntentResult);
  } catch (error: unknown) {
    console.error("Voice intent API error:", error);
    return NextResponse.json(
      {
        type: "fallback",
        response: getFallbackVoiceResponse("en"),
        autoListen: false,
        responseLanguage: "en",
        reason: "server_error",
      } satisfies VoiceIntentResult,
      { status: 200 }
    );
  }
}
