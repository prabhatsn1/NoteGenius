/**
 * NoteGenius – Audio recording service.
 * Uses expo-av for recording and playback with waveform metering.
 */
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

/** Recording quality preset optimized for voice. */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 128000 },
  isMeteringEnabled: true,
};

let recorder: Audio.Recording | null = null;
let player: Audio.Sound | null = null;

export const AudioRecorder = {
  async prepare(): Promise<boolean> {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return false;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    });
    return true;
  },

  async start(): Promise<Audio.Recording | null> {
    try {
      const hasPermission = await AudioRecorder.prepare();
      if (!hasPermission) return null;
      recorder = new Audio.Recording();
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      await recorder.startAsync();
      return recorder;
    } catch (err) {
      console.error("[AudioRecorder] start error:", err);
      return null;
    }
  },

  async pause(): Promise<void> {
    if (!recorder) return;
    await recorder.pauseAsync();
  },

  async resume(): Promise<void> {
    if (!recorder) return;
    await recorder.startAsync();
  },

  async stop(): Promise<{ uri: string; durationMs: number } | null> {
    if (!recorder) return null;
    try {
      const status = await recorder.getStatusAsync();
      const durationMs = status.durationMillis ?? 0;
      await recorder.stopAndUnloadAsync();
      const uri = recorder.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const filename = `recording_${Date.now()}.m4a`;
      const destDir = `${FileSystem.documentDirectory}recordings/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destUri = destDir + filename;

      if (uri) await FileSystem.moveAsync({ from: uri, to: destUri });

      recorder = null;
      return { uri: destUri, durationMs };
    } catch (err) {
      console.error("[AudioRecorder] stop error:", err);
      recorder = null;
      return null;
    }
  },

  async getStatus(): Promise<Audio.RecordingStatus | null> {
    if (!recorder) return null;
    return recorder.getStatusAsync();
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
  async play(
    uri: string,
    onFinish?: () => void,
    positionMs = 0,
  ): Promise<Audio.Sound | null> {
    try {
      await AudioPlayer.stop();
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { positionMillis: positionMs, shouldPlay: true },
        onFinish
          ? (status: AVPlaybackStatus) => {
              if (status.isLoaded && status.didJustFinish) onFinish();
            }
          : undefined,
      );
      player = sound;
      return player;
    } catch (err) {
      console.error("[AudioPlayer] play error:", err);
      return null;
    }
  },

  async pause(): Promise<void> {
    if (player) await player.pauseAsync();
  },

  async resume(): Promise<void> {
    if (player) await player.playAsync();
  },

  async seek(positionMs: number): Promise<void> {
    if (player) await player.setPositionAsync(positionMs);
  },

  async stop(): Promise<void> {
    if (player) {
      await player.stopAsync();
      await player.unloadAsync();
      player = null;
    }
  },
};
