import { PRO_COPY } from '../lib/pro.ts';
import { usePro } from './pro-context.ts';

export function ProNudge({ onTry }: { onTry: () => void }) {
  const pro = usePro();
  if (pro.pro || pro.nudgeLater) return null;
  return (
    <aside className="pro-nudge" aria-label={PRO_COPY.freePreview} title={PRO_COPY.freePreview}>
      <div>
        <h2>{PRO_COPY.nudgeTitle}</h2>
        <p>{PRO_COPY.nudgeBody}</p>
      </div>
      <div className="pro-nudge-actions">
        <button className="btn btn-primary" type="button" onClick={onTry}>
          {PRO_COPY.nudgeAction}
        </button>
        <button className="btn btn-quiet" type="button" onClick={pro.dismissNudge}>
          {PRO_COPY.nudgeLater}
        </button>
      </div>
    </aside>
  );
}
