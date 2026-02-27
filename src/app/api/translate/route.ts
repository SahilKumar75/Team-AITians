import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isGeminiTemporarilyDisabledError, withGeminiModelFallback } from "@/lib/ai/gemini";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

type TranslateRequestBody = {
  texts?: unknown;
  targetLang?: unknown;
  sourceLang?: unknown;
  domain?: unknown;
  preservePlaceholders?: unknown;
};

const languageNames: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  bh: "Bhojpuri",
};

const fallbackErrors: Record<string, string> = {
  en: "Translation service is temporarily unavailable. Showing original text.",
  hi: "अनुवाद सेवा अभी उपलब्ध नहीं है। मूल पाठ दिखाया जा रहा है।",
  mr: "अनुवाद सेवा सध्या उपलब्ध नाही. मूळ मजकूर दाखवला जात आहे.",
  bh: "अनुवाद सेवा अभी उपलब्ध नइखे। मूल पाठ देखावल जात बा।",
};

const translationCache = new Map<string, string>();

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function cacheKey(targetLang: string, text: string): string {
  return `${targetLang}::${normalizeText(text)}`;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") return null;
    out.push(v);
  }
  return out;
}

function localizeErrorMessage(targetLang: string): string {
  return fallbackErrors[targetLang] || fallbackErrors.en;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateTranslationsWithRetry(args: {
  texts: string[];
  targetLang: string;
  sourceLang?: string;
  domain?: string;
  preservePlaceholders: boolean;
}): Promise<string[]> {
  if (!genAI) throw new Error("GEMINI_API_KEY not configured");

  const { texts, targetLang, sourceLang, domain, preservePlaceholders } = args;
  const targetLanguageName = languageNames[targetLang] || targetLang;
  const sourceLanguageName = sourceLang && languageNames[sourceLang] ? languageNames[sourceLang] : "auto-detect";
  const prompt = `You are a strict translation engine.
Translate each input string from ${sourceLanguageName} to ${targetLanguageName}.
Context domain: ${domain || "general_ui"}.
Rules:
1) Return exactly a raw JSON array of strings.
2) Preserve order and array length exactly.
3) Keep placeholders/tokens unchanged (${preservePlaceholders ? "required" : "optional"}), including patterns like __TOKEN_0__, {name}, %s, :id.
4) Do not add explanations, markdown, or comments.

Input:
${JSON.stringify(texts)}`;

  return withGeminiModelFallback(genAI, async ({ model }) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();
        if (responseText.startsWith("```json")) responseText = responseText.replace(/^```json/, "");
        if (responseText.startsWith("```")) responseText = responseText.replace(/^```/, "");
        if (responseText.endsWith("```")) responseText = responseText.replace(/```$/, "");
        responseText = responseText.trim();

        const parsed = JSON.parse(responseText);
        const translated = asStringArray(parsed);
        if (!translated) throw new Error("Model response is not a string array");
        if (translated.length !== texts.length) throw new Error("Translation length mismatch");
        return translated;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await sleep(250 * (attempt + 1));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Translation failed");
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateRequestBody;
    const texts = asStringArray(body.texts);
    const targetLang = typeof body.targetLang === "string" ? body.targetLang : "en";
    const sourceLang = typeof body.sourceLang === "string" ? body.sourceLang : undefined;
    const domain = typeof body.domain === "string" ? body.domain : undefined;
    const preservePlaceholders = body.preservePlaceholders !== false;

    if (!texts) {
      return NextResponse.json(
        {
          error: "Invalid request: texts must be a string array",
          translations: [],
          detectedSourceLang: sourceLang,
          cacheHits: 0,
        },
        { status: 400 }
      );
    }

    if (texts.length === 0) {
      return NextResponse.json({ translations: [], detectedSourceLang: sourceLang, cacheHits: 0 });
    }

    if (!targetLang || targetLang === "en") {
      return NextResponse.json({
        translations: texts,
        detectedSourceLang: sourceLang || "en",
        cacheHits: texts.length,
      });
    }

    const uniqueUncached = new Map<string, string>();
    let cacheHits = 0;
    let dynamicTranslationUnavailable = false;

    texts.forEach((text) => {
      const key = cacheKey(targetLang, text);
      if (translationCache.has(key)) {
        cacheHits += 1;
      } else if (!uniqueUncached.has(key)) {
        uniqueUncached.set(key, text);
      }
    });

    if (uniqueUncached.size > 0) {
      try {
        const uncachedTexts = Array.from(uniqueUncached.values());
        const translated = await generateTranslationsWithRetry({
          texts: uncachedTexts,
          targetLang,
          sourceLang,
          domain,
          preservePlaceholders,
        });
        uncachedTexts.forEach((text, idx) => {
          translationCache.set(cacheKey(targetLang, text), translated[idx]);
        });
      } catch (error) {
        dynamicTranslationUnavailable = true;
        if (!isGeminiTemporarilyDisabledError(error)) {
          console.error("Translation API fallback path:", error);
        }
        // Partial-failure-safe behavior: store original text for unresolved entries.
        uniqueUncached.forEach((text, key) => {
          translationCache.set(key, text);
        });
      }
    }

    const finalTranslations = texts.map((text) => {
      const resolved = translationCache.get(cacheKey(targetLang, text));
      return typeof resolved === "string" ? resolved : text;
    });

    return NextResponse.json({
      translations: finalTranslations,
      detectedSourceLang: sourceLang,
      cacheHits,
      warning: !genAI || dynamicTranslationUnavailable ? localizeErrorMessage(targetLang) : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to translate";
    return NextResponse.json({ error: message, translations: [], detectedSourceLang: undefined, cacheHits: 0 }, { status: 500 });
  }
}
