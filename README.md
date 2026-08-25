# Spar

**A voice sparring gym for the conversations you're dreading.**

Describe the person across the table — a defensive direct report, a peer who deflects with humor, your own manager — and rehearse the conversation out loud. An AI plays them back, in character, in a real voice, remembering everything you said. A pressure dial replays the same conversation hotter, from *Calm* to *Breaking point*. When the round ends, a coach reads the transcript and shows you exactly where you flinched.

Built in public for [RevenueCat Shipaton 2026](https://revenuecat-shipaton-2026.devpost.com/), shipping to the Samsung Galaxy Store.

## How it works

1. **Persona** — pick role, temperament, and stakes; the app composes "their file."
2. **Round** — hold the mic and talk. Deepgram transcribes you, Sarvam's 105B model answers as the character, Deepgram Aura speaks the reply. Slide the pressure dial mid-round and the character's temperature changes.
3. **Scorecard** — a coach model scores clarity, empathy, and boundaries, and quotes your key moments back to you.
4. **Gym** — scenario packs for the classics: missed deadlines, the raise you can't give, letting someone go.
5. **Progress** — every round is saved locally; watch your form over time.

Three rounds are free; Spar Pro unlocks unlimited rounds and every pack (RevenueCat).

## Stack

| Layer | Choice |
|---|---|
| App | React Native + Expo (SDK 57), TypeScript, React Navigation |
| Voice in / out | Deepgram Nova-3 (STT) and Aura-2 (TTS) via `expo-audio` |
| Counterpart + coach | Sarvam `sarvam-105b-conversations` |
| API | Cloudflare Worker (`worker/`) — the only place API keys live |
| Monetization | RevenueCat (`react-native-purchases`, Galaxy Store support) |
| Type | Instrument Serif · Archivo · Space Mono |

The app degrades gracefully: with no API configured it falls back to a scripted counterpart and the system voice, so the whole loop runs in a browser or Expo Go for development.

## Running it

```bash
npm install
npx expo start          # web preview at http://localhost:8081, or Expo Go on a phone
```

The API lives in `worker/`:

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # add DEEPGRAM_API_KEY and SARVAM_API_KEY
npx wrangler dev                 # local API on :8787
npx wrangler deploy              # production
```

Point the app at your API with `expo.extra.apiBaseUrl` in `app.json`. Purchases need a development build (`npx eas-cli build --profile development --platform android`) and a RevenueCat public SDK key in `expo.extra.revenueCatApiKey`.

## Quality

`scripts/qa-e2e.mjs` drives the real app in headless Chrome at phone size — through a full round with a fake microphone, the scenario packs, the paywall gate, and persistence — and screenshots every screen:

```bash
node scripts/qa-e2e.mjs "<path to chrome>" "<screenshot dir>"
```

## License

MIT
