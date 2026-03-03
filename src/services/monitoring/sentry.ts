/**
 * NoteGenius – Sentry monitoring service.
 *
 * Centralises crash reporting, performance tracing, and breadcrumbs.
 *
 * Setup checklist:
 *  1. Create a free project at https://sentry.io
 *  2. Copy your DSN into .env:  EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
 *  3. (Optional) fill in org/project in app.json for source-map uploads.
 *
 * Import:
 *   import { initSentry, captureAiError, addAiBreadcrumb } from '@/src/services/monitoring/sentry';
 */
import * as Sentry from "@sentry/react-native";

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise Sentry.
 * Call once at the very top of app/_layout.tsx (module-level or before JSX).
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

  if (!dsn) {
    // No DSN configured – monitoring silently disabled.
    // Set EXPO_PUBLIC_SENTRY_DSN in your .env file to enable.
    return;
  }

  Sentry.init({
    dsn,
    // Free tier: 5 000 errors / month + 10 K perf transactions / month.
    tracesSampleRate: 1.0, // capture 100 % of perf transactions
    // Only enable in production unless the env var overrides it.
    enabled:
      !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_ENABLE_IN_DEV === "true",
    environment: __DEV__ ? "development" : "production",
    debug: false,
    // Attach a concise breadcrumb trail to every error report.
    maxBreadcrumbs: 50,
  });
}

// ---------------------------------------------------------------------------
// User / scope helpers
// ---------------------------------------------------------------------------

/** Set the display name shown on every Sentry event (no PII by default). */
export function setSentryUser(name: string): void {
  Sentry.setUser({ username: name });
}

/** Clear any previously stored user identity (e.g. on sign-out). */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/** Tag the active AI provider so every error/span includes it. */
export function setAiProviderTag(provider: string): void {
  Sentry.setTag("ai.provider", provider);
}

// ---------------------------------------------------------------------------
// Breadcrumb helpers
// ---------------------------------------------------------------------------

/**
 * Add an informational AI-category breadcrumb.
 * These appear in the "Breadcrumbs" section of every Sentry error report,
 * showing the sequence of AI operations that led up to the error.
 */
export function addAiBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category: "ai",
    message,
    data,
    level: "info",
  });
}

/** Add a breadcrumb for audio-related events. */
export function addAudioBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category: "audio",
    message,
    data,
    level: "info",
  });
}

/** Add a generic navigation/lifecycle breadcrumb. */
export function addAppBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category: "app",
    message,
    data,
    level: "info",
  });
}

// ---------------------------------------------------------------------------
// Error capture helpers
// ---------------------------------------------------------------------------

/** Operation types covered by AI error capture. */
export type AiOperation =
  | "summarize"
  | "generateFlashcards"
  | "generateTitle"
  | "callApi"
  | "validateKey"
  | "fallback";

/**
 * Capture an error that occurred inside an AI operation with rich context.
 * Attaches provider name, operation type, model, transcript length, and
 * HTTP status (if available) as searchable tags in Sentry.
 */
export function captureAiError(
  error: unknown,
  context: {
    provider: string;
    operation: AiOperation;
    transcriptLength?: number;
    model?: string;
    httpStatus?: number;
  },
): void {
  Sentry.withScope((scope) => {
    scope.setTag("ai.provider", context.provider);
    scope.setTag("ai.operation", context.operation);
    if (context.model) scope.setTag("ai.model", context.model);
    if (context.httpStatus !== undefined) {
      scope.setTag("http.status_code", String(context.httpStatus));
    }
    if (context.transcriptLength !== undefined) {
      scope.setExtra("transcript_length", context.transcriptLength);
    }
    Sentry.captureException(toError(error));
  });
}

/** Capture an error that originated in the audio recording/playback layer. */
export function captureAudioError(error: unknown, operation: string): void {
  Sentry.withScope((scope) => {
    scope.setTag("audio.operation", operation);
    Sentry.captureException(toError(error));
  });
}

/** Capture any unclassified error with an optional extra-data map. */
export function captureError(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  if (extras) {
    Sentry.withScope((scope) => {
      Object.entries(extras).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(toError(error));
    });
  } else {
    Sentry.captureException(toError(error));
  }
}

// ---------------------------------------------------------------------------
// Performance tracing
// ---------------------------------------------------------------------------

/**
 * Wrap an async AI operation with a Sentry performance span.
 * The span appears in the "Performance" tab of Sentry under the operation
 * name, showing latency for every call (summarise, flashcard gen, etc.).
 *
 * Errors are NOT silently swallowed – they are re-thrown after being captured,
 * so the call-site's existing error handling remains intact.
 *
 * @example
 *   const result = await traceAiOperation('summarize', 'gemini', () =>
 *     callGemini(apiKey, body, modelName)
 *   );
 */
export async function traceAiOperation<T>(
  operationName: string,
  provider: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `ai.${operationName}`,
      op: "ai",
      attributes: { "ai.provider": provider, "ai.operation": operationName },
    },
    () => fn(),
  );
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : JSON.stringify(value));
}

// Re-export the raw Sentry namespace for one-off advanced usage.
export { Sentry };
