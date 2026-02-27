import { GoogleGenerativeAI } from "@google/generative-ai";

export type GeminiModelTask<T> = (args: { modelName: string; model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> }) => Promise<T>;

const DEFAULT_MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
];
const GEMINI_BLOCK_TTL_MS = 30 * 60 * 1000;
let geminiBlockedUntil = 0;
let geminiBlockReason = "";

function getConfiguredModelCandidates(): string[] {
  const configured = process.env.GEMINI_MODEL_CANDIDATES;
  if (!configured) return DEFAULT_MODEL_CANDIDATES;
  const parsed = configured
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_MODEL_CANDIDATES;
}

function getEffectiveModelCandidates(): string[] {
  const preferred = (process.env.GEMINI_MODEL || "").trim();
  const list = getConfiguredModelCandidates();
  if (!preferred) return list;
  return [preferred, ...list.filter((m) => m !== preferred)];
}

function isModelNotFoundError(error: unknown): boolean {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : undefined;
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return (
    status === 404 ||
    message.includes("is not found for API version") ||
    message.includes("not supported for generateContent")
  );
}

function isAuthBlockedError(error: unknown): boolean {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : undefined;
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const lower = message.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    lower.includes("api key was reported as leaked") ||
    lower.includes("api key not valid") ||
    lower.includes("permission denied")
  );
}

function isRateLimitError(error: unknown): boolean {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : undefined;
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const lower = message.toLowerCase();
  return (
    status === 429 ||
    lower.includes("too many requests") ||
    lower.includes("quota exceeded") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("retry in")
  );
}

function getRateLimitBackoffMs(error: unknown): number {
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const retryInfoMatch = message.match(/retryDelay":"(\d+)s"/i);
  const retryInMatch = message.match(/retry in\s+([\d.]+)s/i);
  const retrySeconds =
    (retryInfoMatch && Number.parseInt(retryInfoMatch[1], 10)) ||
    (retryInMatch && Math.ceil(Number.parseFloat(retryInMatch[1]))) ||
    45;
  return Math.max(15_000, retrySeconds * 1000);
}

export function isGeminiTemporarilyDisabledError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return message.startsWith("GEMINI_DISABLED:");
}

export async function withGeminiModelFallback<T>(
  genAI: GoogleGenerativeAI | null,
  task: GeminiModelTask<T>
): Promise<T> {
  if (!genAI) throw new Error("GEMINI_API_KEY not configured");
  if (Date.now() < geminiBlockedUntil) {
    throw new Error(`GEMINI_DISABLED:${geminiBlockReason || "temporarily_unavailable"}`);
  }

  const candidates = getEffectiveModelCandidates();
  let lastError: unknown = null;

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await task({ modelName, model });
    } catch (error) {
      lastError = error;
      if (isModelNotFoundError(error)) continue;
      if (isAuthBlockedError(error)) {
        geminiBlockedUntil = Date.now() + GEMINI_BLOCK_TTL_MS;
        geminiBlockReason = "api_key_blocked";
        throw new Error(`GEMINI_DISABLED:${geminiBlockReason}`);
      }
      if (isRateLimitError(error)) {
        geminiBlockedUntil = Date.now() + getRateLimitBackoffMs(error);
        geminiBlockReason = "quota_limited";
        throw new Error(`GEMINI_DISABLED:${geminiBlockReason}`);
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No supported Gemini model available");
}
