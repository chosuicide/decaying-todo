# DECAY Android APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce, verify, and publish a signed `DECAY-v1.1.0.apk` that bundles the existing DECAY web app for offline Android use.

**Architecture:** Capacitor 8.4.1 wraps a generated `www/` copy of the existing static web app. The generated Android project is reproducible from committed metadata, while signing credentials remain outside the repository and Android/JDK tooling remains on the D drive.

**Tech Stack:** HTML/CSS/JavaScript, Node.js 24, Capacitor 8.4.1, Capacitor Assets 3.0.5, Android SDK 36, Gradle wrapper, JDK 21, `zipalign`, and `apksigner`.

---

### Task 1: Add Packaging Contract Tests

**Files:**
- Create: `tests/android-packaging.test.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing tests for packaging metadata**

Create Node tests that require `package.json`, `capacitor.config.json`, `scripts/sync-web.mjs`, the Android application ID, version `1.1.0`, `webDir: "www"`, and ignored generated/signing artifacts.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/android-packaging.test.mjs`

Expected: FAIL because packaging files do not exist.

- [ ] **Step 3: Extend `.gitignore`**

Ignore `node_modules/`, `www/`, Android build directories, local signing properties, APK outputs, and private keystore files without changing existing release-source exclusions.

- [ ] **Step 4: Commit the red test**

Run: `rtk git add .gitignore tests/android-packaging.test.mjs && rtk git commit -m "Test Android packaging contract"`

### Task 2: Add Capacitor Metadata And Web Sync

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `capacitor.config.json`
- Create: `scripts/sync-web.mjs`
- Modify: `tests/android-packaging.test.mjs`

- [ ] **Step 1: Add exact dependencies and scripts**

Use `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android` version `8.4.1`, plus `@capacitor/assets` version `3.0.5`. Add scripts for `test`, `web:sync`, `cap:sync`, and `android:build`.

- [ ] **Step 2: Configure Capacitor**

Set `appId` to `io.github.chosuicide.decay`, `appName` to `DECAY`, `webDir` to `www`, dark background `#080a0b`, and Android scheme `https` without a remote server URL.

- [ ] **Step 3: Implement deterministic web sync**

The Node script must delete and recreate `www/`, verify `index.html`, `styles.css`, and `app.js` exist, copy them byte-for-byte, and write no network-dependent assets.

- [ ] **Step 4: Install dependencies on D drive and run tests**

Run with `npm_config_cache=D:\Tools\npm-cache`: `npm install` followed by `npm test`.

Expected: all existing and Android packaging tests pass.

- [ ] **Step 5: Commit metadata**

Run: `rtk git add package.json package-lock.json capacitor.config.json scripts/sync-web.mjs tests/android-packaging.test.mjs && rtk git commit -m "Add Capacitor Android packaging"`

### Task 3: Create Android Brand Assets

**Files:**
- Create: `resources/icon-only.png`
- Create: `resources/splash.png`

- [ ] **Step 1: Generate the launcher icon**

Create a square 1024px PNG with near-black background, acid-green `D`, and restrained horizontal erosion marks matching the existing DECAY interface. Keep the mark centered with safe padding for adaptive masks.

- [ ] **Step 2: Generate the splash asset**

Create a 2732px square PNG using the same mark, more surrounding negative space, and no small text.

- [ ] **Step 3: Inspect both assets**

Verify exact dimensions, opaque background, legibility at small size, and visual consistency before Android resource generation.

- [ ] **Step 4: Commit assets**

Run: `rtk git add resources/icon-only.png resources/splash.png && rtk git commit -m "Add DECAY Android artwork"`

### Task 4: Install Android Build Tooling On D Drive

**Files:**
- External: `D:\Tools\Java\temurin-21\`
- External: `D:\Tools\Android\Sdk\`

- [ ] **Step 1: Install a JDK 21 ZIP distribution**

Download an official Temurin 21 x64 Windows ZIP, extract it under `D:\Tools\Java\temurin-21\`, and set `JAVA_HOME` only for build commands.

- [ ] **Step 2: Install Android command-line tools**

Install the official command-line tools under `D:\Tools\Android\Sdk\cmdline-tools\latest\`.

- [ ] **Step 3: Install required SDK packages**

Use `sdkmanager` to accept licenses and install `platform-tools`, `platforms;android-36`, and `build-tools;36.0.0`.

- [ ] **Step 4: Verify tools**

Run `java -version`, `sdkmanager --list_installed`, `adb version`, `zipalign -h`, and `apksigner version` using the D-drive paths.

### Task 5: Generate And Configure The Android Project

**Files:**
- Create: `android/**`
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/res/values/strings.xml`
- Modify: `android/app/src/main/res/values/styles.xml`

- [ ] **Step 1: Generate local web assets**

Run: `npm run web:sync`

Expected: `www/index.html`, `www/styles.css`, and `www/app.js` exist and match their source hashes.

- [ ] **Step 2: Add the Android platform**

Run: `npx cap add android` and `npx cap sync android`.

- [ ] **Step 3: Set release metadata**

Set `versionCode 2` and `versionName "1.1.0"`; retain application ID `io.github.chosuicide.decay` and label `DECAY`.

- [ ] **Step 4: Generate launcher and splash resources**

Run: `npx capacitor-assets generate --android` and verify the generated mipmap and drawable resources.

- [ ] **Step 5: Apply dark system presentation**

Use `#080a0b` for splash, status-bar, and navigation-bar colors and keep the app non-translucent during launch.

- [ ] **Step 6: Commit the Android project**

Run: `rtk git add android && rtk git commit -m "Generate DECAY Android project"`

### Task 6: Build And Sign The Release APK

**Files:**
- External: `D:\Documents\decaying-todo-private\android\decay-release.jks`
- External: `D:\Documents\decaying-todo-private\android\signing-credentials.txt`
- Generated: `DECAY-v1.1.0.apk`

- [ ] **Step 1: Generate persistent signing credentials**

Create cryptographically random store and key passwords, save them only in the private D-drive directory, and generate a 4096-bit RSA keystore with alias `decay-release` and 10,000-day validity.

- [ ] **Step 2: Build the unsigned release**

Set `JAVA_HOME` and `ANDROID_HOME` to the D-drive tools, then run `android\gradlew.bat assembleRelease`.

- [ ] **Step 3: Align and sign**

Run `zipalign -p -f 4` on the unsigned APK, then `apksigner sign` using the private keystore to produce `DECAY-v1.1.0.apk`.

- [ ] **Step 4: Verify the artifact**

Run `zipalign -c -v 4`, `apksigner verify --verbose --print-certs`, and `aapt dump badging`. Require package `io.github.chosuicide.decay`, version code `2`, and version name `1.1.0`.

### Task 7: Run Release Verification And Document Installation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run all web and packaging tests**

Run: `node --check app.js` and `npm test`.

- [ ] **Step 2: Verify bundled web assets**

Compare SHA-256 hashes for each root web file against its `www/` and Android asset copy.

- [ ] **Step 3: Check for a connected Android device**

Run `adb devices`. If a device is connected and authorized, install with `adb install -r DECAY-v1.1.0.apk` and launch `io.github.chosuicide.decay`. Otherwise record physical installation as the only unperformed check.

- [ ] **Step 4: Update README**

Add the Android download link, installation steps, unknown-source warning, separate local-data note, and signing-key backup warning.

- [ ] **Step 5: Commit documentation**

Run: `rtk git add README.md && rtk git commit -m "Document Android installation"`

### Task 8: Publish Version 1.1.0

**Files:**
- Release asset: `DECAY-v1.1.0.apk`

- [ ] **Step 1: Confirm clean release state**

Run `rtk git status -sb`, inspect the complete diff from `v1.0.0`, and verify no private signing files are tracked.

- [ ] **Step 2: Push the source commit**

Push `main` to `chosuicide/decaying-todo`. If Git smart HTTP remains unavailable, publish the exact local Git objects through the authenticated GitHub Git Database API and align `origin/main` to the resulting commit.

- [ ] **Step 3: Create the GitHub release**

Create public release `v1.1.0` titled `DECAY Android v1.1.0` and upload `DECAY-v1.1.0.apk` without including signing credentials.

- [ ] **Step 4: Verify public download**

Query the release asset metadata, download the published APK to a temporary verification path, compare its SHA-256 with the local artifact, and report the repository, release, and direct APK URLs.
