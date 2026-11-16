import { useEffect, useId, useState } from 'react';
import { PRO_COPY } from '../lib/pro.ts';
import { usePro } from './pro-context.ts';

export function ProAccount() {
  const pro = usePro();
  const menuId = useId();
  const [open, setOpen] = useState(false);

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
        <button className="pro-link" type="button" onClick={pro.openUpgrade}>
          {PRO_COPY.upgrade}
        </button>
        {pro.devDemo ? (
          <button className="pro-link" type="button" aria-pressed={pro.demo} onClick={pro.toggleDemo}>
            {PRO_COPY.demo}
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="pro-account">
      <button
        className="pro-badge"
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {PRO_COPY.active}
        {pro.demo ? <span className="pro-demo-mark">Demo</span> : null}
      </button>
      {open ? (
        <span className="pro-pop" id={menuId} role="menu">
          {pro.email ? <span className="pro-pop-email">{pro.email}</span> : null}
          <a href={pro.portalUrl} target="_blank" rel="noreferrer">
            {PRO_COPY.billing}
          </a>
          <button type="button" onClick={pro.signOut}>
            {PRO_COPY.signOut}
          </button>
          {pro.devDemo ? (
            <button type="button" aria-pressed={pro.demo} onClick={pro.toggleDemo}>
              {PRO_COPY.demo}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
