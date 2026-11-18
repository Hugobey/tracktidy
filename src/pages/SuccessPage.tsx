import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { Logo } from '../components/Logo.tsx';
import { ProAccount } from '../components/ProAccount.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { SiteNav } from '../components/SiteNav.tsx';
import { usePro } from '../components/pro-context.ts';
import { checkoutReturnPath, isCheckoutSessionId } from '../lib/pro.ts';

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SuccessPage() {
  const pro = usePro();
  const navigate = useNavigate();
  const { search } = useLocation();
  const sessionId = (() => {
    const value = new URLSearchParams(search).get('session_id')?.trim() ?? '';
    return isCheckoutSessionId(value) ? value : null;
  })();
  const [email, setEmail] = useState(pro.email);
  const [note, setNote] = useState('Restore Track Tidy Pro Lifetime with the email from your Stripe receipt.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    navigate(checkoutReturnPath(sessionId), { replace: true });
  }, [navigate, sessionId]);

  return (
    <div className="page">
      <SiteHead
        title="TrackTidy Pro"
        description="Restore Track Tidy Pro Lifetime on this browser with your Stripe email."
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
          <p className="kicker kicker-blue">Track Tidy Pro</p>
          <h1>{sessionId ? 'Track Tidy Pro' : 'Restore Track Tidy Pro'}</h1>
          {sessionId ? (
            <p>Payment received. Opening your crate.</p>
          ) : (
            <p>{note}</p>
          )}
          {sessionId ? null : pro.pro ? (
            <p>
              <Link to="/pro">Open Crate Library</Link>
            </p>
          ) : (
            <form
              className="pro-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (busy) return;
                const next = email.trim();
                if (!validEmail(next)) {
                  setNote('Enter a valid email address.');
                  return;
                }
                setBusy(true);
                void pro.restore(next).then((error) => {
                  setBusy(false);
                  setNote(error ?? 'Track Tidy Pro Lifetime is active on this browser.');
                });
              }}
            >
              <label className="pro-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy || !validEmail(email)}>
                {busy ? 'Checking…' : 'Restore Track Tidy Pro'}
              </button>
            </form>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
