/**
 * NoteGenius – Audio recording service.
 * Uses expo-av for recording and playback with waveform metering.
 * On Android, PcmAudioCapture assembles a .wav from raw PCM chunks
 * streamed via the SpeechRecognizer AUDIO_BUFFER event.
 */
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

// ─── PCM → WAV helper (Android STT audio capture) ───────────────────────────
// Android's SpeechRecognizer.onBufferReceived delivers 16-bit signed PCM
// at 16 000 Hz, mono. We accumulate the raw bytes and prepend a WAV header
// when the recording stops.

const PCM_SAMPLE_RATE = 16000;
const PCM_CHANNELS = 1;
const PCM_BIT_DEPTH = 16;

function buildWavHeader(pcmByteLength: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = (PCM_SAMPLE_RATE * PCM_CHANNELS * PCM_BIT_DEPTH) / 8;
  const blockAlign = (PCM_CHANNELS * PCM_BIT_DEPTH) / 8;

  // RIFF chunk
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46); // "RIFF"
  view.setUint32(4, 36 + pcmByteLength, true);
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45); // "WAVE"
  // fmt sub-chunk
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20); // "fmt "
  view.setUint32(16, 16, true);          // sub-chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, PCM_CHANNELS, true);
  view.setUint32(24, PCM_SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, PCM_BIT_DEPTH, true);
  // data sub-chunk
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61); // "data"
  view.setUint32(40, pcmByteLength, true);

  return new Uint8Array(header);
}

export const PcmAudioCapture = {
  _chunks: [] as string[],   // Base64-encoded PCM chunks
  _totalBytes: 0,

  reset() {
    this._chunks = [];
    this._totalBytes = 0;
  },

  addChunk(base64Chunk: string) {
    this._chunks.push(base64Chunk);
    // Each Base64 char encodes 6 bits; 4 chars = 3 bytes
    this._totalBytes += Math.floor((base64Chunk.length * 3) / 4);
  },

  hasData(): boolean {
    return this._chunks.length > 0;
  },

  async save(): Promise<{ uri: string; durationMs: number } | null> {
    if (this._chunks.length === 0) return null;
    try {
      // Decode all Base64 chunks into a single Uint8Array
      const pcmBytes = new Uint8Array(this._totalBytes);
      let offset = 0;
      for (const chunk of this._chunks) {
        const binary = atob(chunk);
        for (let i = 0; i < binary.length; i++) {
          pcmBytes[offset++] = binary.charCodeAt(i);
        }
      }

      const wavHeader = buildWavHeader(pcmBytes.byteLength);
      const wavBytes = new Uint8Array(wavHeader.byteLength + pcmBytes.byteLength);
      wavBytes.set(wavHeader, 0);
      wavBytes.set(pcmBytes, wavHeader.byteLength);

      // Convert to Base64 for FileSystem.writeAsStringAsync
      let binary = "";
      for (let i = 0; i < wavBytes.byteLength; i++) {
        binary += String.fromCharCode(wavBytes[i]);
      }
      const wavBase64 = btoa(binary);

      const destDir = `${FileSystem.documentDirectory}recordings/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destUri = `${destDir}recording_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(destUri, wavBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const durationMs = Math.round(
        (pcmBytes.byteLength / ((PCM_SAMPLE_RATE * PCM_CHANNELS * PCM_BIT_DEPTH) / 8)) * 1000,
      );

      this.reset();
      return { uri: destUri, durationMs };
    } catch (err) {
      console.error("[PcmAudioCapture] save error:", err);
      this.reset();
      return null;
    }
  },
};

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
