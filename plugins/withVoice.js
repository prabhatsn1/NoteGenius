const { withInfoPlist, withAndroidManifest } = require("@expo/config-plugins");

/**
 * Config plugin for @react-native-voice/voice
 * Ensures proper permissions for speech recognition
 */
const withVoice = (config) => {
  // iOS: Add speech recognition and microphone permissions
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSpeechRecognitionUsageDescription =
      config.modResults.NSSpeechRecognitionUsageDescription ||
      "NoteGenius uses speech recognition to transcribe your voice notes.";
    config.modResults.NSMicrophoneUsageDescription =
      config.modResults.NSMicrophoneUsageDescription ||
      "NoteGenius needs microphone access to record voice notes.";
    return config;
  });

  // Android: Add RECORD_AUDIO permission
  config = withAndroidManifest(config, (config) => {
    if (!config.modResults.manifest["uses-permission"]) {
      config.modResults.manifest["uses-permission"] = [];
    }

    const permissions = config.modResults.manifest["uses-permission"];
    
    // Add RECORD_AUDIO if not present
    const hasRecordAudio = permissions.some(
      (perm) => perm.$["android:name"] === "android.permission.RECORD_AUDIO"
    );

    if (!hasRecordAudio) {
      permissions.push({
        $: { "android:name": "android.permission.RECORD_AUDIO" },
      });
    }

    return config;
  });

  return config;
};

module.exports = withVoice;
