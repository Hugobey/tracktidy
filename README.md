# TrackTidy

Clean metadata, detect BPM, and rename one MP3 at a time. Processing stays in the browser.

```bash
npm install
npm run dev
npm test
```

Open the site, then choose **Clean your first track**. MP3 is the only format this version reads and writes. WAV, AIFF, FLAC, and M4A are refused with an explicit message.

Tempo comes from `web-audio-beat-detector` and is folded into 90–180 BPM. Key is a Krumhansl–Schmuckler pitch-class estimate, marked as an estimate. Neither value is invented when detection fails.
