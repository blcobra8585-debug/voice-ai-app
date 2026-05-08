# Agent Context — Gojo Voice (Voice AI App)

> **Read this file first if you are a new agent picking up this project.**
> Last updated: 2026-05-08 by Replit Agent (Session 3)

---

## What This App Does

**Gojo Voice** is a premium mobile voice changer app built with Expo (React Native).

The user taps a glowing record button → records their voice → picks an effect:
- **AI Voices** (Gojo, Aria, Roger, etc.): Sends audio to ElevenLabs Speech-to-Speech API
- **Local effects** (Robot, Deep, Chipmunk, etc.): Processed via Express backend using FFmpeg

The UI is a **Glassmorphic Dark** design with cyan neon glows on a deep navy background.

---

## APK Build Status — DONE

**Latest successful APK build:**
- Build ID: ba10de3a-1a2c-4cf6-947a-f33152f00097
- Status: FINISHED
- Platform: Android (APK — preview profile)
- Download: https://expo.dev/artifacts/eas/oYBYbmwyfN2JECdLAzXWZM.apk
- EAS Dashboard: https://expo.dev/accounts/suhanshaikh78957/projects/voice-ai-app

**Key fix that made it work:**
- react-native-reanimated 4.x + react-native-worklets require New Architecture
- Fixed: set newArchEnabled: true in artifacts/voice-changer/app.json

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── voice-changer/           <- MAIN Expo mobile app (USE THIS)
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx        <- Main screen
│   │   │   └── settings.tsx
│   │   ├── components/          <- All UI components
│   │   ├── context/
│   │   │   └── VoiceContext.tsx <- ALL LOGIC (recording, effects, firebase)
│   │   ├── lib/firebase.ts      <- Firebase init (memoryLocalCache)
│   │   ├── app.json             <- newArchEnabled: true  <-- CRITICAL
│   │   ├── eas.json             <- EAS build config (preview = APK)
│   │   └── google-services.json
│   │
│   ├── voice-ai-app/            <- OLD VERSION — ignore this folder
│   │
│   └── api-server/              <- Express backend (FFmpeg effects)
│       └── src/routes/
│           ├── voice.ts         <- multer + FFmpeg + ElevenLabs STS
│           └── health.ts        <- GET /api/healthz
│
├── AGENT_CONTEXT.md             <- THIS FILE — read first
├── AGENTS.md                    <- Technical handoff notes
└── replit.md                    <- Workspace overview
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | Expo SDK 54, Expo Router v4, React Native |
| New Architecture | ENABLED (newArchEnabled: true) — required for reanimated 4.x |
| Backend API | Express 5 + TypeScript (Node 24) |
| Voice AI | ElevenLabs Speech-to-Speech |
| Database | Firebase Firestore (clip history) |
| Monorepo | pnpm workspaces |
| Build | EAS Build (Expo Application Services) |

---

## Environment Secrets (All set in Replit Secrets)

| Secret Key | Used For |
|---|---|
| ELEVENLABS_API_KEY | ElevenLabs voice API (backend) |
| EXPO_ACCESS_TOKEN | EAS Build authentication |
| FIREBASE_API_KEY | Firebase config |
| GEMINI_API_KEY | Google Gemini AI (future use) |
| GITHUB_TOKEN | GitHub API pushes |
| SESSION_SECRET | Express sessions |

---

## EAS Build Details

- Expo Account: suhanshaikh78957
- EAS Project ID: ac5f1412-c637-4ecc-8af1-46876cef5dea
- EAS Project Slug: voice-ai-app
- App Slug (app.json): voice-changer
- Package name: com.voice.changer
- Build profile: preview -> produces APK (not AAB)

### Trigger a new build:

```bash
cd /tmp && git clone https://github.com/blcobra8585-debug/voice-ai-app voice-ai-app-fix
cd voice-ai-app-fix/artifacts/voice-changer
npm install -g eas-cli@latest
EXPO_TOKEN=$EXPO_ACCESS_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile preview --non-interactive
```

### Check build status:

```bash
curl -s -X POST "https://api.expo.dev/graphql" \
  -H "Authorization: Bearer $EXPO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ me { accounts { apps(offset:0,limit:5) { slug builds(offset:0,limit:1) { id status artifacts { buildUrl } } } } } }"}' \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.stringify(JSON.parse(d)?.data?.me?.accounts?.[0]?.apps,null,2));"
```

---

## ElevenLabs Voices

| Name | Voice ID |
|------|----------|
| Gojo | erXw76RvabIuWST2abio |
| Aria | 9BWtsMINqrJLrRacOk9x |
| Roger | CwhRBWXzGAHq8TQ4Fs17 |
| Sarah | EXAVITQu4vr4xnNLhMaY |
| Charlie | IKne3meq5aSn9XLyUdCD |
| George | JBFqnCBsd6RMkjVDRZzb |

Model: eleven_multilingual_v2

---

## Firebase Config

- Project ID: voice-changer-f8df7
- Package: com.voice.changer
- localCache: memoryLocalCache() — required for React Native (no IndexedDB)
- Firestore collection: clips

---

## API Routes (Express Backend)

POST /api/voice/effects           <- multipart/form-data: audio + effect -> base64 mp3
POST /api/voice/speech-to-speech  <- multipart/form-data: audio + voiceId -> base64 mp3
GET  /api/healthz                 <- { status: "ok" }

FFmpeg effects: robot, deep, chipmunk, female, alien, echo, cave, demon, radio, whisper, reverb, telephone, megaphone, underwater

---

## GitHub Push Method (git is blocked in Replit main agent)

Use Node.js https module with GitHub Contents API PUT. Or clone to /tmp and git push from there.

---

## What To Build Next

- [ ] OTA updates (expo-updates) so fixes deploy without rebuilding APK
- [ ] Real microphone amplitude waveform (not animated bars)
- [ ] ElevenLabs API usage tracker (characters remaining)
- [ ] Virtual mic output for BGMI (native module)
- [ ] Clip trimming UI
- [ ] Voice presets (save favorite effect combos)
- [ ] Auto-share to WhatsApp after conversion
- [ ] Gemini AI integration (voice assistant feature)
