import { Link } from 'react-router-dom';
import { LegalLayout } from '../components/LegalLayout.tsx';
import { PUBLISHER } from '../legal/publisher.ts';

const DESCRIPTION =
  'How TrackTidy handles audio files, metadata, local storage, and optional analytics.';

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy policy — TrackTidy"
      description={DESCRIPTION}
      path="/privacy-policy"
      kicker="Privacy"
      heading="Privacy policy"
    >
      <p>Last updated: 8 November 2026.</p>
      <p>
        This policy describes the TrackTidy website as it works today. It is not a certificate of legal compliance.
        The controller is Hugo Blanchart, an entrepreneur individuel publishing the {PUBLISHER.brand} brand. Privacy
        requests: <a href={`mailto:${PUBLISHER.privacy}`}>{PUBLISHER.privacy}</a>. The postal address and telephone
        number are on the <Link to="/legal-notice">legal notice</Link>.
      </p>

      <h2>Audio files stay in the browser</h2>
      <p>
        Choosing an MP3 reads that file on your device. The page uses the Web Audio API, a local metadata parser, and
        a local tempo detector. Tag edits are written into a new download on your device. The audio is not
        re-encoded. TrackTidy does not upload the file, its filename, or its tags to a TrackTidy server, and it does
        not put them in analytics events.
      </p>
      <p>
        WAV, AIFF, FLAC, M4A, and other unsupported files are refused in the browser and are not sent anywhere. There
        is no account and no contact form. A message you send to {PUBLISHER.hello}, {PUBLISHER.support}, or{' '}
        {PUBLISHER.privacy} is handled by your email provider. Those three addresses are aliases to one inbox.
      </p>

      <h2>What is processed, and why</h2>
      <h3>Files and tags</h3>
      <p>
        The MP3, its embedded tags, artwork, and audio samples are used only to show the editor, estimate tempo and
        key, and build your download. The legal basis is that you asked for this processing by choosing the file
        (GDPR Article 6(1)(b), the service you requested). It happens in your browser. TrackTidy does not keep a copy
        after you leave the page. Closing the track drops it from memory.
      </p>
      <h3>Filename template</h3>
      <p>
        The filename pattern is saved in local storage under <code>tracktidy.template</code> so the same pattern is
        there next time. It stays on this device. It is not sent to TrackTidy. You can remove it by clearing site
        data for this site.
      </p>
      <h3>Consent choice</h3>
      <p>
        Your analytics choice is saved in local storage under <code>tracktidy.consent</code>. Remembering that choice
        is necessary so the site does not ask on every page and does not load analytics after a refusal. It is kept
        until you change it in Cookie settings or clear site data.
      </p>
      <h3>Optional analytics</h3>
      <p>
        If you accept, and only if a Google Analytics 4 measurement ID is configured for the site, the browser loads
        Google’s analytics script and may store Google’s analytics cookies. The legal basis is consent (GDPR Article
        6(1)(a) and the ePrivacy rules on storage). If you reject, or if you have not chosen, that script is not
        loaded. If you withdraw consent later, collection is stopped and the analytics cookies this site can see are
        cleared.
      </p>
      <p>Events contain no audio, filename, track title, artist, or tag value. They are limited to:</p>
      <ul>
        <li>tool_opened</li>
        <li>file_upload_started and file_upload_completed</li>
        <li>metadata_analysis_completed, with only whether a BPM or key tag was already present</li>
        <li>metadata_edit_completed, with only the field name, such as artist or bpm</li>
        <li>filename_generated and file_downloaded</li>
        <li>processing_failed, with only a stage such as type, tags, or export</li>
        <li>a page view with the path and page title</li>
      </ul>
      <p>
        Google may also receive technical data such as browser type and a coarse location derived from the IP
        address. Google Analytics 4 is provided by Google. Data may be processed in the European Economic Area and
        the United States. Google describes its own transfer tools in its privacy terms. TrackTidy does not use
        advertising cookies or other analytics vendors.
      </p>
      <h3>Hosting logs</h3>
      <p>
        The site files are static and are hosted by Vercel Inc. Serving a page can create a connection log, such as
        an IP address, a user agent, a time, and the URL of the page or script. Those logs are not this application’s
        database, and they do not contain your audio. They may be processed in the United States. The legal basis is
        the legitimate interest in operating and securing the site (GDPR Article 6(1)(f)). TrackTidy does not set the
        host’s retention period. The host’s address and telephone number are on the{' '}
        <Link to="/legal-notice">legal notice</Link>.
      </p>
      <p>
        The domain name is registered with Namecheap. This site does not send audio, filenames, tags, or analytics
        events to the registrar.
      </p>

      <h2>How long data is kept</h2>
      <p>
        Audio and tags are not stored by TrackTidy. The template and the consent choice remain in your browser until
        you change or delete them. Analytics retention is the period set in the Google Analytics property. This
        website does not set that period. It should be configured in Google Analytics before launch.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for access, correction, deletion, restriction, or a copy of personal data the controller holds,
        and you can object where the law allows. You can withdraw analytics consent at any time with Cookie settings
        in the footer. Withdrawal does not affect processing that took place before it. You can also complain to the
        CNIL, the French data protection authority, at{' '}
        <a href="https://www.cnil.fr" rel="noreferrer">
          cnil.fr
        </a>
        .
      </p>
      <p>
        Send requests to <a href={`mailto:${PUBLISHER.privacy}`}>{PUBLISHER.privacy}</a>. Because files are not
        uploaded, TrackTidy usually has no copy of a track to provide or delete. No data protection officer has been
        appointed.
      </p>
      <p>The site is not directed at children.</p>
    </LegalLayout>
  );
}
