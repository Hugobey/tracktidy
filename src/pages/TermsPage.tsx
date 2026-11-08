import { LegalLayout } from '../components/LegalLayout.tsx';
import { PUBLISHER } from '../legal/publisher.ts';

const DESCRIPTION = 'The rules for using TrackTidy, including file rights and the limits of BPM and key estimates.';

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of use — TrackTidy"
      description={DESCRIPTION}
      path="/terms-of-use"
      kicker="Terms"
      heading="Terms of use"
    >
      <p>Last updated: 8 November 2026.</p>
      <p>
        TrackTidy is a free browser tool published under the {PUBLISHER.brand} brand. It reads one MP3 at a time,
        shows and edits supported tags, can measure tempo, estimates musical key, builds a filename, and downloads
        the file. Processing happens in your browser. There is no account. These terms are not a certificate of legal
        compliance.
      </p>

      <h2>Using the tool</h2>
      <p>
        You may use TrackTidy for files you have the right to edit. You are responsible for the copyright and other
        rights in those files, and for checking the tags and the filename before you play, share, or sell the result.
        The service handles one file at a time. It is not a music library, and it does not edit a batch of files.
      </p>
      <p>
        Do not use the site to attack it, to probe it for someone else’s files, or to distribute malware. Do not send
        files you are not allowed to modify.
      </p>

      <h2>Accuracy</h2>
      <p>
        Tempo is measured from the audio and folded into a range of about 90 to 180 BPM. Half-time and double-time
        readings happen. The controls can divide or multiply the shown tempo by two. Musical key is an estimate and
        can be low confidence. A value already stored in the file is shown separately from a detected or estimated
        value. If a measurement fails, the tool says so and does not invent a number or a key. You decide what is
        written into the file.
      </p>

      <h2>Your files and our site</h2>
      <p>
        You keep all rights in your audio and metadata. TrackTidy does not take a licence in them, because they are
        not uploaded. The site design, code, and TrackTidy name belong to the publisher. You may not copy the site
        and present it as your own service.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The tool is provided free of charge and may change, pause, or stop. It is not promised to be uninterrupted or
        error-free. You should keep your own copy of a file. Edits that you do not download are lost when you close
        the track.
      </p>
      <p>
        To the extent French law allows, the publisher is not liable for decisions you make from a BPM or key
        estimate, or for a file you did not download. Nothing in these terms limits liability that the law does not
        allow to be limited, including liability for fraud, wilful misconduct, or bodily injury, or rights that
        consumers cannot waive. If you use TrackTidy as a consumer in the European Union, you keep the mandatory
        protections of your country of residence.
      </p>

      <h2>No paid service</h2>
      <p>TrackTidy is free. It does not take a payment or sell a subscription.</p>

      <h2>Contact and law</h2>
      <p>
        French law applies to these terms. Questions about the service:{' '}
        <a href={`mailto:${PUBLISHER.hello}`}>{PUBLISHER.hello}</a>. Technical help:{' '}
        <a href={`mailto:${PUBLISHER.support}`}>{PUBLISHER.support}</a>.
      </p>
    </LegalLayout>
  );
}
