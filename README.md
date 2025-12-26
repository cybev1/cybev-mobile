# CYBEV Mobile (Capacitor)

## Phase 0 notes
This repo is configured to build an **Android Debug APK** via GitHub Actions and locally.

### Requirements
- **Node.js >= 22** (Capacitor CLI requirement)
- **Java 21** (Android build toolchain / source compatibility)

### Common commands
```bash
npm install
npm run cap:sync:android
npm run android:build:debug
```

### APK output
After a successful build, find the debug APK at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### GitHub Actions
The workflow at `.github/workflows/android.yml` builds the debug APK and uploads it as an artifact.
