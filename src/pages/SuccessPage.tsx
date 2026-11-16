import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { Logo } from '../components/Logo.tsx';
import { ProAccount } from '../components/ProAccount.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { SiteNav } from '../components/SiteNav.tsx';
import { usePro } from '../components/pro-context.ts';
import { isProUser } from '../lib/pro.ts';

const flights = new Map<string, Promise<string | null>>();
let queuedKey = '';

function activateLicenseOnce(key: string, activate: (license: string) => Promise<string | null>): Promise<string | null> {
  const mark = `tt_activation_${key}`;
  try {
    if (sessionStorage.getItem(mark) === 'done' && isProUser()) return Promise.resolve(null);
  } catch {
    /* Private mode still tries the request once. */
  }
  const existing = flights.get(key);
  if (existing) return existing;
  try {
    sessionStorage.setItem(mark, 'pending');
  } catch {
    /* The in-memory flight map still blocks a second call in this tab. */
  }
  const promise = activate(key).then((error) => {
    try {
      if (error) sessionStorage.removeItem(mark);
      else sessionStorage.setItem(mark, 'done');
    } catch {
      /* The unlock still lives in local storage when that write succeeded. */
    }
    flights.delete(key);
    return error;
  });
  flights.set(key, promise);
  return promise;
}

function activationQueued(): boolean {
  if (queuedKey) return true;
  if (typeof window === 'undefined') return false;
  return Boolean(new URL(window.location.href).searchParams.get('license_key')?.trim());
}

export default function SuccessPage() {
  const pro = usePro();
  const [note, setNote] = useState(() =>
    activationQueued()
      ? 'Checking the license key…'
      : 'Paste a license key from a receipt, or restore the purchase with your email from Upgrade to Pro.',
  );
  const [license, setLicense] = useState('');
  const [busy, setBusy] = useState(activationQueued);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('license_key')?.trim() ?? '';
    if (fromQuery) {
      url.searchParams.delete('license_key');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      queuedKey = fromQuery;
    }
    const key = fromQuery || queuedKey;
    if (!key) return undefined;
    let cancelled = false;
    void activateLicenseOnce(key, pro.activate).then((error) => {
      if (cancelled) return;
      if (!error) queuedKey = '';
      setBusy(false);
      setNote(error ?? 'Pro is active on this browser.');
    });
    return () => {
      cancelled = true;
    };
  }, [pro.activate]);

  return (
    <div className="page">
      <SiteHead
        title="TrackTidy Pro activation"
        description="Activate a TrackTidy Pro license on this browser."
        path="/success"
        index={false}
      />
      <Atmosphere />
      <header className="nav">
        <div className="wrap nav-inner">
          <Link to="/" className="logo-link" aria-label="TrackTidy, home">
            <Logo />
          </Link>
          <SiteNav />
          <ProAccount />
        </div>
      </header>
      <main id="content" className="legal-main">
        <article className="wrap legal-card pro-success">
          <p className="kicker kicker-blue">TrackTidy Pro</p>
          <h1>Activate Pro</h1>
          <p>{note}</p>
          {pro.pro ? (
            <p>
              <Link to="/app">Open the editor</Link>
            </p>
          ) : (
            <form
              className="pro-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (busy) return;
                setBusy(true);
                void pro.activate(license).then((error) => {
                  setBusy(false);
                  setNote(error ?? 'Pro is active on this browser.');
                });
              }}
            >
              <label className="pro-field">
                <span>License key</span>
                <input
                  value={license}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setLicense(event.target.value)}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy || license.trim().length < 8}>
                {busy ? 'Checking…' : 'Activate'}
              </button>
            </form>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
