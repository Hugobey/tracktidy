import { Link } from 'react-router-dom';
import { LegalLayout } from '../components/LegalLayout.tsx';
import { PUBLISHER } from '../legal/publisher.ts';

const DESCRIPTION = 'The storage and cookies TrackTidy uses, and how to accept or reject analytics.';

export default function CookiePolicyPage() {
  return (
    <LegalLayout
      title="Cookie policy — TrackTidy"
      description={DESCRIPTION}
      path="/cookie-policy"
      kicker="Cookies"
      heading="Cookie policy"
    >
      <p>Last updated: 8 November 2026.</p>
      <p>
        This page lists only the storage the site uses. Analytics cookies are optional. The banner offers Accept and
        Reject at the same time. Cookie settings in the footer opens that choice again.
      </p>

      <h2>Necessary storage</h2>
      <p>These items are not advertising cookies. They stay on your device.</p>
      <ul>
        <li>
          <code>tracktidy.consent</code> in local storage. Values: accepted or rejected. Purpose: remember your
          analytics choice so the optional Google Analytics 4 script is not loaded after a refusal. Duration: until you
          change it or clear site data.
        </li>
        <li>
          <code>tracktidy.template</code> in local storage. Purpose: remember your filename pattern. Duration: until
          you replace it or clear site data. It is not sent to analytics.
        </li>
      </ul>
      <p>
        TrackTidy does not set its own cookie before you accept analytics. The page head loads Google Tag Manager
        container GTM-TWVDH6V3 when the page opens, so that request reaches Google before a choice. Cookies set by
        tags inside that container depend on the container configuration.
      </p>

      <h2>Analytics cookies</h2>
      <p>
        Loaded only after you press Accept, and only when the site is configured with a Google Analytics 4
        measurement ID. Provider: Google. Purpose: page views and the product actions described in the privacy
        policy. Advertising and personalization storage stay off.
      </p>
      <ul>
        <li>
          <code>_ga</code>. Distinguishes browsers. Google commonly keeps it for up to two years.
        </li>
        <li>
          <code>_ga_</code> followed by the measurement id. Keeps session state. Google commonly keeps it for up to
          two years.
        </li>
      </ul>
      <p>
        No other analytics vendor is named in this application. The tag manager container can load the tags configured
        for it. Rejecting, or changing your mind in Cookie
        settings, stops collection and clears the analytics cookies this site can remove. You can also block or
        delete cookies in your browser.
      </p>
      <p>
        Questions: <a href={`mailto:${PUBLISHER.privacy}`}>{PUBLISHER.privacy}</a>. See the{' '}
        <Link to="/privacy-policy">privacy policy</Link> for the legal basis and your rights.
      </p>
    </LegalLayout>
  );
}
