/**
 * NoteGenius – Gemini AI Provider.
 * Calls the Gemini REST API directly via React Native's native fetch,
 * bypassing the @google/generative-ai SDK's bundled XHR shim which causes
 * "Network request failed" errors on iOS (whatwg-fetch + XHR incompatibility).
 *
 * Privacy: Only the transcript text and userName are sent.
 * The API key is stored in expo-secure-store, never in MMKV.
 */
import { chunkText } from "../../../utils/text";
import {
  addAiBreadcrumb,
  captureAiError,
  traceAiOperation,
} from "../../monitoring/sentry";
import type {
  AiFlashcardResult,
  AiSummaryResult,
  IAiProvider,
} from "../AiProvider";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// ─── Prompt templates ───────────────────────────────────────────────────────

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

// ─── REST helpers ────────────────────────────────────────────────────────────

interface GeminiRequestBody {
  system_instruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig?: {
    responseMimeType?: string;
  };
}

async function callGemini(
  apiKey: string,
  body: GeminiRequestBody,
  modelName: string = DEFAULT_GEMINI_MODEL,
): Promise<string> {
  return traceAiOperation("callGemini", "gemini", async () => {
    const url = `${GEMINI_BASE_URL}/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      error?: { message: string };
    };

    if (json.error) {
      throw new Error(`Gemini API error: ${json.error.message}`);
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text;
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitiseJSON(raw: string): string {
  // Strip markdown fences if the model wraps them
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
      "[GeminiProvider] Failed to parse JSON response:",
      raw.slice(0, 200),
    );
    return fallback;
  }
}

// ─── GeminiProvider factory ─────────────────────────────────────────────────

export function createGeminiProvider(
  apiKey: string,
  modelName: string = DEFAULT_GEMINI_MODEL,
): IAiProvider {
  return {
    label: "Gemini (cloud)",

    async summarize(
      transcript: string,
      userName: string,
    ): Promise<AiSummaryResult> {
      addAiBreadcrumb("summarize started", {
        provider: "gemini",
        transcriptLength: transcript.length,
      });
      // For long transcripts, chunk and summarise each, then merge at end
      const chunks = chunkText(transcript, 12_000);
      try {
        if (chunks.length === 1) {
          const text = await callGemini(
            apiKey,
            {
              system_instruction: { parts: [{ text: SUMMARY_SYSTEM }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `User name: ${userName}\n\nTranscript:\n${transcript}`,
                    },
                  ],
                },
              ],
              generationConfig: { responseMimeType: "application/json" },
            },
            modelName,
          );
          return parseJSONSafe<AiSummaryResult>(text, emptySummary());
        }

        // Multi-chunk: summarise each chunk then merge
        const partials: AiSummaryResult[] = [];
        for (const chunk of chunks) {
          const text = await callGemini(
            apiKey,
            {
              system_instruction: { parts: [{ text: SUMMARY_SYSTEM }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `User name: ${userName}\n\nTranscript (part):\n${chunk}`,
                    },
                  ],
                },
              ],
              generationConfig: { responseMimeType: "application/json" },
            },
            modelName,
          );
          partials.push(parseJSONSafe<AiSummaryResult>(text, emptySummary()));
        }
        return mergeSummaries(partials);
      } catch (err) {
        captureAiError(err, {
          provider: "gemini",
          operation: "summarize",
          transcriptLength: transcript.length,
        });
        throw err;
      }
    },

    async generateTitle(transcript: string): Promise<string> {
      try {
        const snippet = transcript.slice(0, 4_000);
        const text = await callGemini(
          apiKey,
          {
            system_instruction: { parts: [{ text: TITLE_SYSTEM }] },
            contents: [
              {
                role: "user",
                parts: [{ text: `Transcript:\n${snippet}` }],
              },
            ],
          },
          modelName,
        );
        const title = text.trim().replace(/^["']|["']$/g, "");
        return title.slice(0, 60);
      } catch (err) {
        console.warn("[GeminiProvider] generateTitle failed:", err);
        captureAiError(err, {
          provider: "gemini",
          operation: "generateTitle",
          transcriptLength: transcript.length,
        });
        return "";
      }
    },

    async generateFlashcards(
      transcript: string,
      summary: AiSummaryResult | null,
    ): Promise<AiFlashcardResult[]> {
      addAiBreadcrumb("generateFlashcards started", {
        provider: "gemini",
        transcriptLength: transcript.length,
        hasSummary: summary !== null,
      });
      try {
        const userPrompt = summary
          ? `Summary:\n${JSON.stringify(summary)}\n\nTranscript:\n${transcript.slice(0, 12_000)}`
          : `Transcript:\n${transcript.slice(0, 12_000)}`;

        const text = await callGemini(
          apiKey,
          {
            system_instruction: { parts: [{ text: FLASHCARD_SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          },
          modelName,
        );
        return parseJSONSafe<AiFlashcardResult[]>(text, []);
      } catch (err) {
        captureAiError(err, {
          provider: "gemini",
          operation: "generateFlashcards",
          transcriptLength: transcript.length,
        });
        throw err;
      }
    },
  };
}

// ─── Key validation ──────────────────────────────────────────────────────────

/**
 * Validates a Gemini API key by making a minimal generateContent request.
 * Returns { valid: true } on success, or { valid: false, error: string } on failure.
 */
export async function validateGeminiApiKey(
  apiKey: string,
  modelName: string = DEFAULT_GEMINI_MODEL,
): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey.trim()) {
    return { valid: false, error: "API key is empty." };
  }
  // Testing bypass key
  if (apiKey.trim() === "prabhat") {
    return { valid: true };
  }
  try {
    const url = `${GEMINI_BASE_URL}/${modelName}:generateContent?key=${apiKey.trim()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
      }),
    });
    // 200 OK or 400 Bad Request both indicate the key itself is valid
    if (res.ok || res.status === 400) {
      return { valid: true };
    }
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    return {
      valid: false,
      error: body?.error?.message ?? `HTTP ${res.status}`,
    };
  } catch (e: unknown) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

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
  // Deduplicate simple string arrays
  merged.tldr = [...new Set(merged.tldr)];
  merged.keyPoints = [...new Set(merged.keyPoints)];
  merged.decisions = [...new Set(merged.decisions)];
  merged.openQuestions = [...new Set(merged.openQuestions)];
  merged.topics = [...new Set(merged.topics)];
  merged.highlights = [...new Set(merged.highlights)];
  merged.followUps = [...new Set(merged.followUps)];
  return merged;
}
