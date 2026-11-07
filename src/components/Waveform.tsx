import { useReducedMotion } from '../hooks/useReducedMotion.ts';

type Props = {
  peaks: number[];
  scanning: boolean;
  label: string;
  amplitude?: number;
  compact?: boolean;
  className?: string;
};

export function Waveform({ peaks, scanning, label, amplitude = 78, compact = false, className }: Props) {
  const reduced = useReducedMotion();
  const cls = ['wave', compact ? 'wave-compact' : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls} role="img" aria-label={label}>
      {peaks.map((peak, index) => (
        <span
          key={index}
          className="bar"
          style={{ height: `${Math.max(2, Math.round(peak * amplitude))}px` }}
        />
      ))}
      {scanning ? <span className={reduced ? 'scan scan-still' : 'scan'} /> : null}
    </div>
  );
}
