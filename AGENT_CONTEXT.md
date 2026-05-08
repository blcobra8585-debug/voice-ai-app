# Agent Context — Gojo Voice (Voice AI App)

> **Read this file first if you are a new agent picking up this project.**
> It gives you the complete picture: what is built, what secrets exist, how to run, and what to do next.

---

## What This App Does

**Gojo Voice** is a premium mobile voice changer app built with Expo (React Native).

The user taps a glowing record button → records their voice → picks an effect:
- **Gojo AI**: Sends audio to ElevenLabs Speech-to-Speech API → converts to **Antoni voice** (Gojo Satoru style Hindi voice) using `eleven_multilingual_v2` model
- **Other effects** (Robot, Deep, Chipmunk, etc.): Processed via Express backend using FFmpeg

The UI is a **Glassmorphic Dark** design with cyan neon glows on a deep navy background (`#050A14`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | Expo (React Native) — SDK 54, Expo Router v6 |
| Backend API | Express 5 + TypeScript (Node 24) — FFmpeg effects only |
| Voice AI | ElevenLabs Speech-to-Speech — Antoni voice |
| Database | Firebase Firestore (clip history sync) |
| Storage | Local AsyncStorage + Firebase Firestore metadata |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── voice-ai-app/           ← Expo mobile app
│   │   ├── app/
│   │   │   ├── _layout.tsx     ← Root layout (dark bg, providers)
│   │   │   └── index.tsx       ← Main screen
│   │   ├── components/
│   │   │   ├── RecordButton.tsx
│   │   │   ├── WaveformVisualizer.tsx
│   │   │   ├── GlassCard.tsx
│   │   │   ├── EffectGrid.tsx
│   │   │   ├── HistoryList.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ErrorFallback.tsx
│   │   ├── context/
│   │   │   └── VoiceContext.tsx  ← Recording + ElevenLabs + Firebase
│   │   ├── lib/
│   │   │   └── firebase.ts       ← Firebase init (Firestore)
│   │   ├── constants/
│   │   │   └── colors.ts
│   │   ├── hooks/
│   │   │   └── useColors.ts
│   │   ├── google-services.json  ← Firebase Android config
│   │   └── eas.json              ← EAS build config (APK)
│   │
│   └── api-server/               ← Express backend (FFmpeg effects)
│       └── src/
│           ├── routes/
│           │   ├── index.ts      ← Mounts health + voice routers
│           │   ├── health.ts     ← GET /api/healthz
│           │   └── voice.ts     ← POST /api/voice/speech-to-speech + /api/voice/effects
│           └── app.ts
│
├── AGENT_CONTEXT.md              ← THIS FILE
└── replit.md
```

---

## Environment Secrets (All in Replit Secrets)

| Secret Key | Used For | Where |
|---|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs Speech-to-Speech | api-server backend |
| `GEMINI_API_KEY` | Google Gemini AI (future) | api-server backend |
| `FIREBASE_API_KEY` | Firebase (embedded in lib/firebase.ts) | mobile app |
| `GITHUB_ACCESS_TOKEN` | GitHub pushes | git operations |
| `SESSION_SECRET` | Express sessions | api-server |

---

## ElevenLabs Voice Config

- **Voice**: Antoni (`erXw76RvabIuWST2abio`) — Gojo Satoru style Hindi
- **Model**: `eleven_multilingual_v2` — speaks Hindi perfectly
- **Stability**: `0.4`
- **Similarity Boost**: `0.85`
- **Endpoint**: `POST /api/voice/speech-to-speech`

---

## Firebase Config

- **Project ID**: `voice-changer-d5266`
- **Package Name**: `com.voice.changer`
- **Storage Bucket**: `voice-changer-d5266.firebasestorage.app`
- **Config file**: `artifacts/voice-ai-app/google-services.json`
- **lib/firebase.ts**: Initialized with memoryLocalCache (no IndexedDB dependency)

### ⚠️ Firebase Setup Required

User needs to enable in Firebase Console:
1. **Firestore Database** → Create in test mode
2. **Firebase Storage** → Get started in test mode

URL: https://console.firebase.google.com/project/voice-changer-d5266

---

## Voice Conversion Flow

```
User taps record → expo-av records mic (HIGH_QUALITY, .m4a)
User taps stop → audio URI saved
User selects "Gojo AI" effect:
  → FormData posted to POST /api/voice/speech-to-speech
  → Express backend (voice.ts) forwards to ElevenLabs
  → Returns base64 MP3
  → App writes to local cache dir
  → expo-av plays back
  → Clip saved to AsyncStorage + Firestore (if enabled)

User selects other effect (Robot/Deep/etc.):
  → FormData + effect name posted to POST /api/voice/effects
  → Express backend runs FFmpeg
  → Returns base64 MP3
  → Same playback + save flow
```

---

## Building the APK

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Build APK (from artifacts/voice-ai-app/)
cd artifacts/voice-ai-app
eas build --platform android --profile preview
```

APK will be available to download from expo.dev dashboard.

---

## How to Run Dev Server

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start Expo app (via Replit workflow)
# Use restart_workflow tool: "artifacts/voice-ai-app: expo"

# Full typecheck
pnpm run typecheck
```

---

## GitHub Repository

- **Repo**: `https://github.com/blcobra8585-debug/voice-ai-app`
- **Branch**: `main`
- **Push command**: `git add -A && git commit -m "update" && git push origin main`

---

## Current Status

- [x] Expo mobile app — Gojo Voice UI (dark glassmorphic)
- [x] ElevenLabs voice route — Antoni voice, eleven_multilingual_v2, stability 0.4
- [x] FFmpeg effects route — 10 effects (robot, deep, chipmunk, etc.)
- [x] Voice router mounted in api-server
- [x] multer + form-data installed in api-server
- [x] expo-av + expo-file-system + expo-sharing installed
- [x] Firebase config (google-services.json) added
- [x] Firebase Firestore integration (graceful fallback if not enabled)
- [x] TypeScript — zero errors
- [x] eas.json — APK build ready
- [x] Package name: com.voice.changer
- [ ] Firebase Firestore — needs user to enable in console
- [ ] APK build — needs `eas login` + `eas build`

---

## Pending Work

1. **Firebase enable** — User opens console.firebase.google.com → Enable Firestore + Storage
2. **EAS APK build** — Run `eas build --platform android --profile preview`
3. **Gemini integration** — Add AI assistant feature
4. **Real-time waveform** — Live level metering during recording
