const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Config plugin that forces the old Android Support Library out of the
 * dependency graph so it doesn't clash with AndroidX equivalents.
 *
 * Root cause: @react-native-voice/voice brings in
 *   com.android.support:support-compat:28.0.0
 * which duplicates classes already provided by
 *   androidx.core:core (via Jetifier / AndroidX migration).
 */
module.exports = function withExcludeSupportLibs(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = addExcludeBlock(
        config.modResults.contents
      );
    }
    return config;
  });
};

function addExcludeBlock(buildGradle) {
  const marker = "// @generated withExcludeSupportLibs";

  // Idempotent – don't add twice
  if (buildGradle.includes(marker)) return buildGradle;

  const snippet = `
${marker}
allprojects {
    configurations.all {
        exclude group: 'com.android.support', module: 'support-compat'
        exclude group: 'com.android.support', module: 'support-core-utils'
        exclude group: 'com.android.support', module: 'support-annotations'
        exclude group: 'com.android.support', module: 'animated-vector-drawable'
        exclude group: 'com.android.support', module: 'support-vector-drawable'
        exclude group: 'com.android.support', module: 'versionedparcelable'
        exclude group: 'com.android.support', module: 'customview'
    }
}
`;

  // Append after the last closing brace or at the end of the file
  return buildGradle + "\n" + snippet;
}
