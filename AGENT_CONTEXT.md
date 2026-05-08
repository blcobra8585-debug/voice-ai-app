# Agent Context — Voice AI App (Bella)

> **Read this file first if you are a new agent picking up this project.**
> It gives you the complete picture: what is built, what secrets exist, how to run, and what to do next.

---

## What This App Does

**Bella AI** is a premium mobile voice conversion app built with Expo (React Native).

The user taps a glowing record button → records their voice → the audio is sent to ElevenLabs Speech-to-Speech API → their voice is converted to **Bella's voice** (ElevenLabs Voice ID: `EXAVITQu4vr4xnNLhMaY`) using the `eleven_turbo_v2_5` model → the converted audio plays back automatically.

The UI is a **Glassmorphic Dark** design with cyan neon glows on a deep navy background (`#050A14`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | Expo (React Native) — SDK 54, Expo Router v6 |
| Backend API | Express 5 + TypeScript (Node 24) |
| Voice API | ElevenLabs Speech-to-Speech |
| AI (future) | Gemini API |
| Auth/DB (future) | Firebase |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
workspace/
├── artifacts/
│   ├── voice-ai-app/           ← Expo mobile app (preview at /)
│   │   ├── app/
│   │   │   ├── _layout.tsx     ← Root layout (dark bg, providers)
│   │   │   └── index.tsx       ← Main screen (single screen, no tabs)
│   │   ├── components/
│   │   │   ├── RecordButton.tsx      ← Large glowing record button
│   │   │   ├── WaveformVisualizer.tsx ← Animated audio waveform
│   │   │   ├── GlassCard.tsx          ← Glassmorphic card component
│   │   │   └── HistoryList.tsx        ← Playback history list
│   │   ├── context/
│   │   │   └── VoiceContext.tsx  ← Recording state + ElevenLabs API calls
│   │   ├── constants/
│   │   │   └── colors.ts         ← Dark glassmorphic theme (cyan on #050A14)
│   │   ├── hooks/
│   │   │   └── useColors.ts      ← Color hook (always dark mode)
│   │   └── assets/images/
│   │       └── icon.png          ← Generated cyan neon mic icon
│   │
│   └── api-server/               ← Express backend (preview at /api)
│       └── src/
│           ├── routes/
│           │   ├── index.ts      ← Mounts all routers
│           │   ├── health.ts     ← GET /api/healthz
│           │   └── voice.ts      ← POST /api/voice/speech-to-speech
│           └── app.ts            ← Express app setup
│
├── lib/
│   └── api-spec/openapi.yaml     ← OpenAPI spec (health only for now)
│
├── AGENT_CONTEXT.md              ← THIS FILE
└── replit.md                     ← Project README
```

---

## Environment Secrets (All Stored in Replit Secrets)

| Secret Key | Used For | Where |
|---|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs Speech-to-Speech | api-server backend |
| `GEMINI_API_KEY` | Google Gemini AI (future) | api-server backend |
| `FIREBASE_API_KEY` | Firebase (future) | mobile app |
| `FIREBASE_PROJECT_ID` | Firebase project (future) | mobile app |
| `FIREBASE_APP_ID` | Firebase app (future) | mobile app |
| `GITHUB_TOKEN` | GitHub pushes | git operations |
| `SESSION_SECRET` | Express sessions | api-server |

**NEVER hardcode these values. Always use `process.env.VARIABLE_NAME`.**

---

## ElevenLabs API Details

- **Endpoint:** `POST https://api.elevenlabs.io/v1/speech-to-speech/{voice_id}`
- **Voice ID (Bella):** `EXAVITQu4vr4xnNLhMaY`
- **Model:** `eleven_turbo_v2_5` (fastest)
- **Auth header:** `xi-api-key: {ELEVENLABS_API_KEY}`
- **Request body:** multipart/form-data with `audio` file + `model_id`
- **Backend proxy:** Mobile sends audio to `/api/voice/speech-to-speech` → backend forwards to ElevenLabs → returns base64 audio

---

## Voice Conversion Flow

```
User taps record button
  → expo-av records mic audio (HIGH_QUALITY preset, .m4a)
  → User taps again to stop
  → FormData uploaded to POST /api/voice/speech-to-speech
  → Express backend (voice.ts) receives audio via multer
  → Forwards to ElevenLabs API with xi-api-key header
  → ElevenLabs returns MP3 audio
  → Backend converts to base64, returns { audio, mimeType }
  → Mobile writes base64 to FileSystem.cacheDirectory
  → expo-av Sound plays the file
  → History item saved to AsyncStorage
```

---

## How to Run

```bash
# Install dependencies
pnpm install

# Start API server
pnpm --filter @workspace/api-server run dev

# Start Expo app (via Replit workflow)
# Use restart_workflow tool: "artifacts/voice-ai-app: expo"

# Full typecheck
pnpm run typecheck

# Push to GitHub
git add -A && git commit -m "update" && git push origin main
```

---

## GitHub Repository

- **Repo:** `https://github.com/blcobra8585-debug/voice-ai-app`
- **Auto-push:** Git is configured with token auth
- **Branch:** `main`

---

## Current Status (as of last agent session)

- [x] Expo mobile app scaffolded
- [x] Dark glassmorphic theme (cyan on #050A14)
- [x] ElevenLabs voice proxy route (POST /api/voice/speech-to-speech)
- [x] RecordButton with glow animations (Reanimated)
- [x] WaveformVisualizer with 32 animated bars
- [x] VoiceContext with full state machine (idle/recording/processing/playing/error)
- [x] HistoryList with play/delete
- [x] GitHub repo created and configured
- [ ] expo-av package install (run: `pnpm --filter @workspace/voice-ai-app add expo-av expo-file-system`)
- [ ] multer package install (run: `pnpm --filter @workspace/api-server add multer form-data`)
- [ ] Gemini AI integration (key is ready)
- [ ] Firebase integration (keys are ready)
- [ ] Android permissions in app.json (RECORD_AUDIO)

---

## Pending Work / Next Steps

1. **Gemini integration** — Add AI chat or voice description feature using `GEMINI_API_KEY`
2. **Firebase** — Add user accounts, cloud history sync using Firebase keys
3. **Voice Settings screen** — Let user pick different ElevenLabs voices
4. **Real-time waveform** — Use Audio.Recording.getStatusAsync() for live level metering
5. **Android build test** — Verify RECORD_AUDIO permission works on Android 16

---

## Design Language

- **Background:** `#050A14` (deep navy black)
- **Primary / Accent:** `#00E5FF` (cyan neon)
- **Recording state:** `#FF1744` (electric red)
- **Processing state:** `#FFEA00` (electric yellow)
- **Glass surfaces:** `rgba(0,229,255,0.05)` background + `rgba(0,229,255,0.15)` border
- **Font:** Inter (400/500/600/700) from @expo-google-fonts/inter
- **Radius:** 16px globally

---

## Common Commands for Agents

```bash
# Install new expo package
pnpm --filter @workspace/voice-ai-app add <package>

# Install new api-server package
pnpm --filter @workspace/api-server add <package>

# Push to GitHub
git add -A && git commit -m "feat: <description>" && git push origin main

# Run typecheck
pnpm run typecheck

# Rebuild api-server
pnpm --filter @workspace/api-server run build
```
