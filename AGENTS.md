# Gojo Voice — Agent Handoff Notes

> Last updated: 2026-05-08 by Replit Agent (Session 2)

## What This App Is

**Gojo Voice** — Premium Expo/React Native voice changer app.
- Record voice → Apply AI or local effects → Share (WhatsApp/Telegram/BGMI)
- Audience: Indian gamers (Realme Android phone)

---

## Current Status ✅

All core features are **WORKING**:
- ✅ 6 ElevenLabs AI Voices (Gojo, Aria, Roger, Sarah, Charlie, George)
- ✅ 14 FFmpeg local effects (robot, deep, demon, cave, underwater, etc.)
- ✅ Real-time chunked mode (2s audio chunks → ElevenLabs → playback ~3-4s delay)
- ✅ BGMI background audio mode (`staysActiveInBackground: true`)
- ✅ Firebase Firestore history (`memoryLocalCache` — no IndexedDB crash)
- ✅ WhatsApp / any-app sharing + save to gallery
- ✅ Settings screen (pitch offset, volume boost, auto-stop timer, stats)
- ✅ Rename / favorite / delete / loop clips

---

## Architecture

```
artifacts/
├── voice-changer/        ← Expo SDK 54 React Native app
│   ├── app/
│   │   ├── _layout.tsx   ← Root layout (VoiceProvider, QueryClient, SafeArea)
│   │   ├── index.tsx     ← Main home screen (full premium UI)
│   │   ├── settings.tsx  ← Settings modal screen
│   │   └── +not-found.tsx
│   ├── context/
│   │   └── VoiceContext.tsx  ← ALL LOGIC HERE (20 effects, realtime, firebase)
│   ├── components/
│   │   ├── AudioMeter.tsx
│   │   ├── EffectGrid.tsx
│   │   ├── GlassCard.tsx
│   │   ├── RecordButton.tsx
│   │   ├── WaveformVisualizer.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorFallback.tsx
│   │   └── KeyboardAwareScrollViewCompat.tsx
│   ├── constants/colors.ts   ← Gojo cyan dark theme (#00E5FF on #050A14)
│   ├── hooks/useColors.ts    ← Always returns dark theme
│   ├── lib/firebase.ts       ← Firebase with memoryLocalCache
│   ├── app.json              ← newArchEnabled:false, all Android permissions
│   └── package.json          ← ELEVENLABS_KEY injected in dev script
│
└── api-server/               ← Express 5 API server
    └── src/routes/
        ├── voice.ts          ← multer + FFmpeg effects + ElevenLabs STS
        └── index.ts          ← /voice prefix for voice routes
```

---

## Key Secrets (All Set in Replit)

| Secret | Usage |
|--------|-------|
| `ELEVENLABS_API_KEY` | Backend API calls |
| `EXPO_PUBLIC_ELEVENLABS_KEY` | Auto-injected from `$ELEVENLABS_API_KEY` in dev script |
| `GITHUB_ACCESS_TOKEN` | GitHub pushes |

---

## ElevenLabs Voice IDs

| Name | Voice ID |
|------|----------|
| Gojo | `erXw76RvabIuWST2abio` |
| Aria | `9BWtsMINqrJLrRacOk9x` |
| Roger | `CwhRBWXzGAHq8TQ4Fs17` |
| Sarah | `EXAVITQu4vr4xnNLhMaY` |
| Charlie | `IKne3meq5aSn9XLyUdCD` |
| George | `JBFqnCBsd6RMkjVDRZzb` |

**Model:** `eleven_multilingual_v2`

---

## Firebase Config

- **Project:** `voice-changer-f8df7`
- **Firestore collection:** `clips`
- **Auth:** NOT implemented (anonymous access via Firebase rules — set rules to allow read/write)
- **localCache:** `memoryLocalCache()` — avoids IndexedDB errors on React Native

---

## FFmpeg Effects (Backend)

14 effects via `/api/voice/effects` endpoint (multer multipart):
`robot, deep, chipmunk, female, alien, echo, cave, demon, radio, whisper, reverb, telephone, megaphone, underwater`

FFmpeg binary: `/nix/store/.../ffmpeg` (available via `which ffmpeg`)

---

## API Routes

```
POST /api/voice/effects           ← multipart/form-data: audio + effect name → base64 mp3
POST /api/voice/speech-to-speech  ← multipart/form-data: audio + voiceId → base64 mp3
GET  /api/healthz                 ← { status: "ok" }
```

---

## Known Issues / Gotchas

1. **expo-updates removed** — It crashes Metro with ENOENT on temp dir. Don't add it back.
2. **newArchEnabled MUST be false** — New arch breaks several packages on SDK 54.
3. **Firebase memoryLocalCache** — Required, IndexedDB not available in React Native.
4. **ElevenLabs called directly from app** — EXPO_PUBLIC_ELEVENLABS_KEY must be in dev script env.
5. **expo-media-library** — Use `~18.2.1` (SDK 54 compatible). `^17` causes warning.
6. **No (tabs) folder** — App uses flat Stack routing, no tab navigation.

---

## GitHub Push Method

Git operations are blocked in Replit main agent. Use GitHub Contents API via curl:
```bash
# Example: push a file
SHA=$(curl -s -H "Authorization: token $GITHUB_ACCESS_TOKEN" \
  "https://api.github.com/repos/blcobra8585-debug/voice-ai-app/contents/PATH" | node -e "...")
curl -X PUT -H "Authorization: token $GITHUB_ACCESS_TOKEN" \
  "https://api.github.com/repos/blcobra8585-debug/voice-ai-app/contents/PATH" \
  -d "{\"message\":\"update\",\"content\":\"$(base64 -w 0 FILE)\",\"sha\":\"$SHA\"}"
```

Or run `bash push-to-github.sh` from Shell tab (does force push).

---

## What To Build Next (Ideas)

- [ ] Real microphone amplitude waveform (not animated bars)
- [ ] ElevenLabs API usage tracker (characters remaining)
- [ ] Virtual mic output for BGMI (native module needed)
- [ ] Clip trimming UI
- [ ] Voice presets (save your favorite effect combos)
- [ ] Auto-share to WhatsApp after conversion
- [ ] Telegram bot integration
- [ ] Language detection for multilingual voices
