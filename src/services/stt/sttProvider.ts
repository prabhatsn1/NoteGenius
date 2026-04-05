/**
 * NoteGenius – Speech-to-Text provider interface.
 * Uses react-native-speech-recognition-kit for live on-device transcription.
 * Recognition starts immediately when recording begins and streams partial and
 * final results in real-time via native OS speech APIs.
 *
 * ANDROID NOTE: On Android, this uses the SpeechRecognizer API which requires
 * Google app or another speech recognition service to be installed.
 */
import { NativeModules, Platform } from "react-native";
import {
  addEventListener,
  destroy as destroyRecognizer,
  speechRecogntionEvents,
  startListening,
  stopListening,
} from "react-native-speech-recognition-kit";
import { PcmAudioCapture } from "../audio/recorder";
// NOTE: setRecognitionLanguage / isRecognitionAvailable are declared in the JS
// wrapper but NOT implemented in the native layer – calling them crashes.
// The iOS recogniser always uses [NSLocale currentLocale]; locale is tracked
// only on the JS side for segment metadata.

// Check if native module is available
const { SpeechRecognition } = NativeModules;
const isNativeModuleAvailable = SpeechRecognition != null;

/** Returns whether live speech-to-text is available on this device/build. */
export function isSTTAvailable(): boolean {
  return isNativeModuleAvailable;
}

// ─── Provider Interface ──────────────────────────────────────────────────────
export interface STTProvider {
  /**
   * Start live speech recognition for the given BCP-47 locale.
   * Partial results are delivered via onResult(text, false) as the user speaks;
   * final results via onResult(text, true) when an utterance completes.
   */
  start(locale: string): Promise<void>;
  /**
   * Stop the recognition session and wait until it fully winds down.
   * The audioUri parameter is accepted for interface compatibility but ignored –
   * transcription happens live and does not require a file.
   */
  stop(audioUri?: string): Promise<void>;
  /** Abandon the session immediately without emitting any further results. */
  cancel(): Promise<void>;
  onResult: ((text: string, isFinal: boolean) => void) | null;
  onError: ((error: string) => void) | null;
  /** Called after the recognition session ends (normally or via cancel). */
  onSessionEnd: (() => void) | null;
  /** Android only: fired when the WAV file has been written after stop(). */
  onAudioSaved: ((uri: string, durationMs: number) => void) | null;
  isAvailable(): Promise<boolean>;
}

// ─── Speech Recognition Kit STT Provider ────────────────────────────────────
class SpeechRecognitionKitSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onSessionEnd: (() => void) | null = null;
  onAudioSaved: ((uri: string, durationMs: number) => void) | null = null;

  private subscriptions: ReturnType<typeof addEventListener>[] = [];
  /** Set to true once stop() has been called so we know to end on next RESULTS. */
  private isStopping = false;
  /** Guards against _endSession() being invoked more than once per session. */
  private sessionEnded = false;
  /** Resolves the Promise returned by stop(). */
  private stopResolve: (() => void) | null = null;
  /** Last partial text received – flushed as final if no RESULTS event fires. */
  private lastPartialText: string = "";
  /** Locale saved so we can restart recognition after error 7. */
  private currentLocale: string = "en-US";
  /** Prevents overlapping error-7 restart attempts. */
  private isRestarting = false;

  async start(_locale: string): Promise<void> {
    console.log("=== [STT] START METHOD CALLED ===");
    console.log("[STT] start called with locale:", _locale);
    console.log("[STT] Platform:", Platform.OS);
    console.log("[STT] Native module available:", isNativeModuleAvailable);
    console.log("[STT] SpeechRecognition module:", SpeechRecognition);
    console.log("[STT] NativeModules:", Object.keys(NativeModules));

    // Check if native module is available
    if (!isNativeModuleAvailable) {
      const error =
        Platform.OS === "android"
          ? "Speech recognition native module not initialized. Please rebuild the app with 'npx expo prebuild --clean' and 'npx expo run:android'."
          : "Speech recognition native module not initialized. Please rebuild the app with 'npx expo prebuild' and 'npx expo run:ios' or 'npx expo run:android'.";
      console.error("[SpeechRecognitionKit]", error);
      this.onError?.(error);
      return;
    }

    console.log("[STT] Native module IS available, proceeding...");

    this.currentLocale = _locale;
    this.isStopping = false;
    this.sessionEnded = false;
    this.isRestarting = false;
    this.stopResolve = null;
    this.lastPartialText = "";
    this._removeListeners();
    if (Platform.OS === "android") PcmAudioCapture.reset();
    console.log("[STT] Setting up event listeners");

    // Set up listeners BEFORE starting recognition to ensure we catch all events

    // Partial results → stream live text to the UI.
    console.log("[STT] Adding PARTIAL_RESULTS listener");
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.PARTIAL_RESULTS, (event) => {
        console.log("[STT] *** PARTIAL_RESULTS EVENT FIRED ***", event);
        const text = this._extractText(event);
        console.log("[STT] PARTIAL_RESULTS extracted text:", text);
        if (text) {
          this.lastPartialText = text;
          console.log("[STT] Calling onResult with partial text:", text);
          this.onResult?.(text, false);
        }
      }),
    );
    console.log(
      "[STT] PARTIAL_RESULTS listener added, subscription count:",
      this.subscriptions.length,
    );

    // Final results → only commit as final when stop() has been called.
    // While still recording, treat RESULTS as a partial so the text stays
    // in the live transcript and is not prematurely committed as a segment.
    console.log("[STT] Adding RESULTS listener");
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.RESULTS, (event) => {
        console.log("[STT] *** RESULTS EVENT FIRED ***", event);
        const text = this._extractText(event);
        console.log(
          "[STT] RESULTS extracted text:",
          text,
          "isStopping:",
          this.isStopping,
        );
        if (text) {
          if (this.isStopping) {
            this.lastPartialText = "";
            console.log("[STT] Calling onResult with final text:", text);
            this.onResult?.(text, true);
            this._endSession();
          } else {
            // Keep accumulating as partial until stop() is called.
            this.lastPartialText = text;
            console.log("[STT] Calling onResult as partial (not stopping):", text);
            this.onResult?.(text, false);
          }
        } else if (this.isStopping) {
          this._endSession();
        }
      }),
    );
    console.log(
      "[STT] RESULTS listener added, subscription count:",
      this.subscriptions.length,
    );

    // START event - confirms recognition has begun
    console.log("[STT] Adding START listener");
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.START, () => {
        console.log(
          "[STT] *** START EVENT FIRED - recognition session started ***",
        );
      }),
    );
    console.log(
      "[STT] START listener added, subscription count:",
      this.subscriptions.length,
    );

    // AUDIO_BUFFER: accumulate raw PCM chunks on Android for WAV assembly.
    if (Platform.OS === "android") {
      this.subscriptions.push(
        addEventListener(speechRecogntionEvents.AUDIO_BUFFER, (event: any) => {
          const chunk: string | undefined = event?.buffer;
          if (chunk) PcmAudioCapture.addChunk(chunk);
        }),
      );
    }

    // Error → report and close the session.
    // Native emits { message: string, code?: number } for all error events.
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.ERROR, (event) => {
        const code: number | undefined =
          event?.code ?? event?.nativeEvent?.code;
        const rawMsg: string =
          event?.message ?? event?.error ?? JSON.stringify(event) ?? "";

        console.log("[STT] ERROR event:", { code, rawMsg, event });

        // Error 7: silence timeout. Error 5: client/busy after END.
        // Both mean the recognizer stopped on its own — restart it.
        if (code === 7 || code === 5 || rawMsg.includes("No speech match") || rawMsg.includes("Client error")) {
          this._restartListening();
          return;
        }

        // Error 216: Audio device reconfiguration (iOS Simulator)
        if (code === 216 || rawMsg.includes("error 216")) {
          console.log("[STT] Error 216 - audio device reconfiguration");
          this._endSession();
          return;
        }

        // Error 11: RECOGNIZER_BUSY – transient during restart, ignore
        if (code === 11) {
          console.log("[STT] Error 11 – recognizer busy, ignoring");
          return;
        }

        // Android-specific: Error 9 means insufficient permissions
        if (Platform.OS === "android" && code === 9) {
          const msg =
            "Microphone permission denied. Please grant microphone permission in Settings.";
          console.error(
            "[SpeechRecognitionKit] Android permission error:",
            msg,
          );
          this.onError?.(msg);
          this._endSession();
          return;
        }

        // Android-specific: Error 2 means network error (for cloud-based recognition)
        if (Platform.OS === "android" && code === 2) {
          console.warn(
            "[STT] Android network error - may need internet for speech recognition",
          );
          // Don't end session, just log warning
          return;
        }

        const msg = rawMsg || "Unknown STT error";
        console.error("[SpeechRecognitionKit] error:", msg, event);
        this.onError?.(msg);
        this._endSession();
      }),
    );

    // END fires after RESULTS (or alone if no speech was detected).
    // On Android, END is always followed by either RESULTS or ERROR — let those
    // handlers decide what to do. Only end the session if stop() was called.
    console.log("[STT] Adding END listener");
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.END, () => {
        console.log(
          "[STT] *** END EVENT FIRED ***, isStopping:",
          this.isStopping,
        );
        if (this.isStopping) {
          this._endSession();
        }
      }),
    );
    console.log(
      "[STT] END listener added, subscription count:",
      this.subscriptions.length,
    );
    console.log(
      "[STT] All event listeners registered. Total subscriptions:",
      this.subscriptions.length,
    );

    try {
      console.log("[STT] ===== ABOUT TO CALL startListening() =====");
      console.log("[STT] startListening function type:", typeof startListening);
      console.log("[STT] startListening function:", startListening);
      console.log("[STT] speechRecogntionEvents:", speechRecogntionEvents);

      // Add a small delay to ensure listeners are fully registered
      // This is especially important on Android
      const delay = Platform.OS === "android" ? 600 : 100;
      console.log(`[STT] Waiting ${delay}ms before starting recognition...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log("[STT] Delay complete, now calling startListening()...");
      const { startListening: sl } = require("react-native-speech-recognition-kit");

      // On Android the native SpeechRecognizer may not be ready immediately
      // after a destroy() call (e.g. after pause). Retry up to 3 times.
      const maxAttempts = Platform.OS === "android" ? 3 : 1;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (this.isStopping) return;
        try {
          if (attempt > 1) {
            console.log(`[STT] Retry attempt ${attempt} after 500ms...`);
            await new Promise((r) => setTimeout(r, 500));
          }
          await sl();
          console.log("[STT] startListening() succeeded on attempt", attempt);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          console.warn(`[STT] startListening() attempt ${attempt} failed:`, err);
        }
      }

      if (lastErr) throw lastErr;
    } catch (err) {
      console.error("[STT] ===== EXCEPTION IN startListening() =====");
      console.error("[STT] Exception type:", err?.constructor?.name);
      console.error("[STT] Full exception:", err);

      const error =
        Platform.OS === "android"
          ? "Speech recognition failed to start on Android. Make sure Google app is installed and microphone permission is granted. Try rebuilding with 'npx expo prebuild --clean' and 'npx expo run:android'."
          : "Speech recognition failed to start. Please rebuild the app with 'npx expo prebuild' and 'npx expo run:ios' or 'npx expo run:android'.";
      console.error("[SpeechRecognitionKit] Error message:", error);
      this.onError?.(error);
      this._endSession();
    }
  }

  async stop(_audioUri?: string): Promise<void> {
    console.log("[STT] stop() called, sessionEnded:", this.sessionEnded);
    // If the native session already ended on its own (e.g. silence timeout),
    // resolve immediately – there is nothing left to stop.
    if (this.sessionEnded) return;

    this.isStopping = true;
    console.log(
      "[STT] Set isStopping=true, lastPartialText:",
      this.lastPartialText,
    );

    if (Platform.OS === "android" && PcmAudioCapture.hasData()) {
      PcmAudioCapture.save()
        .then((result) => { if (result) this.onAudioSaved?.(result.uri, result.durationMs); })
        .catch(() => {});
    }

    return new Promise<void>((resolve) => {
      this.stopResolve = resolve;
      // Safety timeout: if END/RESULTS never fires (e.g. audio session conflict),
      // flush any partial text and resolve after 1.5s so handleStop never hangs.
      const timeout = setTimeout(() => {
        console.log("[STT] stop() timeout – forcing _endSession");
        this._endSession();
      }, 1500);
      const originalResolve = resolve;
      this.stopResolve = () => {
        clearTimeout(timeout);
        originalResolve();
      };
      try {
        if (isNativeModuleAvailable) {
          console.log("[STT] Calling stopListening()");
          const { stopListening: sl } = require("react-native-speech-recognition-kit");
          Promise.resolve(sl()).catch(() => this._endSession());
        } else {
          this._endSession();
        }
      } catch {
        this._endSession();
      }
    });
  }

  async cancel(): Promise<void> {
    this._removeListeners();
    if (isNativeModuleAvailable) {
      try {
        await Promise.resolve(destroyRecognizer()).catch(() => {});
      } catch {}
    }
    this._endSession();
  }

  async isAvailable(): Promise<boolean> {
    // isRecognitionAvailable is not implemented natively – return true so the
    // UI can always attempt recognition (the native layer will emit an error if
    // speech permissions are denied).
    return isNativeModuleAvailable;
  }

  async destroy(): Promise<void> {
    this._removeListeners();
    if (isNativeModuleAvailable) {
      try {
        await Promise.resolve(destroyRecognizer()).catch(() => {});
      } catch {}
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _extractText(event: any): string {
    // The native events emit { value: string } – a plain string, not an array.
    if (typeof event?.value === "string") return event.value;
    if (Array.isArray(event?.value)) return (event.value[0] as string) ?? "";
    return "";
  }

  private _endSession(): void {
    if (this.sessionEnded) return;
    this.sessionEnded = true;
    console.log(
      "[STT] _endSession called, isStopping:",
      this.isStopping,
      "lastPartialText:",
      this.lastPartialText,
    );
    this._removeListeners();
    // If stop() was called but the native layer never fired a final RESULTS
    // event (e.g. it emitted END or an error 216 instead), flush the last
    // partial text as a final committed result so the segment is not lost.
    if (this.isStopping && this.lastPartialText.trim()) {
      console.log(
        "[STT] Flushing last partial as final:",
        this.lastPartialText,
      );
      this.onResult?.(this.lastPartialText.trim(), true);
      this.lastPartialText = "";
    }
    this.onSessionEnd?.();
    this.stopResolve?.();
    this.stopResolve = null;
  }

  private _restartListening(): void {
    if (this.isStopping || this.isRestarting) return;
    this.isRestarting = true;
    const { startListening: sl } = require("react-native-speech-recognition-kit");
    // 300ms gives the native recognizer enough time to fully release.
    setTimeout(() => {
      if (this.isStopping) { this.isRestarting = false; return; }
      Promise.resolve(sl())
        .then(() => { this.isRestarting = false; })
        .catch(() => { this.isRestarting = false; });
    }, 300);
  }

  private _removeListeners(): void {
    for (const sub of this.subscriptions) {
      sub?.remove?.();
    }
    this.subscriptions = [];
  }
}

// ─── Offline stub (kept for the factory fallback) ────────────────────────────
class OfflineSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onSessionEnd: (() => void) | null = null;
  onAudioSaved: ((uri: string, durationMs: number) => void) | null = null;

  async start(_locale: string): Promise<void> {
    this.onError?.("Offline STT not yet implemented.");
  }
  async stop(_audioUri?: string): Promise<void> {}
  async cancel(): Promise<void> {}
  async isAvailable(): Promise<boolean> {
    return false;
  }
}

// ─── Singleton Factory ───────────────────────────────────────────────────────
let provider: STTProvider | null = null;

export function getSTTProvider(offline = false): STTProvider {
  if (provider) return provider;
  provider = offline
    ? new OfflineSTTProvider()
    : new SpeechRecognitionKitSTTProvider();
  return provider;
}

export async function destroySTTProvider(): Promise<void> {
  if (provider && provider instanceof SpeechRecognitionKitSTTProvider) {
    await provider.destroy();
  }
  provider = null;
}
