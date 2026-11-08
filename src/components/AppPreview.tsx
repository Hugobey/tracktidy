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
          <p className="kicker">Original</p>
          <p className="preview-name">y2mate.com_Nora Voss_Night Circuit [f8K2p9xL].mp3</p>
          <p className="tech-line">MP3 · 320 kbps · 6:42</p>
        </div>
      </div>
      <div className="nameplate nameplate-result">
        <p className="kicker kicker-blue">Cleaned result</p>
        <p>Nora Voss - Night Circuit.mp3</p>
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
    </div>
  );
}
