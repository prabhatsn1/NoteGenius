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
  isAvailable(): Promise<boolean>;
}

// ─── Default Voice STT Provider ──────────────────────────────────────────────
class VoiceSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;

  constructor() {
    Voice.onSpeechResults = this.handleResults;
    Voice.onSpeechPartialResults = this.handlePartial;
    Voice.onSpeechError = this.handleError;
    Voice.onSpeechStart = this.handleStart;
  }

  private handleResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] ?? "";
    this.onResult?.(text, true);
  };

  private handlePartial = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] ?? "";
    this.onResult?.(text, false);
  };

  private handleError = (e: SpeechErrorEvent) => {
    this.onError?.(e.error?.message ?? "STT error");
  };

  private handleStart = (_e: SpeechStartEvent) => {
    // recording started
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
    Voice.destroy().then(Voice.removeAllListeners);
  }
}

// ─── Offline STT Stub (provider interface for future Vosk/Whisper) ──────────
class OfflineSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;

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
