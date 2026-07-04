import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const compileSdkBlock = `compileSdk {
        version = release(36) {
            it.minorApiLevel = 1
        }
    }`;

async function patch(relativePath, replacements) {
  const path = join(root, relativePath);
  let source = await readFile(path, "utf8");

  for (const [from, to] of replacements) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) {
      throw new Error(`Expected Android build setting not found in ${relativePath}`);
    }
    source = source.replace(from, to);
  }

  await writeFile(path, source);
}

await patch("node_modules/@capacitor/android/capacitor/build.gradle", [
  ["classpath 'com.android.tools.build:gradle:8.13.0'", "classpath 'com.android.tools.build:gradle:9.1.0'"],
  ["compileSdk = project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 36", compileSdkBlock],
]);

await patch("android/capacitor-cordova-android-plugins/build.gradle", [
  ["classpath 'com.android.tools.build:gradle:8.13.0'", "classpath 'com.android.tools.build:gradle:9.1.0'"],
  ["compileSdk = project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 36", compileSdkBlock],
]);

console.log("Patched Capacitor Android build for the installed Android Studio toolchain");
