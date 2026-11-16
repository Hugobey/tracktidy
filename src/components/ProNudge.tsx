import { PRO_COPY } from '../lib/pro.ts';
import { usePro } from './pro-context.ts';

export function ProNudge() {
  const pro = usePro();
  if (!pro.nudgeVisible) return null;
  return (
    <aside className="pro-nudge" aria-label="Pro preview">
      <div>
        <h2>{PRO_COPY.nudgeTitle}</h2>
        <p>{PRO_COPY.nudgeBody}</p>
      </div>
      <div className="pro-nudge-actions">
        <button className="btn btn-primary" type="button" onClick={pro.openUpgrade}>
          {PRO_COPY.nudgeAction}
        </button>
        <button className="btn btn-quiet" type="button" onClick={pro.dismissNudge}>
          {PRO_COPY.nudgeLater}
        </button>
      </div>
    </aside>
  );
}
