/**
 * NoteGenius – Firebase Analytics & Crashlytics monitoring service.
 *
 * Centralises event logging, error reporting, and breadcrumb-style logs
 * via Firebase Analytics + Crashlytics.
 *
 * Setup:
 *  1. Create a Firebase project at https://console.firebase.google.com
 *  2. Download google-services.json (Android) / GoogleService-Info.plist (iOS)
 *     and place them in the project root.
 *  3. The Expo plugin handles native wiring automatically.
 *
 * Import:
 *   import { initAnalytics, captureAiError, logAiEvent } from '@/src/services/monitoring/analytics';
 */
import analytics from "@react-native-firebase/analytics";
import crashlytics from "@react-native-firebase/crashlytics";

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise Firebase Analytics & Crashlytics.
 * Call once at the very top of app/_layout.tsx.
 */
export async function initAnalytics(): Promise<void> {
  try {
    await analytics().setAnalyticsCollectionEnabled(!__DEV__);
    await crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);
  } catch {
    // Firebase not configured yet – silently continue.
  }
}

// ---------------------------------------------------------------------------
// User / scope helpers
// ---------------------------------------------------------------------------

/** Set the display name shown on every analytics event & crash report. */
export async function setAnalyticsUser(name: string): Promise<void> {
  try {
    await analytics().setUserId(name);
    await crashlytics().setUserId(name);
  } catch {
    // ignore
  }
}

/** Clear any previously stored user identity. */
export async function clearAnalyticsUser(): Promise<void> {
  try {
    await analytics().setUserId("");
    await crashlytics().setUserId("");
  } catch {
    // ignore
  }
}

/** Set the active AI provider as a global user property so it appears on every event. */
export async function setAiProviderTag(provider: string): Promise<void> {
  try {
    await analytics().setUserProperty("ai_provider", provider);
    await crashlytics().setAttribute("ai_provider", provider);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Event logging (breadcrumb replacements – visible in Analytics console)
// ---------------------------------------------------------------------------

/**
 * Log an AI-related event. These appear in the Firebase Analytics console
 * under Events, enabling you to see every AI operation that occurred.
 */
export async function logAiEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    await analytics().logEvent(`ai_${eventName}`, params);
    crashlytics().log(`[AI] ${eventName}: ${JSON.stringify(params ?? {})}`);
  } catch {
    // ignore
  }
}

/** Log an audio-related event. */
export async function logAudioEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    await analytics().logEvent(`audio_${eventName}`, params);
    crashlytics().log(`[Audio] ${eventName}: ${JSON.stringify(params ?? {})}`);
  } catch {
    // ignore
  }
}

/** Log a generic app event (navigation, settings, etc.). */
export async function logAppEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    await analytics().logEvent(`app_${eventName}`, params);
    crashlytics().log(`[App] ${eventName}: ${JSON.stringify(params ?? {})}`);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Breadcrumb-style log helpers (replaces Sentry breadcrumbs)
// These write to Crashlytics log so they appear in crash reports.
// ---------------------------------------------------------------------------

export function addAiBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  try {
    crashlytics().log(`[AI] ${message} ${data ? JSON.stringify(data) : ""}`);
    // Also fire an analytics event so it's visible in the dashboard
    analytics().logEvent("ai_breadcrumb", {
      message,
      ...(data
        ? Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)]),
          )
        : {}),
    });
  } catch {
    // ignore
  }
}

export function addAudioBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  try {
    crashlytics().log(`[Audio] ${message} ${data ? JSON.stringify(data) : ""}`);
  } catch {
    // ignore
  }
}

export function addAppBreadcrumb(
  message: string,
  data?: Record<string, unknown>,
): void {
  try {
    crashlytics().log(`[App] ${message} ${data ? JSON.stringify(data) : ""}`);
  } catch {
    // ignore
  }
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
 * Reports to both Crashlytics (for crash/error tracking) and Analytics
 * (for aggregate error dashboards).
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
  try {
    const err = toError(error);

    crashlytics().setAttribute("ai_provider", context.provider);
    crashlytics().setAttribute("ai_operation", context.operation);
    if (context.model) crashlytics().setAttribute("ai_model", context.model);
    if (context.httpStatus !== undefined) {
      crashlytics().setAttribute(
        "http_status_code",
        String(context.httpStatus),
      );
    }
    crashlytics().log(
      `[AI Error] ${context.provider}/${context.operation}: ${err.message}`,
    );
    crashlytics().recordError(err);

    // Also log to Analytics for aggregate error counts
    analytics().logEvent("ai_error", {
      provider: context.provider,
      operation: context.operation,
      model: context.model ?? "unknown",
      http_status: context.httpStatus ?? 0,
      transcript_length: context.transcriptLength ?? 0,
      error_message: err.message.slice(0, 100),
    });
  } catch {
    // ignore
  }
}

/** Capture an error that originated in the audio recording/playback layer. */
export function captureAudioError(error: unknown, operation: string): void {
  try {
    const err = toError(error);
    crashlytics().setAttribute("audio_operation", operation);
    crashlytics().log(`[Audio Error] ${operation}: ${err.message}`);
    crashlytics().recordError(err);

    analytics().logEvent("audio_error", {
      operation,
      error_message: err.message.slice(0, 100),
    });
  } catch {
    // ignore
  }
}

/** Capture any unclassified error with an optional extra-data map. */
export function captureError(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  try {
    const err = toError(error);
    if (extras) {
      for (const [k, v] of Object.entries(extras)) {
        crashlytics().setAttribute(k, String(v));
      }
    }
    crashlytics().log(`[Error] ${err.message}`);
    crashlytics().recordError(err);

    analytics().logEvent("app_error", {
      error_message: err.message.slice(0, 100),
      ...(extras
        ? Object.fromEntries(
            Object.entries(extras).map(([k, v]) => [k, String(v)]),
          )
        : {}),
    });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Performance tracing (replaces Sentry spans)
// ---------------------------------------------------------------------------

/**
 * Wrap an async AI operation with a Firebase Performance-style trace
 * using start/stop analytics events. Errors are re-thrown after capture.
 */
export async function traceAiOperation<T>(
  operationName: string,
  provider: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();

  try {
    crashlytics().log(
      `[AI Trace] ${provider}/${operationName} started`,
    );

    const result = await fn();
    const durationMs = Date.now() - startTime;

    analytics().logEvent("ai_operation_success", {
      provider,
      operation: operationName,
      duration_ms: durationMs,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    analytics().logEvent("ai_operation_failure", {
      provider,
      operation: operationName,
      duration_ms: durationMs,
      error_message: toError(error).message.slice(0, 100),
    });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : JSON.stringify(value));
}
