/**
 * NoteGenius – Speech-to-Text provider interface.
 * Uses react-native-speech-recognition-kit for live on-device transcription.
 * Recognition starts immediately when recording begins and streams partial and
 * final results in real-time via native OS speech APIs.
 */
import { NativeModules } from "react-native";
import {
  addEventListener,
  destroy as destroyRecognizer,
  speechRecogntionEvents,
  startListening,
  stopListening,
} from "react-native-speech-recognition-kit";
// NOTE: setRecognitionLanguage / isRecognitionAvailable are declared in the JS
// wrapper but NOT implemented in the native layer – calling them crashes.
// The iOS recogniser always uses [NSLocale currentLocale]; locale is tracked
// only on the JS side for segment metadata.

// Check if native module is available
const { SpeechRecognition } = NativeModules;
const isNativeModuleAvailable = SpeechRecognition != null;

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
  isAvailable(): Promise<boolean>;
}

// ─── Speech Recognition Kit STT Provider ────────────────────────────────────
class SpeechRecognitionKitSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onSessionEnd: (() => void) | null = null;

  private subscriptions: ReturnType<typeof addEventListener>[] = [];
  /** Set to true once stop() has been called so we know to end on next RESULTS. */
  private isStopping = false;
  /** Guards against _endSession() being invoked more than once per session. */
  private sessionEnded = false;
  /** Resolves the Promise returned by stop(). */
  private stopResolve: (() => void) | null = null;
  /** Last partial text received – flushed as final if no RESULTS event fires. */
  private lastPartialText: string = "";

  async start(_locale: string): Promise<void> {
    console.log('[STT] start called with locale:', _locale);
    console.log('[STT] Native module available:', isNativeModuleAvailable);
    console.log('[STT] SpeechRecognition module:', SpeechRecognition);
    
    // Check if native module is available
    if (!isNativeModuleAvailable) {
      const error = "Speech recognition native module not initialized. Please rebuild the app with 'npx expo prebuild' and 'npx expo run:ios' or 'npx expo run:android'.";
      console.error("[SpeechRecognitionKit]", error);
      this.onError?.(error);
      return;
    }

    // Reset state for a fresh session.
    // NOTE: setRecognitionLanguage is not implemented natively; the recogniser
    // always uses the device locale (NSLocale.currentLocale).
    this.isStopping = false;
    this.sessionEnded = false;
    this.stopResolve = null;
    this.lastPartialText = "";
    this._removeListeners();
    console.log('[STT] Setting up event listeners');

    // Partial results → stream live text to the UI.
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.PARTIAL_RESULTS, (event) => {
        const text = this._extractText(event);
        console.log('[STT] PARTIAL_RESULTS:', text);
        if (text) {
          this.lastPartialText = text;
          this.onResult?.(text, false);
        }
      }),
    );
    console.log('[STT] PARTIAL_RESULTS listener added');

    // Final results → commit the utterance as a finished segment.
    // Only end the session when stop() has been explicitly called; otherwise
    // keep listening to capture subsequent utterances.
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.RESULTS, (event) => {
        const text = this._extractText(event);
        console.log('[STT] RESULTS:', text, 'isStopping:', this.isStopping);
        if (text) {
          this.lastPartialText = ""; // final result supersedes any partial
          this.onResult?.(text, true);
        }
        if (this.isStopping) {
          this._endSession();
        }
      }),
    );
    console.log('[STT] RESULTS listener added');

    // Error → report and close the session.
    // Native emits { message: string, code?: number } for all error events.
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.ERROR, (event) => {
        const code: number | undefined =
          event?.code ?? event?.nativeEvent?.code;
        const rawMsg: string =
          event?.message ?? event?.error ?? JSON.stringify(event) ?? "";
        
        // Error 7: No speech match found – benign, occurs during silence/pauses
        if (code === 7 || rawMsg.includes("No speech match")) {
          return; // Ignore silently, keep session alive
        }
        
        // Error 216: Audio device reconfiguration (iOS Simulator)
        if (code === 216 || rawMsg.includes("error 216")) {
          this._endSession();
          return;
        }
        
        const msg = rawMsg || "Unknown STT error";
        console.error("[SpeechRecognitionKit] error:", msg, event);
        this.onError?.(msg);
        this._endSession();
      }),
    );

    // END fires after RESULTS (or alone if no speech was detected).
    // Only end the session if stop() has been explicitly called; otherwise
    // iOS fires END after each utterance and we want to keep listening.
    this.subscriptions.push(
      addEventListener(speechRecogntionEvents.END, () => {
        console.log('[STT] END event, isStopping:', this.isStopping);
        if (this.isStopping) {
          this._endSession();
        }
      }),
    );

    try {
      console.log('[STT] Calling startListening()');
      console.log('[STT] startListening function:', startListening);
      const result = await startListening();
      console.log('[STT] startListening() completed, result:', result);
    } catch (err) {
      const error = "Speech recognition failed to start. Please rebuild the app with 'npx expo prebuild' and 'npx expo run:ios' or 'npx expo run:android'.";
      console.error("[SpeechRecognitionKit] Error details:", err);
      console.error("[SpeechRecognitionKit] Error message:", error);
      this.onError?.(error);
      this._endSession();
    }
  }

  async stop(_audioUri?: string): Promise<void> {
    console.log('[STT] stop() called, sessionEnded:', this.sessionEnded);
    // If the native session already ended on its own (e.g. silence timeout),
    // resolve immediately – there is nothing left to stop.
    if (this.sessionEnded) return;

    this.isStopping = true;
    console.log('[STT] Set isStopping=true, lastPartialText:', this.lastPartialText);

    return new Promise<void>((resolve) => {
      this.stopResolve = resolve;
      // Safety timeout: if END/RESULTS never fires (e.g. audio session conflict),
      // flush any partial text and resolve after 1.5s so handleStop never hangs.
      const timeout = setTimeout(() => {
        console.log('[STT] stop() timeout – forcing _endSession');
        this._endSession();
      }, 1500);
      const originalResolve = resolve;
      this.stopResolve = () => {
        clearTimeout(timeout);
        originalResolve();
      };
      try {
        if (isNativeModuleAvailable) {
          console.log('[STT] Calling stopListening()');
          Promise.resolve(stopListening()).catch(() => this._endSession());
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
    console.log('[STT] _endSession called, isStopping:', this.isStopping, 'lastPartialText:', this.lastPartialText);
    this._removeListeners();
    // If stop() was called but the native layer never fired a final RESULTS
    // event (e.g. it emitted END or an error 216 instead), flush the last
    // partial text as a final committed result so the segment is not lost.
    if (this.isStopping && this.lastPartialText.trim()) {
      console.log('[STT] Flushing last partial as final:', this.lastPartialText);
      this.onResult?.(this.lastPartialText.trim(), true);
      this.lastPartialText = "";
    }
    this.onSessionEnd?.();
    this.stopResolve?.();
    this.stopResolve = null;
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
