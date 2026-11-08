import { LegalLayout } from '../components/LegalLayout.tsx';
import { LEGAL_NOTICE_WITHHELD, PUBLISHER, PUBLISHED_NOTICE, legalNoticeParagraphs } from '../legal/publisher.ts';

const DESCRIPTION = 'Publisher information for the TrackTidy website.';

export default function LegalNoticePage() {
  const paragraphs = legalNoticeParagraphs(PUBLISHED_NOTICE);

  return (
    <LegalLayout
      title="Legal notice — TrackTidy"
      description={DESCRIPTION}
      path="/legal-notice"
      index={paragraphs !== null}
      kicker="Legal"
      heading="Legal notice"
    >
      {paragraphs ? (
        paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
      ) : (
        <>
          <p>{LEGAL_NOTICE_WITHHELD[0]}</p>
          <p>{LEGAL_NOTICE_WITHHELD[1]}</p>
          <p>
            Questions about the site can be sent to <a href={`mailto:${PUBLISHER.hello}`}>{PUBLISHER.hello}</a>.
          </p>
        </>
      )}
    </LegalLayout>
  );
}
