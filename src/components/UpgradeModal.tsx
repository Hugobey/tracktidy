import { useEffect, useId, useRef, useState } from 'react';
import { PRO_COPY } from '../lib/pro.ts';
import { usePro } from './pro-context.ts';

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const PERKS = [PRO_COPY.perkBatch, PRO_COPY.perkGrid, PRO_COPY.perkNames, PRO_COPY.perkZip] as const;

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 8.4 6.4 11.3 12.5 4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UpgradeModal() {
  const pro = usePro();
  const titleId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(pro.email);
  const [restoreEmail, setRestoreEmail] = useState(pro.email);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeUpgrade = pro.closeUpgrade;
  const savedEmail = pro.email;
  const [seenOpen, setSeenOpen] = useState(false);

  if (pro.modalOpen && !seenOpen) {
    setSeenOpen(true);
    setEmail(savedEmail);
    setRestoreEmail(savedEmail);
    setNote(null);
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
        className="pro-modal pro-upgrade"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="kicker">Track Tidy Pro</p>
        <h2 id={titleId}>{PRO_COPY.modalTitle}</h2>

        {/* Lifetime price */}
        <div className="pro-price" aria-label="$19 lifetime">
          <span className="pro-price-amount">$19</span>
          <span className="pro-price-term">lifetime</span>
        </div>

        <p className="pro-price-sub">
          Pay once. Own Track Tidy Pro forever.
        </p>

        <ul className="pro-perks">
          {PERKS.map((perk) => (
            <li key={perk}>
              <CheckIcon />
              <span>{perk}</span>
            </li>
          ))}
        </ul>

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
          <button
            className="btn btn-primary"
            type="button"
            disabled={!validEmail(email)}
            onClick={() => {
              const paymentLink = import.meta.env.PROD
                ? 'https://buy.stripe.com/28EcN6f1m53s94cchr1RC01' // Live
                : 'https://buy.stripe.com/test_eVqeVe5qMgMa5S0a9j1RC00';     // Test

              window.location.href = paymentLink;
            }}
          >
  Get Lifetime Access
</button>
        </form>

        <form
          className="pro-form pro-restore"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setNote(null);
            const next = restoreEmail.trim();
            if (!validEmail(next)) {
              setNote('Enter a valid email address.');
              setBusy(false);
              return;
            }
            void pro.restore(next).then((error) => {
              setBusy(false);
              setNote(error);
              if (!error) pro.closeUpgrade();
            });
          }}
        >
          <label className="pro-field">
            <span>{PRO_COPY.restoreLabel}</span>
            <input
              type="email"
              name="restore-email"
              autoComplete="email"
              placeholder={PRO_COPY.emailPlaceholder}
              value={restoreEmail}
              onChange={(event) => setRestoreEmail(event.target.value)}
            />
          </label>
          <button
            className="btn btn-secondary"
            type="submit"
            disabled={busy || !validEmail(restoreEmail)}
          >
            {busy ? 'Checking…' : PRO_COPY.restoreAction}
          </button>
        </form>

        {note ? <p className="pro-note">{note}</p> : null}

        {/* {!pro.checkoutReady ? (
          <p className="pro-note">Checkout is not connected on this build yet.</p>
        ) : null} */}

        <div className="pro-footer-actions">
          {/* <button
            className="pro-pill"
            type="button"
            aria-pressed={pro.pro}
            onClick={pro.toggleDemo}
          >
            {PRO_COPY.demo}
          </button> */}
          <button className="btn btn-quiet pro-close" type="button" onClick={pro.closeUpgrade}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}