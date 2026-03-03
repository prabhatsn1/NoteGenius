/**
 * NoteGenius – Hugging Face AI Provider.
 * Calls the Hugging Face Inference API (Messages / chat-completions endpoint)
 * using native fetch – no SDK required.
 *
 * Primary model  : mistralai/Mistral-7B-Instruct-v0.2
 * Fallback model : meta-llama/Meta-Llama-3-8B-Instruct
 *   → The fallback is used automatically when the primary model returns a
 *     429 (rate-limit / quota exceeded) response.
 *
 * Privacy: Only the transcript text and userName are sent.
 * The API key is stored in expo-secure-store, never in MMKV.
 */
import { chunkText } from "../../../utils/text";
import type {
  AiFlashcardResult,
  AiSummaryResult,
  IAiProvider,
} from "../AiProvider";

// ─── Model IDs ───────────────────────────────────────────────────────────────

export const HF_PRIMARY_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";
export const HF_FALLBACK_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

// ─── Prompt templates ────────────────────────────────────────────────────────

const SUMMARY_SYSTEM = `You are a meeting-notes assistant. Given a transcript, return a JSON object with EXACTLY these keys:
  tldr (string[]), keyPoints (string[]), decisions (string[]),
  actionItems ({ owner: string, task: string, due?: string }[]),
  openQuestions (string[]), topics (string[]), highlights (string[]),
  followUps (string[]).
Attribute unknown action items to the user name provided.
Return ONLY valid JSON – no markdown fences, no extra text.`;

const FLASHCARD_SYSTEM = `You are an educational flashcard generator. Given a transcript and optional summary JSON, produce an array of flashcard objects, each with:
  type ("qa" | "cloze" | "term-def" | "def-term"),
  front (string), back (string), tags (string[]).
Return ONLY a valid JSON array – no markdown fences, no extra text. Generate 10-20 cards.`;

const TITLE_SYSTEM = `You are a note-titling assistant. Given a transcript, generate a concise and meaningful title for the note in 5 words or fewer. Return ONLY the title text – no quotes, no trailing punctuation, no extra text.`;

// ─── Request / Response types ────────────────────────────────────────────────

interface HFMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HFRequestBody {
  model: string;
  messages: HFMessage[];
  max_tokens?: number;
  temperature?: number;
  stream: false;
}

// ─── REST helper ─────────────────────────────────────────────────────────────

/** Status codes that should trigger a fallback to the secondary model. */
const RATE_LIMIT_STATUSES = new Set([429, 503]);

async function callHF(
  apiKey: string,
  messages: HFMessage[],
  maxTokens: number = 2048,
  modelName: string = HF_PRIMARY_MODEL,
): Promise<string> {
  const body: HFRequestBody = {
    model: modelName,
    messages,
    max_tokens: maxTokens,
    temperature: 0.2,
    stream: false,
  };

  const response = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (RATE_LIMIT_STATUSES.has(response.status)) {
      // Signal caller to try fallback
      throw new HFRateLimitError(
        `HuggingFace rate limit on model ${modelName}: HTTP ${response.status}`,
        response.status,
      );
    }
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`HuggingFace API error ${response.status}: ${errorText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: string;
  };

  if (json.error) {
    throw new Error(`HuggingFace API error: ${json.error}`);
  }

  return json.choices?.[0]?.message?.content ?? "";
}

/** Sentinel error class to distinguish rate-limit failures from other errors. */
class HFRateLimitError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HFRateLimitError";
  }
}

/**
 * Calls HF with automatic fallback:
 *   1. Try primary model (Mistral-7B-Instruct-v0.2)
 *   2. On 429/503 → retry with fallback model (Llama-3-8B-Instruct)
 *   3. If fallback also rate-limits → re-throw with clear message
 */
async function callHFWithFallback(
  apiKey: string,
  messages: HFMessage[],
  maxTokens: number = 2048,
): Promise<string> {
  try {
    return await callHF(apiKey, messages, maxTokens, HF_PRIMARY_MODEL);
  } catch (err) {
    if (err instanceof HFRateLimitError) {
      console.warn(
        `[HuggingFaceProvider] Primary model rate-limited (${err.status}). ` +
          `Falling back to ${HF_FALLBACK_MODEL}…`,
      );
      try {
        return await callHF(apiKey, messages, maxTokens, HF_FALLBACK_MODEL);
      } catch (fallbackErr) {
        if (fallbackErr instanceof HFRateLimitError) {
          throw new Error(
            "Both Hugging Face models are currently rate-limited. " +
              "Please wait a moment and try again.",
          );
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitiseJSON(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return cleaned.trim();
}

function parseJSONSafe<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(sanitiseJSON(raw)) as T;
  } catch {
    console.warn(
      "[HuggingFaceProvider] Failed to parse JSON response:",
      raw.slice(0, 200),
    );
    return fallback;
  }
}

function emptySummary(): AiSummaryResult {
  return {
    tldr: [],
    keyPoints: [],
    decisions: [],
    actionItems: [],
    openQuestions: [],
    topics: [],
    highlights: [],
    followUps: [],
  };
}

function mergeSummaries(parts: AiSummaryResult[]): AiSummaryResult {
  const merged = emptySummary();
  for (const p of parts) {
    merged.tldr.push(...(p.tldr ?? []));
    merged.keyPoints.push(...(p.keyPoints ?? []));
    merged.decisions.push(...(p.decisions ?? []));
    merged.actionItems.push(...(p.actionItems ?? []));
    merged.openQuestions.push(...(p.openQuestions ?? []));
    merged.topics.push(...(p.topics ?? []));
    merged.highlights.push(...(p.highlights ?? []));
    merged.followUps.push(...(p.followUps ?? []));
  }
  merged.tldr = [...new Set(merged.tldr)];
  merged.keyPoints = [...new Set(merged.keyPoints)];
  merged.decisions = [...new Set(merged.decisions)];
  merged.openQuestions = [...new Set(merged.openQuestions)];
  merged.topics = [...new Set(merged.topics)];
  merged.highlights = [...new Set(merged.highlights)];
  merged.followUps = [...new Set(merged.followUps)];
  return merged;
}

// ─── HuggingFaceProvider factory ──────────────────────────────────────────────

export function createHuggingFaceProvider(apiKey: string): IAiProvider {
  return {
    label: "Hugging Face (cloud)",

    async summarize(
      transcript: string,
      userName: string,
    ): Promise<AiSummaryResult> {
      const chunks = chunkText(transcript, 8_000);

      if (chunks.length === 1) {
        const text = await callHFWithFallback(apiKey, [
          { role: "system", content: SUMMARY_SYSTEM },
          {
            role: "user",
            content: `User name: ${userName}\n\nTranscript:\n${transcript}`,
          },
        ]);
        return parseJSONSafe<AiSummaryResult>(text, emptySummary());
      }

      const partials: AiSummaryResult[] = [];
      for (const chunk of chunks) {
        const text = await callHFWithFallback(apiKey, [
          { role: "system", content: SUMMARY_SYSTEM },
          {
            role: "user",
            content: `User name: ${userName}\n\nTranscript (part):\n${chunk}`,
          },
        ]);
        partials.push(parseJSONSafe<AiSummaryResult>(text, emptySummary()));
      }
      return mergeSummaries(partials);
    },

    async generateTitle(transcript: string): Promise<string> {
      try {
        const snippet = transcript.slice(0, 3_000);
        const text = await callHFWithFallback(
          apiKey,
          [
            { role: "system", content: TITLE_SYSTEM },
            { role: "user", content: `Transcript:\n${snippet}` },
          ],
          64,
        );
        const title = text.trim().replace(/^["']|["']$/g, "");
        return title.slice(0, 60);
      } catch (err) {
        console.warn("[HuggingFaceProvider] generateTitle failed:", err);
        return "";
      }
    },

    async generateFlashcards(
      transcript: string,
      summary: AiSummaryResult | null,
    ): Promise<AiFlashcardResult[]> {
      const userPrompt = summary
        ? `Summary:\n${JSON.stringify(summary)}\n\nTranscript:\n${transcript.slice(0, 8_000)}`
        : `Transcript:\n${transcript.slice(0, 8_000)}`;

      const text = await callHFWithFallback(apiKey, [
        { role: "system", content: FLASHCARD_SYSTEM },
        { role: "user", content: userPrompt },
      ]);
      return parseJSONSafe<AiFlashcardResult[]>(text, []);
    },
  };
}

// ─── Key validation ───────────────────────────────────────────────────────────

/**
 * Validates a Hugging Face API token by sending a minimal chat request
 * to the primary model.
 * Returns { valid: true } on success, or { valid: false, error: string }.
 *
 * Note: A 429 response still confirms the key is valid (just rate-limited).
 */
export async function validateHuggingFaceApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey.trim()) {
    return { valid: false, error: "API token is empty." };
  }
  try {
    const res = await fetch(HF_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: HF_PRIMARY_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });

    // 200 OK → valid and responded
    // 429 → valid key, just rate-limited
    if (res.ok || res.status === 429) {
      return { valid: true };
    }

    // 401 / 403 → invalid or revoked token
    if (res.status === 401 || res.status === 403) {
      return {
        valid: false,
        error:
          "Invalid or revoked API token. Please check your Hugging Face token.",
      };
    }

    // 503 → model still loading, but key accepted
    if (res.status === 503) {
      return { valid: true };
    }

    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      valid: false,
      error: body?.error ?? `HTTP ${res.status}`,
    };
  } catch (e: unknown) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}
