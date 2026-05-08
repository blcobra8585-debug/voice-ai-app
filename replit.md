# Bella AI — Voice Conversion App

A premium mobile app that converts your voice to Bella's AI voice using ElevenLabs Speech-to-Speech API. Glassmorphic dark UI with cyan neon glows.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port auto-assigned)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, Expo Router v6, React Native 0.81
- API: Express 5
- Voice: ElevenLabs Speech-to-Speech API
- AI: Gemini API (configured, integration pending)
- Auth/DB: Firebase (configured, integration pending)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/voice-ai-app/` — Expo mobile app (preview at `/`)
- `artifacts/api-server/` — Express backend (preview at `/api`)
- `artifacts/voice-ai-app/context/VoiceContext.tsx` — core voice state machine
- `artifacts/voice-ai-app/constants/colors.ts` — dark glassmorphic theme tokens
- `artifacts/api-server/src/routes/voice.ts` — ElevenLabs proxy route
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `AGENT_CONTEXT.md` — **Full context for new agents (read this first!)**

## Architecture decisions

- ElevenLabs API key is proxied through Express backend (never exposed to mobile client)
- Audio is recorded as .m4a via expo-av, converted to MP3 by ElevenLabs, returned as base64
- Single-screen app (no tabs) — voice apps need focused single-screen UX
- AsyncStorage for local history persistence (up to 20 items)
- Dark-only theme (no light mode) — glassmorphic UI requires dark background

## Product

Bella AI lets users record their voice and hear it converted to Bella's premium AI voice in real time. Features include: live waveform visualization, recording history with playback, and a premium glassmorphic interface.

## User preferences

- GitHub: push all changes to `blcobra8585-debug/voice-ai-app` repo automatically
- UI style: Glassmorphic dark, cyan neon (#00E5FF), background #050A14
- Voice: ElevenLabs Bella (EXAVITQu4vr4xnNLhMaY), model: eleven_turbo_v2_5
- Target device: Android 16 (Realme UI 7.0)

## Gotchas

- Always install expo-av before running the mobile app: `pnpm --filter @workspace/voice-ai-app add expo-av expo-file-system`
- Always install multer + form-data for api-server: `pnpm --filter @workspace/api-server add multer form-data`
- NEVER hardcode API keys — all secrets are in Replit Secrets
- Use `restart_workflow` tool to restart Expo — never run `npx expo start` directly

## Secrets Required

| Key | Purpose |
|---|---|
| ELEVENLABS_API_KEY | Voice conversion (ElevenLabs) |
| GEMINI_API_KEY | Google Gemini AI |
| FIREBASE_API_KEY | Firebase auth/db |
| FIREBASE_PROJECT_ID | Firebase project |
| FIREBASE_APP_ID | Firebase app |
| GITHUB_TOKEN | Git push to GitHub |
| SESSION_SECRET | Express sessions |

## Pointers

- See `AGENT_CONTEXT.md` for complete agent onboarding guide
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
