import { useContext, useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PRO_COPY } from '../lib/pro.ts';
import { TrackSessionContext } from '../session/session-context.ts';
import { usePro } from './pro-context.ts';

export function ProAccount() {
  const pro = usePro();
  const session = useContext(TrackSessionContext);
  const { pathname } = useLocation();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const library =
    session && session.phase === 'edit' && session.track && pathname !== '/pro' ? (
      <button className="pro-link" type="button" onClick={session.openCrate}>
        {PRO_COPY.library}
      </button>
    ) : (
      <Link to="/pro" className="pro-link" aria-current={pathname === '/pro' ? 'page' : undefined}>
        {PRO_COPY.library}
      </Link>
    );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!pro.pro) {
    return (
      <span className="pro-account">
        {library}
        <button className="pro-link" type="button" title={PRO_COPY.active} onClick={() => pro.openUpgrade()}>
          {PRO_COPY.upgrade}
        </button>
      </span>
    );
  }

  return (
    <span className="pro-account">
      {library}
      <button
        className="pro-badge"
        type="button"
        title={PRO_COPY.active}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {PRO_COPY.active}
      </button>
      {open ? (
        <span className="pro-pop" id={menuId} role="menu">
          {pro.email ? <span className="pro-pop-email">{pro.email}</span> : null}
          <button type="button" onClick={pro.signOut}>
            {PRO_COPY.signOut}
          </button>
        </span>
      ) : null}
    </span>
  );
}
