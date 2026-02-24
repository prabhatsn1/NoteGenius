/**
 * NoteGenius – Speech-to-Text provider interface.
 * Default: uses @react-native-voice/voice for live streaming STT.
 * Provider interface allows swapping to offline (Vosk/Whisper) later.
 */
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
  SpeechStartEvent,
} from "@react-native-voice/voice";

// ─── Provider Interface ──────────────────────────────────────────────────────
export interface STTProvider {
  start(locale: string): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  onResult: ((text: string, isFinal: boolean) => void) | null;
  onError: ((error: string) => void) | null;
  /**
   * Called when a recognition session truly ends (after silence or explicit
   * stop). The caller can use this to auto-restart STT for continuous capture.
   */
  onSessionEnd: (() => void) | null;
  isAvailable(): Promise<boolean>;
}

// ─── Default Voice STT Provider ──────────────────────────────────────────────
class VoiceSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onSessionEnd: (() => void) | null = null;

  /**
   * iOS AVSpeechRecognizer fires onSpeechResults multiple times as it updates
   * its hypothesis while you speak — not only at the true end of the utterance.
   * We buffer the latest value here and only emit isFinal=true when
   * onSpeechEnd fires (the genuine session end).
   */
  private latestFinalText: string = "";

  constructor() {
    Voice.onSpeechResults = this.handleResults;
    Voice.onSpeechPartialResults = this.handlePartial;
    Voice.onSpeechError = this.handleError;
    Voice.onSpeechStart = this.handleStart;
    Voice.onSpeechEnd = this.handleEnd;
  }

  /**
   * Intermediate "final" hypothesis from iOS — buffer it and show as partial
   * so the live transcript updates, but don't commit a segment yet.
   */
  private handleResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] ?? "";
    this.latestFinalText = text;
    this.onResult?.(text, false); // display only — not a committed segment yet
  };

  private handlePartial = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] ?? "";
    this.onResult?.(text, false);
  };

  /**
   * True session end: commit the buffered final text, then notify caller so
   * it can restart recognition for continuous streaming.
   */
  private handleEnd = (_e: unknown) => {
    if (this.latestFinalText) {
      this.onResult?.(this.latestFinalText, true);
      this.latestFinalText = "";
    }
    this.onSessionEnd?.();
  };

  private handleError = (e: SpeechErrorEvent) => {
    this.latestFinalText = ""; // discard stale buffer on error
    this.onError?.(e.error?.message ?? "STT error");
  };

  private handleStart = (_e: SpeechStartEvent) => {
    // recognition session started
  };

  async start(locale: string): Promise<void> {
    try {
      await Voice.start(locale);
    } catch (err) {
      console.error("[VoiceSTT] start error:", err);
    }
  }

  async stop(): Promise<void> {
    try {
      await Voice.stop();
    } catch (err) {
      console.error("[VoiceSTT] stop error:", err);
    }
  }

  async cancel(): Promise<void> {
    try {
      this.latestFinalText = ""; // discard buffered text — no commit on cancel
      await Voice.cancel();
    } catch (err) {
      console.error("[VoiceSTT] cancel error:", err);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const services = await Voice.getSpeechRecognitionServices();
      return (services?.length ?? 0) > 0;
    } catch {
      // On iOS, just assume it's available
      return true;
    }
  }

  /** Clean up listeners on unmount. */
  destroy(): void {
    this.latestFinalText = "";
    Voice.destroy().then(Voice.removeAllListeners);
  }
}

// ─── Offline STT Stub (provider interface for future Vosk/Whisper) ──────────
class OfflineSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onSessionEnd: (() => void) | null = null;

  async start(_locale: string): Promise<void> {
    // Stub: would initialize local model here
    this.onError?.(
      "Offline STT not yet implemented. Enable cloud or use default Voice.",
    );
  }

  async stop(): Promise<void> {
    // no-op
  }

  async cancel(): Promise<void> {
    // no-op
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}

// ─── Singleton Factory ───────────────────────────────────────────────────────
let provider: STTProvider | null = null;

export function getSTTProvider(offline = false): STTProvider {
  if (provider) return provider;
  provider = offline ? new OfflineSTTProvider() : new VoiceSTTProvider();
  return provider;
}

export function destroySTTProvider(): void {
  if (provider && provider instanceof VoiceSTTProvider) {
    (provider as VoiceSTTProvider).destroy();
  }
  provider = null;
}
