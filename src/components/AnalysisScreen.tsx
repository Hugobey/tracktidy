import { decorativePeaks } from '../lib/peaks.ts';
import { useReducedMotion } from '../hooks/useReducedMotion.ts';
import { Waveform } from './Waveform.tsx';

export type StageState = 'wait' | 'run' | 'done' | 'warn';

export type Stage = {
  label: string;
  detail: string;
  state: StageState;
};

type Props = {
  name: string;
  peaks: number[] | null;
  scanning: boolean;
  stages: Stage[];
  onEdit?: () => void;
};

const FALLBACK = decorativePeaks(64);

function lanePeaks(source: number[], offset: number) {
  const count = 52;
  const peaks: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = Math.floor((((index + offset) % count) / count) * source.length) % source.length;
    peaks.push(source[at] ?? 0.2);
  }
  return peaks;
}

export function AnalysisScreen({ name, peaks, scanning, stages, onEdit }: Props) {
  const reduced = useReducedMotion();
  const source = peaks && peaks.length > 0 ? peaks : FALLBACK;
  const finished = stages.filter((stage) => stage.state === 'done' || stage.state === 'warn').length;
  const running = stages.some((stage) => stage.state === 'run');
  const progress = Math.min(100, ((finished + (running ? 0.4 : 0)) / stages.length) * 100);

  return (
    <section className="analyze" aria-live="polite">
      <span className="corner corner-tl" aria-hidden="true" />
      <span className="corner corner-br" aria-hidden="true" />
      <div className="analyze-panel">
        <div className="lanes">
          {stages.map((stage, index) => (
            <div key={stage.label} className={`lane lane-${stage.state}`}>
              <span className="lane-label">{stage.label}</span>
              <Waveform
                peaks={lanePeaks(source, index * 7)}
                scanning={scanning && stage.state === 'run'}
                label={`${stage.label}: ${stage.detail}`}
                amplitude={28}
                compact
                className="wave-lane"
              />
            </div>
          ))}
        </div>
        <div className="stage-rail" aria-hidden="true">
          <span className="stage-fill" style={{ width: `${progress}%` }} />
          {stages.map((stage) => (
            <span key={stage.label} className={`stage-dot stage-dot-${stage.state}`} />
          ))}
        </div>
        <ol className="stage-names">
          {stages.map((stage) => (
            <li key={stage.label} className={`stage-name stage-name-${stage.state}`}>
              {stage.label}
            </li>
          ))}
        </ol>
        <p className="analyze-status">
          <span className={reduced ? 'live-dot live-dot-still' : 'live-dot'} />
          {running || finished < stages.length ? 'Analyzing audio' : 'Analysis ready'}
        </p>
        <p className="analyze-file">{name}</p>
        <p className="analyze-note">This usually takes a few seconds.</p>
        {onEdit ? (
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            Edit now
          </button>
        ) : null}
      </div>
    </section>
  );
}
