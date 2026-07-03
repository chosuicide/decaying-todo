# DECAY Android APK Design

## Goal

Package the existing DECAY web application as a directly installable, signed Android APK and publish it through GitHub Releases. The Android app must keep the existing mobile UI and work without a network connection after installation.

## Release Contract

- App name: `DECAY`
- Application ID: `io.github.chosuicide.decay`
- Version name: `1.1.0`
- Version code: `2`
- Artifact name: `DECAY-v1.1.0.apk`
- Distribution: public GitHub Release `v1.1.0`
- Minimum deliverable: one signed, zip-aligned APK that Android can install directly

## Architecture

Use Capacitor as the Android runtime. The existing `index.html`, `styles.css`, and `app.js` remain the product source of truth. A small Node build script copies those files into a generated `www/` directory, and Capacitor copies `www/` into the Android application assets.

The APK loads only bundled local files. It does not point its WebView at GitHub Pages and does not require a backend. Browser and Android installations use separate WebView storage, so existing browser `localStorage` data is not migrated into the APK.

## Project Structure

- `package.json`: Capacitor dependencies and repeatable web, sync, and Android build commands.
- `capacitor.config.json`: app ID, app name, `www` web directory, Android display settings, and local-only navigation policy.
- `scripts/sync-web.mjs`: recreates `www/` from the three production web files.
- `android/`: generated Capacitor Android project, committed so future releases are reproducible.
- `resources/`: source Android icon and splash artwork.
- `www/`: generated web bundle, ignored by Git.

## Android Presentation

The app uses the current DECAY dark interface without redesigning product screens. The launcher icon uses a near-black background, an acid-green `D`, and restrained horizontal erosion marks matching the existing brand. The splash screen uses the same mark and palette.

The status bar and navigation bar use the dark application background. The WebView respects safe areas and does not expose browser controls.

## Signing And Secrets

Generate a long-lived Android release keystore outside the repository under `D:\Documents\decaying-todo-private\android\`. Store the keystore password beside it in a local credentials file restricted to the current machine. Do not commit the keystore, passwords, signing properties, or generated signed APK.

Build an unsigned release APK with Gradle, run Android `zipalign`, and sign it with `apksigner`. Future DECAY Android updates must use the same keystore or Android will reject them as updates to the installed app.

## Tooling

Keep all installed build tooling on the D drive:

- JDK 21 under `D:\Tools\Java\`
- Android command-line SDK under `D:\Tools\Android\Sdk\`
- npm cache under `D:\Tools\npm-cache\`

Install only the Android platform and build tools required by the generated Capacitor project. Use the generated Gradle wrapper rather than installing a global Gradle distribution.

## Error Handling

- The web sync script exits non-zero when a required source file is missing.
- The build stops if Capacitor sync, Gradle compilation, zip alignment, or APK signing fails.
- Release publication occurs only after signature verification and APK metadata checks pass.
- Existing GitHub Release assets are checked before upload to prevent silently overwriting an unrelated file.

## Verification

The release is accepted only when all of the following succeed:

1. Existing JavaScript syntax and feature-contract tests pass.
2. The generated `www/` files match the production web files byte-for-byte.
3. Capacitor sync completes without missing assets.
4. Gradle produces a release APK.
5. `zipalign -c` succeeds.
6. `apksigner verify --verbose --print-certs` succeeds.
7. Android package metadata reports `io.github.chosuicide.decay`, version `1.1.0`, and version code `2`.
8. The GitHub Release exposes `DECAY-v1.1.0.apk` as a downloadable asset.

Physical-device installation is desirable but not required when no Android device is connected. In that case, signature, package metadata, and bundled-asset inspection provide the release gate, and the remaining residual risk is reported explicitly.

## Out Of Scope

- Google Play AAB publication
- iOS packaging
- account sync or cloud backup
- migration of browser `localStorage` into Android
- push notifications or background alarms
- changes to the task-management feature set
