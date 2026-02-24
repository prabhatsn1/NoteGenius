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
      // For long transcripts, chunk and summarise each, then merge at end
      const chunks = chunkText(transcript, 12_000);

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
    },

    async generateFlashcards(
      transcript: string,
      summary: AiSummaryResult | null,
    ): Promise<AiFlashcardResult[]> {
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
    },
  };
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
