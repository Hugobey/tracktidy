import { Link } from 'react-router-dom';
import { PUBLISHER } from '../legal/publisher.ts';
import { Logo } from './Logo.tsx';
import { useConsent } from './consent-context.ts';

export function SiteFooter() {
  const { openSettings } = useConsent();

  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link to="/" className="logo-link" aria-label="TrackTidy, home">
            <Logo />
          </Link>
          <p>Clean metadata, detect BPM, and rename one MP3 at a time. In the browser. No account.</p>
          <p>
            <a href={`mailto:${PUBLISHER.hello}`}>{PUBLISHER.hello}</a>
          </p>
        </div>
        <nav className="footer-links" aria-label="Pages">
          <p className="footer-label">Navigate</p>
          <Link to="/">Home</Link>
          <Link to="/#upload">Clean a track</Link>
          <Link to="/#method">How it works</Link>
          <Link to="/#capabilities">Features</Link>
          <Link to="/guides">Guides</Link>
        </nav>
        <nav className="footer-links" aria-label="Legal">
          <p className="footer-label">Legal</p>
          <Link to="/legal-notice">Legal notice</Link>
          <Link to="/privacy-policy">Privacy policy</Link>
          <Link to="/terms-of-use">Terms of use</Link>
          <Link to="/cookie-policy">Cookie policy</Link>
          <button type="button" onClick={openSettings}>
            Cookie settings
          </button>
        </nav>
      </div>
    </footer>
  );
}
