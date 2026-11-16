import { useEffect, useId, useRef, useState } from 'react';
import { PRO_COPY } from '../lib/pro.ts';
import { usePro } from './pro-context.ts';

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function UpgradeModal() {
  const pro = usePro();
  const titleId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(pro.email);
  const [license, setLicense] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeUpgrade = pro.closeUpgrade;
  const savedEmail = pro.email;
  const [seenOpen, setSeenOpen] = useState(false);
  if (pro.modalOpen && !seenOpen) {
    setSeenOpen(true);
    setEmail(savedEmail);
    setNote(null);
    setLicense('');
    setBusy(false);
  } else if (!pro.modalOpen && seenOpen) {
    setSeenOpen(false);
  }

  useEffect(() => {
    if (!pro.modalOpen) return undefined;
    emailRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeUpgrade();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeUpgrade, pro.modalOpen]);

  if (!pro.modalOpen) return null;

  return (
    <div className="pro-layer" role="presentation" onMouseDown={pro.closeUpgrade}>
      <div
        className="pro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="kicker kicker-blue">TrackTidy Pro</p>
        <h2 id={titleId}>{PRO_COPY.modalTitle}</h2>
        <p>{PRO_COPY.modalBody}</p>
        <form
          className="pro-form"
          onSubmit={(event) => {
            event.preventDefault();
            const next = email.trim();
            if (!validEmail(next)) {
              setNote('Enter a valid email address.');
              return;
            }
            const error = pro.startCheckout(next);
            setNote(error);
          }}
        >
          <label className="pro-field">
            <span>Email</span>
            <input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              placeholder={PRO_COPY.emailPlaceholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit">
            {PRO_COPY.checkout}
          </button>
        </form>
        <form
          className="pro-form pro-license"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setNote(null);
            void pro.activate(license).then((error) => {
              setBusy(false);
              setNote(error);
              if (!error) pro.closeUpgrade();
            });
          }}
        >
          <label className="pro-field">
            <span>{PRO_COPY.licenseLabel}</span>
            <input
              type="text"
              name="license"
              autoComplete="off"
              spellCheck={false}
              placeholder="License key"
              value={license}
              onChange={(event) => setLicense(event.target.value)}
            />
          </label>
          <button className="btn btn-secondary" type="submit" disabled={busy || license.trim().length < 8}>
            {busy ? 'Checking…' : PRO_COPY.licenseAction}
          </button>
        </form>
        {note ? <p className="pro-note">{note}</p> : null}
        {!pro.checkoutReady ? (
          <p className="pro-note">Checkout is not connected on this build yet. A license key still activates Pro.</p>
        ) : null}
        {pro.devDemo ? (
          <label className="pro-demo">
            <input type="checkbox" checked={pro.demo} onChange={pro.toggleDemo} />
            <span>{PRO_COPY.demo}</span>
          </label>
        ) : null}
        <button className="btn btn-quiet pro-close" type="button" onClick={pro.closeUpgrade}>
          Close
        </button>
      </div>
    </div>
  );
}
