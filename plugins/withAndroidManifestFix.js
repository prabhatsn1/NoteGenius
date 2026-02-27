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
 */
module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
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

    return config;
  });
};
