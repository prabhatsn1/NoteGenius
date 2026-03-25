const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Config plugin that fixes the AndroidManifest merger error:
 * "tools:replace specified for attribute android:appComponentFactory,
 *  but no new value specified"
 *
 * This happens when @react-native-voice/voice (or another dependency) pulls
 * in legacy com.android.support libraries that clash with AndroidX.
 * The merger is told to replace appComponentFactory but the replacement
 * value is missing. We set it explicitly to the AndroidX value.
 * 
 * Also adds queries for speech recognition service (Android 11+).
 */
module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Ensure the tools namespace is declared on <manifest>
    if (!manifest.manifest.$["xmlns:tools"]) {
      manifest.manifest.$["xmlns:tools"] =
        "http://schemas.android.com/tools";
    }

    const application = manifest.manifest.application?.[0];

    if (application) {
      // Set the AndroidX appComponentFactory explicitly
      application.$["android:appComponentFactory"] =
        "androidx.core.app.CoreComponentFactory";

      // Ensure tools:replace includes appComponentFactory
      const existing = application.$["tools:replace"] || "";
      if (!existing.includes("android:appComponentFactory")) {
        application.$["tools:replace"] = existing
          ? `${existing},android:appComponentFactory`
          : "android:appComponentFactory";
      }
    }

    // Add queries for speech recognition (Android 11+)
    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [];
    }

    // Check if speech recognition query already exists
    const hasRecognitionQuery = manifest.manifest.queries.some(
      (query) =>
        query.intent &&
        query.intent.some(
          (intent) =>
            intent.action &&
            intent.action.some(
              (action) =>
                action.$["android:name"] === "android.speech.RecognitionService"
            )
        )
    );

    if (!hasRecognitionQuery) {
      manifest.manifest.queries.push({
        intent: [
          {
            action: [
              {
                $: { "android:name": "android.speech.RecognitionService" },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};
