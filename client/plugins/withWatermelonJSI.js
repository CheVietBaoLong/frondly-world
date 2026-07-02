/**
 * Custom Expo config plugin: wire up WatermelonDB's JSI module for the
 * React Native *new architecture* (RN 0.85 / bridgeless).
 *
 * Why this exists:
 *   @morrowdigital/watermelondb-expo-plugin@2.3.3 registers the JSI package via
 *   `getJSIModulePackage(): JSIModulePackage`, but `com.facebook.react.bridge.JSIModulePackage`
 *   was removed in RN's new architecture, so MainApplication.kt fails to compile
 *   ("Unresolved reference 'JSIModulePackage'").
 *
 *   In WatermelonDB 0.28, `WatermelonDBJSIPackage` is a plain `ReactPackage`, so the
 *   correct new-arch wiring is simply to add it to `getPackages()`. This plugin does the
 *   gradle linking (identical to the upstream plugin) plus that correct registration.
 *
 * Usage: set `disableJsi: true` on @morrowdigital/watermelondb-expo-plugin (so it skips
 *   its broken Android injection) and add this plugin after it in app.json. On iOS, the
 *   upstream plugin unconditionally injects a `pod 'simdjson'` line into the Podfile
 *   (not gated by `disableJsi`). By default Expo autolinking would ALSO link that pod via
 *   @nozbe/simdjson's own podspec, and CocoaPods refuses the duplicate — so
 *   package.json's `expo.autolinking.exclude` opts it out of autolinking, leaving the
 *   upstream plugin's manual pod line as the single source.
 */
const {
  withSettingsGradle,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");

const JSI_PROJECT = ":watermelondb-jsi";

// settings.gradle: include the :watermelondb-jsi gradle subproject shipped inside
// @nozbe/watermelondb (native/android-jsi). Resolved relative to the package.json path.
function withJsiSettingsGradle(config) {
  return withSettingsGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(JSI_PROJECT)) {
      mod.modResults.contents += `
include ':watermelondb-jsi'
project(':watermelondb-jsi').projectDir = new File([
    "node", "--print",
    "require.resolve('@nozbe/watermelondb/package.json')"
].execute(null, rootProject.projectDir).text.trim(), "../native/android-jsi")
`;
    }
    return mod;
  });
}

// app/build.gradle: depend on the subproject and dedupe the shared C++ runtime so the
// JSI .so links cleanly.
function withJsiAppBuildGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes("pickFirst '**/libc++_shared.so'")) {
      const anchor = "android {";
      if (!contents.includes(anchor)) {
        throw new Error(
          `[withWatermelonJSI] Could not find '${anchor}' in app/build.gradle. The Expo template changed; update this plugin.`
        );
      }
      contents = contents.replace(
        anchor,
        `android {
    packagingOptions {
        pickFirst '**/libc++_shared.so'
    }`
      );
    }
    if (!contents.includes("implementation project(':watermelondb-jsi')")) {
      const anchor = "dependencies {";
      if (!contents.includes(anchor)) {
        throw new Error(
          `[withWatermelonJSI] Could not find '${anchor}' in app/build.gradle. The Expo template changed; update this plugin.`
        );
      }
      contents = contents.replace(
        anchor,
        `dependencies {
    implementation project(':watermelondb-jsi')`
      );
    }
    mod.modResults.contents = contents;
    return mod;
  });
}

// proguard-rules.pro: keep WatermelonDB classes so release/minified builds don't strip
// the JNI entry points the native lib calls back into.
function withJsiProguard(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const file = `${cfg.modRequest.platformProjectRoot}/app/proguard-rules.pro`;
      const contents = await fs.promises.readFile(file, "utf-8");
      if (!contents.includes("-keep class com.nozbe.watermelondb.** { *; }")) {
        await fs.promises.writeFile(
          file,
          `${contents}\n-keep class com.nozbe.watermelondb.** { *; }\n`
        );
      }
      return cfg;
    },
  ]);
}

// MainApplication.kt: register WatermelonDBJSIPackage the new-architecture way — add it to
// the autolinked package list inside the ReactHost's `PackageList(this).packages.apply { }`
// block (SDK 56 / RN 0.85 bridgeless template). No getJSIModulePackage override.
function withJsiMainApplication(config) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;

    const importLine = "import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage";
    if (!contents.includes(importLine)) {
      const importAnchor = "import android.app.Application";
      if (!contents.includes(importAnchor)) {
        throw new Error(
          `[withWatermelonJSI] Could not find '${importAnchor}' in MainApplication.kt. The Expo template changed; update this plugin.`
        );
      }
      contents = contents.replace(importAnchor, `${importAnchor}\n${importLine}`);
    }

    if (!contents.includes("add(WatermelonDBJSIPackage())")) {
      const anchor = "PackageList(this).packages.apply {";
      if (!contents.includes(anchor)) {
        throw new Error(
          "[withWatermelonJSI] Could not find '" +
            anchor +
            "' in MainApplication.kt. The Expo template changed; update this plugin."
        );
      }
      contents = contents.replace(anchor, `${anchor}\n          add(WatermelonDBJSIPackage())`);
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = function withWatermelonJSI(config) {
  config = withJsiSettingsGradle(config);
  config = withJsiAppBuildGradle(config);
  config = withJsiProguard(config);
  config = withJsiMainApplication(config);
  return config;
};
