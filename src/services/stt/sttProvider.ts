/**
 * NoteGenius – Speech-to-Text provider using @react-native-voice/voice.
 * Provides on-device live transcription with partial and final results.
 * 
 * ARCHITECTURE NOTE:
 * - Live transcription and audio recording run SEPARATELY due to audio resource conflicts
 * - Voice provides transcription; expo-av handles audio file recording
 * - On Android: Both compete for microphone, so we prioritize STT and skip expo-av recording
 * - On iOS: Both can coexist with proper audio session configuration
 */
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
  SpeechEndEvent,
} from "@react-native-voice/voice";
import { Platform } from "react-native";

export interface STTProvider {
  start(locale: string): Promise<void>;
  stop(audioUri?: string): Promise<void>;
  cancel(): Promise<void>;
  onResult: ((text: string, isFinal: boolean) => void) | null;
  onError: ((error: string) => void) | null;
  onSessionEnd: (() => void) | null;
  onAudioSaved: ((uri: string, durationMs: number) => void) | null;
  isAvailable(): Promise<boolean>;
}

class VoiceSTTProvider implements STTProvider {
  onResult: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onSessionEnd: (() => void) | null = null;
  onAudioSaved: ((uri: string, durationMs: number) => void) | null = null;

  private isListening = false;
  private currentLocale = "en-US";
  private lastPartialText = "";
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._setupListeners();
  }

  private _setupListeners() {
    Voice.onSpeechStart = () => {
      console.log("[Voice] Speech started");
      this.isListening = true;
    };

    Voice.onSpeechEnd = (e: SpeechEndEvent) => {
      console.log("[Voice] Speech ended", e);
      // Auto-restart on silence timeout to keep transcription running
      if (this.isListening) {
        this._scheduleRestart();
      }
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      console.log("[Voice] Final results", e);
      const text = e.value?.[0] || "";
      if (text && this.onResult) {
        this.lastPartialText = "";
        this.onResult(text, true);
      }
    };

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      console.log("[Voice] Partial results", e);
      const text = e.value?.[0] || "";
      if (text && this.onResult) {
        this.lastPartialText = text;
        this.onResult(text, false);
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      console.warn("[Voice] Error", e);
      const errorMsg = e.error?.message || JSON.stringify(e.error) || "Unknown error";
      
      // Handle common errors
      if (errorMsg.includes("7/") || errorMsg.includes("No speech")) {
        // Error 7: No speech detected - auto-restart
        this._scheduleRestart();
        return;
      }

      if (errorMsg.includes("5/") || errorMsg.includes("Client")) {
        // Error 5: Client error - usually transient, restart
        this._scheduleRestart();
        return;
      }

      this.onError?.(errorMsg);
    };
  }

  private _scheduleRestart() {
    if (this.restartTimeout) return;
    
    this.restartTimeout = setTimeout(async () => {
      this.restartTimeout = null;
      if (this.isListening) {
        console.log("[Voice] Auto-restarting after silence timeout");
        try {
          await Voice.stop();
          await Voice.start(this.currentLocale);
        } catch (err) {
          console.error("[Voice] Restart failed", err);
        }
      }
    }, 100);
  }

  async start(locale: string): Promise<void> {
    console.log("[Voice] Starting with locale:", locale);
    this.currentLocale = locale;
    this.lastPartialText = "";
    this.isListening = true;

    try {
      await Voice.start(locale);
    } catch (err) {
      console.error("[Voice] Start error:", err);
      this.onError?.(String(err));
      throw err;
    }
  }

  async stop(audioUri?: string): Promise<void> {
    console.log("[Voice] Stopping");
    this.isListening = false;
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    try {
      await Voice.stop();
      
      // Flush last partial as final if we have it
      if (this.lastPartialText && this.onResult) {
        this.onResult(this.lastPartialText, true);
        this.lastPartialText = "";
      }

      this.onSessionEnd?.();
    } catch (err) {
      console.error("[Voice] Stop error:", err);
    }
  }

  async cancel(): Promise<void> {
    console.log("[Voice] Cancelling");
    this.isListening = false;
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    try {
      await Voice.cancel();
      this.onSessionEnd?.();
    } catch (err) {
      console.error("[Voice] Cancel error:", err);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const available = await Voice.isAvailable();
      return available === 1 || available === true;
    } catch {
      return false;
    }
  }

  async destroy() {
    this.isListening = false;
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    try {
      await Voice.destroy();
    } catch (err) {
      console.error("[Voice] Destroy error:", err);
    }

    Voice.removeAllListeners();
  }
}

// ─── Singleton instance ──────────────────────────────────────────────────────
let sttInstance: VoiceSTTProvider | null = null;

export function getSTTProvider(): STTProvider {
  if (!sttInstance) {
    sttInstance = new VoiceSTTProvider();
  }
  return sttInstance;
}

export async function destroySTTProvider(): Promise<void> {
  if (sttInstance) {
    await sttInstance.destroy();
    sttInstance = null;
  }
}

export function isSTTAvailable(): boolean {
  // Voice is available if the native module loaded
  return Voice !== null && Voice !== undefined;
}
