import { LegalLayout } from '../components/LegalLayout.tsx';
import { LEGAL_NOTICE_WITHHELD, PUBLISHER, PUBLISHED_NOTICE, legalNoticeParagraphs } from '../legal/publisher.ts';
import { routeMeta } from '../lib/site.ts';

const page = routeMeta('/legal-notice');

export default function LegalNoticePage() {
  const paragraphs = legalNoticeParagraphs(PUBLISHED_NOTICE);

  return (
    <LegalLayout
      title={page.title}
      description={page.description}
      path={page.path}
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
