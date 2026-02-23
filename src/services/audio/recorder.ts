/**
 * NoteGenius – Audio recording service.
 * Uses expo-audio for recording and playback with waveform metering.
 */
import type {
  AudioPlayer as ExpoAudioPlayer,
  AudioRecorder as ExpoAudioRecorder,
  RecorderState,
  RecordingOptions,
} from "expo-audio";
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

/** Recording quality preset optimized for voice. */
const RECORDING_OPTIONS: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    outputFormat: "mpeg4",
    audioEncoder: "aac",
  },
  ios: {
    audioQuality: AudioQuality.HIGH,
    outputFormat: IOSOutputFormat.MPEG4AAC,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

let recorder: ExpoAudioRecorder | null = null;
let player: ExpoAudioPlayer | null = null;

export const AudioRecorder = {
  /** Request microphone permission and set audio mode. */
  async prepare(): Promise<boolean> {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return false;
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
    return true;
  },

  /** Start recording; returns the AudioRecorder object for status polling. */
  async start(): Promise<ExpoAudioRecorder | null> {
    try {
      const hasPermission = await AudioRecorder.prepare();
      if (!hasPermission) return null;

      recorder = new AudioModule.AudioRecorder({
        ...RECORDING_OPTIONS,
        isMeteringEnabled: true, // enables waveform amplitude
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return recorder;
    } catch (err) {
      console.error("[AudioRecorder] start error:", err);
      return null;
    }
  },

  /** Pause recording. */
  async pause(): Promise<void> {
    if (!recorder) return;
    recorder.pause();
  },

  /** Resume after pause. */
  async resume(): Promise<void> {
    if (!recorder) return;
    recorder.record();
  },

  /** Stop recording; returns the local file URI and duration. */
  async stop(): Promise<{ uri: string; durationMs: number } | null> {
    if (!recorder) return null;
    try {
      const durationMs = recorder.currentTime * 1000;
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false });

      // Move to persistent directory
      const filename = `recording_${Date.now()}.m4a`;
      const destDir = `${FileSystem.documentDirectory}recordings/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destUri = destDir + filename;

      if (uri) {
        await FileSystem.moveAsync({ from: uri, to: destUri });
      }

      recorder = null;
      return {
        uri: destUri,
        durationMs,
      };
    } catch (err) {
      console.error("[AudioRecorder] stop error:", err);
      recorder = null;
      return null;
    }
  },

  /** Get current recording status (metering, duration). */
  async getStatus(): Promise<RecorderState | null> {
    if (!recorder) return null;
    return recorder.getStatus();
  },

  /** Cancel and discard the current recording. */
  async cancel(): Promise<void> {
    if (!recorder) return;
    try {
      await recorder.stop();
    } catch {
      // ignore
    }
    recorder = null;
  },
};

export const AudioPlayer = {
  /** Load and play an audio file. */
  async play(
    uri: string,
    onFinish?: () => void,
    positionMs = 0,
  ): Promise<ExpoAudioPlayer | null> {
    try {
      await AudioPlayer.stop();
      player = createAudioPlayer({ uri });
      if (onFinish) {
        player.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) {
            onFinish();
          }
        });
      }
      await player.seekTo(positionMs / 1000);
      player.play();
      return player;
    } catch (err) {
      console.error("[AudioPlayer] play error:", err);
      return null;
    }
  },

  /** Pause playback. */
  async pause(): Promise<void> {
    if (player) player.pause();
  },

  /** Resume playback. */
  async resume(): Promise<void> {
    if (player) player.play();
  },

  /** Seek to position. */
  async seek(positionMs: number): Promise<void> {
    if (player) await player.seekTo(positionMs / 1000);
  },

  /** Stop and unload. */
  async stop(): Promise<void> {
    if (player) {
      player.pause();
      player.remove();
      player = null;
    }
  },
};
