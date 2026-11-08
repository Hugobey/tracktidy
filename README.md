# TrackTidy

Clean metadata, detect BPM, and rename one MP3 at a time. Processing stays in the browser.

```bash
npm install
npm run dev
npm test
```

Open the site, then choose **Clean your first track**. MP3 is the only format this version reads and writes. WAV, AIFF, FLAC, and M4A are refused with an explicit message.

Launch settings that are not code — the GA4 measurement ID, the public site URL, and mail authentication — are listed in `docs/launch-checklist.md`. Copy `.env.example` when you are ready to set them. Analytics does not load until a visitor accepts and `VITE_GA_MEASUREMENT_ID` is set.

Tempo comes from `web-audio-beat-detector` and is folded into 90–180 BPM. Key is a Krumhansl–Schmuckler pitch-class estimate, marked as an estimate. Neither value is invented when detection fails.
