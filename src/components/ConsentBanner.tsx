import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useConsent } from './consent-context.ts';

export function ConsentBanner() {
  const { status, panelOpen, accept, reject, closeSettings } = useConsent();
  const rejectRef = useRef<HTMLButtonElement>(null);
  const openedFromSettings = useRef(false);

  useEffect(() => {
    if (!panelOpen) {
      openedFromSettings.current = false;
      return undefined;
    }
    if (status !== 'unknown') {
      openedFromSettings.current = true;
      rejectRef.current?.focus();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || status === 'unknown') return;
      event.preventDefault();
      event.stopPropagation();
      closeSettings();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [closeSettings, panelOpen, status]);

  if (!panelOpen) return null;

  const choice = status === 'unknown' ? 'You have not chosen yet.' : `Current choice: ${status}.`;

  return (
    <div className="consent" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-copy">
      <p id="consent-title" className="consent-title">
        Analytics cookies
      </p>
      <p id="consent-copy">
        {choice} TrackTidy can record which pages and actions are used. Audio, filenames, and metadata stay on this
        device. Optional Analytics 4 cookies are set only after you accept. The page also loads a Google Tag Manager
        container.{' '}
        <Link to="/cookie-policy">Cookie policy</Link>
        {' · '}
        <Link to="/privacy-policy">Privacy policy</Link>
      </p>
      <div className="consent-actions">
        <button ref={rejectRef} type="button" className="btn btn-choice" id="consent-reject" onClick={reject}>
          Reject
        </button>
        <button type="button" className="btn btn-choice" id="consent-accept" onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
}
