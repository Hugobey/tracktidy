import { decorativePeaks } from '../lib/peaks.ts';
import { Waveform } from './Waveform.tsx';

const PEAKS = decorativePeaks(64);

export function AppPreview() {
  return (
    <div className="preview enter d4" aria-hidden="true">
      <div className="preview-top">
        <p className="kicker">Track analysis</p>
        <span className="pill">Interface</span>
      </div>
      <div className="preview-track">
        <span className="note-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V7.2l10-2v8.35a2.5 2.5 0 1 1-2-2.45V7.1l-6 1.2v9.2Z" fill="currentColor" />
          </svg>
        </span>
        <div>
          <p className="preview-name">Nora Voss — Night Circuit</p>
          <p className="tech-line">MP3 · 320 kbps · 6:42</p>
        </div>
      </div>
      <Waveform peaks={PEAKS} scanning label="Decorative waveform" amplitude={36} compact className="wave-preview" />
      <div className="stat-row">
        <div>
          <strong>124</strong>
          <span>BPM</span>
        </div>
        <div>
          <strong>F#m</strong>
          <span>Key</span>
        </div>
        <div>
          <strong>Deep House</strong>
          <span>Genre</span>
        </div>
      </div>
      <div className="nameplate">
        <p className="kicker">Filename</p>
        <p>Nora Voss - Night Circuit (124 BPM) [F#m].mp3</p>
      </div>
    </div>
  );
}
