import { Link } from 'react-router-dom';
import { PRO_COPY } from '../lib/pro.ts';
import { LIBRARY_PATH } from '../lib/library-demo.ts';

export function CrateNudge({ onOpen }: { onOpen?: () => void }) {
  return (
    <aside className="crate-nudge crate-toast" role="status" aria-label="Crate Library">
      <p>{PRO_COPY.crateNudge}</p>
      {onOpen ? (
        <button className="btn btn-secondary" type="button" onClick={onOpen}>
          {PRO_COPY.crateNudgeAction}
        </button>
      ) : (
        <Link className="btn btn-secondary" to={LIBRARY_PATH}>
          {PRO_COPY.crateNudgeAction}
        </Link>
      )}
    </aside>
  );
}
