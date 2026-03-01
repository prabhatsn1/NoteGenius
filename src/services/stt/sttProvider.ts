/**
 * NoteGenius – Speech-to-Text provider interface.
 * Uses whisper.rn for fully offline, on-device transcription.
 * Audio is recorded via expo-audio and passed to Whisper after the session ends.
 */
import { initWhisper, type WhisperContext } from "whisper.rn";
import { WhisperModelManager } from "./whisperModel";

// ─── Provider Interface ──────────────────────────────────────────────────────
export interface STTProvider {
  /**
   * Signal the start of a recording session.
   * For Whisper this is a no-op STT-wise; actual transcription happens in stop().
   */
  start(locale: string): Promise<void>;
  /**
   * Stop and, for Whisper, transcribe the recorded audio.
   * Pass the audio file URI so the provider can run inference.
   * Fires onResult(text, true) then onSessionEnd() when done.
   */
  stop(audioUri?: string): Promise<void>;
  /** Cancel any in-progress transcription without emitting a result. */
  cancel(): Promise<void>;
  onResult: ((text: string, isFinal: boolean) => void) | null;
  onError: ((error: string) => void) | null;
  /** Called after transcription completes (or is cancelled). */
  onSessionEnd: (() => void) | null;
  isAvailable(): Promise<boolean>;
}

// ─── Locale helper ───────────────────────────────────────────────────────────
/** Convert BCP-47 locale tags (e.g. "en-US", "hi-IN") to Whisper 2-letter codes. */
function toWhisperLang(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

// ─── Whisper STT Provider ────────────────────────────────────────────────────
class WhisperSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onSessionEnd: (() => void) | null = null;

  private locale: string = "en";
  private context: WhisperContext | null = null;
  /** Function to abort an in-progress transcription. */
  private stopTranscription: (() => void) | null = null;

  async start(locale: string): Promise<void> {
    this.locale = toWhisperLang(locale);
  }

  async stop(audioUri?: string): Promise<void> {
    if (!audioUri) {
      this.onSessionEnd?.();
      return;
    }

    try {
      // Ensure the Whisper model is downloaded and context is initialised.
      if (!this.context) {
        const modelPath = await WhisperModelManager.ensureModel();
        this.context = await initWhisper({ filePath: modelPath });
      }

      // Normalise the URI – whisper.rn expects a "file://" prefixed path on iOS.
      const uri = audioUri.startsWith("file://")
        ? audioUri
        : `file://${audioUri}`;

      const { stop, promise } = this.context.transcribe(uri, {
        language: this.locale,
        maxLen: 1,
        onNewSegments: (segments) => {
          // Stream partial text back as the model produces segments.
          const partial = segments
            .map((s) => s.text)
            .join(" ")
            .trim();
          if (partial) this.onResult?.(partial, false);
        },
      });

      this.stopTranscription = stop;
      const { result } = await promise;
      this.stopTranscription = null;

      const text = result.trim();
      if (text) {
        this.onResult?.(text, true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[WhisperSTT] transcription error:", msg);
      this.onError?.(msg);
    } finally {
      this.onSessionEnd?.();
    }
  }

  async cancel(): Promise<void> {
    if (this.stopTranscription) {
      this.stopTranscription();
      this.stopTranscription = null;
    }
    this.onSessionEnd?.();
  }

  async isAvailable(): Promise<boolean> {
    return WhisperModelManager.isDownloaded();
  }

  /** Release the Whisper context and free native memory. */
  async destroy(): Promise<void> {
    this.stopTranscription?.();
    this.stopTranscription = null;
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
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
  provider = offline ? new OfflineSTTProvider() : new WhisperSTTProvider();
  return provider;
}

export async function destroySTTProvider(): Promise<void> {
  if (provider && provider instanceof WhisperSTTProvider) {
    await provider.destroy();
  }
  provider = null;
}
