const { withInfoPlist, withAndroidManifest } = require("@expo/config-plugins");

/**
 * Config plugin for react-native-speech-recognition-kit
 * Ensures proper permissions and native module setup
 */
const withSpeechRecognition = (config) => {
  // iOS: Add speech recognition permission
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSpeechRecognitionUsageDescription =
      config.modResults.NSSpeechRecognitionUsageDescription ||
      "NoteGenius uses speech recognition to transcribe your voice notes.";
    return config;
  });

  // Android: Add RECORD_AUDIO permission
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      // Ensure permissions array exists
      if (!config.modResults.manifest["uses-permission"]) {
        config.modResults.manifest["uses-permission"] = [];
      }
      
      // Add RECORD_AUDIO if not present
      const hasRecordAudio = config.modResults.manifest["uses-permission"].some(
        (perm) => perm.$["android:name"] === "android.permission.RECORD_AUDIO"
      );
      
      if (!hasRecordAudio) {
        config.modResults.manifest["uses-permission"].push({
          $: { "android:name": "android.permission.RECORD_AUDIO" },
        });
      }
    }
    return config;
  });

  return config;
};

module.exports = withSpeechRecognition;
