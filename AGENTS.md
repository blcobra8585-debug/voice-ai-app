# Gojo Voice — Agent Technical Notes

> Last updated: 2026-05-08 by Replit Agent (Session 3)

## Active App: artifacts/voice-changer

Use `artifacts/voice-changer` as the main Expo app.
`artifacts/voice-ai-app` is the OLD version — ignore it.

---

## Build History

| Build ID | Status | Notes |
|----------|--------|-------|
| ba10de3a-1a2c-4cf6-947a-f33152f00097 | ✅ FINISHED | Working APK — newArchEnabled=true |
| 760289c1-479f-4862-9e33-9fa8a70e4a05 | ❌ ERRORED | newArchEnabled was false |
| 39903927, 26e8bf85 | ❌ ERRORED | Same Gradle issue |

**APK Download:** https://expo.dev/artifacts/eas/oYBYbmwyfN2JECdLAzXWZM.apk

---

## Known Issues / Gotchas

1. **newArchEnabled MUST be true** — react-native-reanimated 4.x + react-native-worklets 0.5.1 require New Architecture. NEVER set it to false.
2. **Firebase memoryLocalCache** — Required. IndexedDB is not available in React Native.
3. **expo-updates removed** — It crashes Metro with ENOENT on temp dir. Don't add it back.
4. **ElevenLabs dev key** — EXPO_PUBLIC_ELEVENLABS_KEY is injected from $ELEVENLABS_API_KEY in dev script env.
5. **No (tabs) folder** — App uses flat Stack routing, not tab navigation.
6. **EAS slug mismatch** — app.json slug is "voice-changer" but EAS project slug is "voice-ai-app". This is expected — they are linked via projectId in app.json extras.
7. **pnpm-workspace.yaml** includes artifacts/* glob so pnpm install works from repo root on EAS.
8. **GITHUB_TOKEN** is the secret name (not GITHUB_ACCESS_TOKEN). Use GITHUB_TOKEN in all GitHub API calls.

---

## VoiceContext.tsx Architecture

All core logic in `artifacts/voice-changer/context/VoiceContext.tsx`:
- Recording (expo-av)
- Effect selection (AI or local)
- ElevenLabs API calls (speech-to-speech)
- FFmpeg effects (via api-server backend)
- Firebase Firestore save/load
- AsyncStorage
- Sharing (expo-sharing)
- History management (rename, favorite, delete, loop)

---

## EAS Project Linking

`artifacts/voice-changer/app.json` links to EAS via:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "ac5f1412-c637-4ecc-8af1-46876cef5dea"
      }
    }
  }
}
```

EAS Account: suhanshaikh78957 | Account ID: 2586f0bf-a34b-48f3-89fc-8d3fe649043f

---

## How to Trigger a New APK Build

```bash
cd /tmp && git clone https://github.com/blcobra8585-debug/voice-ai-app voice-ai-app-fix
cd voice-ai-app-fix/artifacts/voice-changer
npm install -g eas-cli@latest
EXPO_TOKEN=$EXPO_ACCESS_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile preview --non-interactive
```

---

## What To Build Next (Priority Order)

1. OTA updates (expo-updates) — fixes without rebuilding APK
2. Real microphone waveform (not animated bars)
3. ElevenLabs usage tracker
4. Gemini AI assistant feature
5. Virtual mic for BGMI (native module — complex)
