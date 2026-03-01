/**
 * NoteGenius – Whisper model manager.
 * Downloads and caches the ggml-tiny multilingual model on first use.
 */
import * as FileSystem from "expo-file-system/legacy";

const MODEL_DIR = `${FileSystem.documentDirectory}whisper/`;
const MODEL_FILENAME = "ggml-tiny.bin"; // ~75 MB, multilingual
const MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin";

export type ModelDownloadProgress = (progressPct: number) => void;

export const WhisperModelManager = {
  /** Returns the local path to the model, downloading it if necessary. */
  async ensureModel(onProgress?: ModelDownloadProgress): Promise<string> {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    if (info.exists) {
      onProgress?.(100);
      return MODEL_PATH;
    }

    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });

    const download = FileSystem.createDownloadResumable(
      MODEL_URL,
      MODEL_PATH,
      {},
      (dp) => {
        if (dp.totalBytesExpectedToWrite > 0) {
          const pct = Math.round(
            (dp.totalBytesWritten / dp.totalBytesExpectedToWrite) * 100,
          );
          onProgress?.(pct);
        }
      },
    );

    await download.downloadAsync();
    onProgress?.(100);
    return MODEL_PATH;
  },

  /** Returns true if the model file is already cached locally. */
  async isDownloaded(): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    return info.exists;
  },

  /** Deletes the cached model (e.g. to free space). */
  async deleteModel(): Promise<void> {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    if (info.exists) {
      await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
    }
  },
};
