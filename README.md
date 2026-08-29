# Spar

**A voice sparring gym for the conversations you're dreading.**

Describe the person across the table — a defensive direct report, a peer who deflects with humour, your own manager — and rehearse the conversation out loud. An AI plays them back, in character, in a real voice, remembering everything you said. A pressure dial replays the same conversation hotter, from *Calm* to *Breaking point*. When the round ends, a coach reads the transcript and shows you exactly where you flinched.

Built in public for [RevenueCat Shipaton 2026](https://revenuecat-shipaton-2026.devpost.com/), shipping to the Samsung Galaxy Store.

**[Download the latest APK →](https://github.com/N-45div/Spar/releases/latest)** (Android, sideload)

## How a round works

1. **Persona** — pick role, temperament and stakes; the app composes "their file". The opening line starts loading while you choose, so the round begins talking instead of spinning.
2. **Round** — hold the mic and talk. Deepgram transcribes you, Sarvam's 105B model answers in character, Deepgram Aura speaks the reply, and a separate coach call whispers your best next move *while she is still talking*. Move the pressure dial mid-round and her temperature changes with it.
3. **Scorecard** — the coach scores clarity, empathy and boundaries, and quotes your real key moments back to you. If the coach can't be reached, the app says so and labels the numbers as estimates rather than inventing feedback.
4. **Gym** — scenario packs for the conversations new managers actually dread: missed deadlines, the raise you can't give, a peer taking credit, letting someone go.
5. **Progress** — every round is saved on the device; watch your form over time.

Three rounds are free; Spar Pro unlocks unlimited rounds and every pack, through RevenueCat.

### Rehearse in Hinglish

A toggle on the persona screen switches the whole round into Hinglish — the counterpart replies in Roman-script Hindi/English the way people actually talk in Indian offices, speaks with Sarvam's Bulbul voice, and is transcribed by Sarvam's Saarika. The coach keeps advising you in English. (Deepgram's English model returns an *empty* transcript for Hinglish speech, which is why the transcription path is language-aware.)

### Built for Galaxy

At 640pt and wider — an unfolded Z Fold, a tablet, landscape, or a multi-window pane — the round becomes a two-pane "tabletop": the counterpart's stage on the left, your corner on the right. Every other screen keeps a centred reading column instead of stretching a phone layout across the fold.

## Stack

| Layer | Choice |
|---|---|
| App | React Native + Expo (SDK 57), TypeScript, React Navigation |
| Voice in | Deepgram Nova-3, or Sarvam Saarika for Hinglish |
| Voice out | Deepgram Aura-2, or Sarvam Bulbul for Hinglish |
| Counterpart + coach | Sarvam `sarvam-105b-conversations` |
| API | Cloudflare Worker (`worker/`) — the only place API keys live |
| Monetization | RevenueCat (`react-native-purchases`, Galaxy Store support) |
| Type | Instrument Serif · Archivo · Space Mono |

The app degrades honestly: with no API reachable it falls back to a scripted counterpart (in the round's language) and the system voice, so the whole loop runs in a browser or Expo Go for development.

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

Everything is driven against the real app in headless Chrome at phone size, with a fake microphone:

```bash
node scripts/qa-e2e.mjs         "<chrome>" "<shots>"   # the full product loop
node scripts/qa-wide-hinglish.mjs "<chrome>" "<shots>" # foldable geometry + Hinglish
node scripts/fold-audit.mjs     "<chrome>" "<shots>"   # every screen at 904x812
node scripts/measure-opener.mjs "<chrome>" 6000 5      # time to first spoken line
cd worker && node test-extract.mjs                     # model-output parsing
```

`scripts/record-demo.mjs` records a demo video and reconstructs the counterpart's voice onto the audio track.

### A note on the model's JSON

`worker/src/index.ts` pins `response_format: json_object`. On the first turn of a round Sarvam sometimes emits `{` followed by a bare string — a value where the key belongs — and, held to JSON grammar, can then never close the object, so it pads whitespace to the token ceiling. Left alone that cost 55–105 s per opening line. The worker caps tokens per endpoint, repairs that exact shape (without mistaking a *key* for the line — see `test-extract.mjs`), and never retries a generation that hit the ceiling.

## License

MIT
