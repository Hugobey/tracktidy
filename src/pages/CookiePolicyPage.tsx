import { Link } from 'react-router-dom';
import { LegalLayout } from '../components/LegalLayout.tsx';
import { PUBLISHER } from '../legal/publisher.ts';
import { routeMeta } from '../lib/site.ts';

const page = routeMeta('/cookie-policy');

export default function CookiePolicyPage() {
  return (
    <LegalLayout
      title={page.title}
      description={page.description}
      path={page.path}
      kicker="Cookies"
      heading="Cookie policy"
    >
      <p>Last updated: 15 November 2026.</p>
      <p>
        This page lists only the storage the site uses. Analytics cookies are optional. The banner offers Accept and
        Reject at the same time. Cookie settings in the footer opens that choice again.
      </p>

      <h2>Necessary storage</h2>
      <p>These items are not advertising cookies. They stay on your device.</p>
      <ul>
        <li>
          <code>tracktidy.consent</code> in local storage. Values: accepted or rejected. Purpose: remember your
          analytics choice so the optional Google Analytics 4 and PostHog scripts are not loaded after a refusal.
          Duration: until you change it or clear site data.
        </li>
        <li>
          <code>tracktidy.template</code> in local storage. Purpose: remember your filename pattern. Duration: until
          you replace it or clear site data. It is not sent to analytics.
        </li>
        <li>
          <code>tracktidy.device</code> in local storage and a first-party cookie of the same name. Value: owner.
          Purpose: leave that browser out of analytics even if its network address changes. It is not set on an
          ordinary visit. Duration: until site data is cleared. The cookie is refreshed on later visits. It is not an
          advertising cookie.
        </li>
      </ul>
      <p>
        TrackTidy does not set an analytics cookie before you accept. The device marker above is not an analytics
        cookie. The page head loads Google Tag Manager container GTM-TWVDH6V3 when the page opens, so that request
        reaches Google before a choice. Cookies set by tags inside that container depend on the container
        configuration. A browser stored as the publisher’s device, and any visit from localhost, does not load that
        container.
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
        The tag manager container can load the tags configured for it. Rejecting, or changing your mind in Cookie
        settings, stops collection and clears the analytics cookies this site can remove. You can also block or
        delete cookies in your browser.
      </p>
      <h2>PostHog</h2>
      <p>
        Loaded only after you press Accept, and only when a PostHog project key is configured for the build.
        Provider: PostHog. The default host is eu.i.posthog.com. Purpose: the same page views and product actions as
        Google Analytics 4. The screen is not recorded. Typed text, filenames, and tag values are not collected. No
        name or email is sent.
      </p>
      <ul>
        <li>
          A cookie whose name starts with <code>ph_</code>, plus matching local storage. Distinguishes browsers.
          PostHog commonly keeps the cookie for up to one year.
        </li>
      </ul>
      <p>
        Rejecting, or changing your mind in Cookie settings, stops further PostHog events. A browser stored as the
        publisher’s device, and any visit from localhost, is not sent.
      </p>
      <h2>Vercel Web Analytics</h2>
      <p>
        The page loads Vercel Web Analytics when it opens. It does not set a cookie, and it does not wait for Accept
        or Reject. Vercel receives the page path, the referrer, the browser, the device, and a coarse location. A
        visitor hash lasts 24 hours and is then discarded. Query strings are removed before the page view is sent.
        Provider: Vercel Inc., the same company that hosts the site. This is separate from the optional Google
        Analytics 4 and PostHog cookies above. A browser stored as the publisher’s device, and any visit from
        localhost, is not sent.
      </p>
      <p>
        Questions: <a href={`mailto:${PUBLISHER.privacy}`}>{PUBLISHER.privacy}</a>. See the{' '}
        <Link to="/privacy-policy">privacy policy</Link> for the legal basis and your rights.
      </p>
    </LegalLayout>
  );
}
