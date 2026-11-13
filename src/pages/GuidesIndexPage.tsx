import { Link } from 'react-router-dom';
import { GuideShell } from '../components/GuideShell.tsx';
import { GUIDES } from '../lib/guides.ts';
import { formatGuideDate, readingLabel } from '../lib/guide-frontmatter.ts';
import { GUIDE_INDEX_DESCRIPTION, GUIDE_INDEX_PATH, GUIDE_INDEX_TITLE } from '../lib/site.ts';

export default function GuidesIndexPage() {
  return (
    <GuideShell title={GUIDE_INDEX_TITLE} description={GUIDE_INDEX_DESCRIPTION} path={GUIDE_INDEX_PATH}>
      <div className="wrap">
        <header className="guides-intro">
          <p className="guide-kicker">Guides</p>
          <h1>Guides for the files you actually play.</h1>
          <p className="guides-dek">{GUIDE_INDEX_DESCRIPTION}</p>
        </header>
        {GUIDES.length === 0 ? (
          <p className="guides-dek">No guides yet.</p>
        ) : (
          <ul className="guide-grid" data-testid="guide-grid">
            {GUIDES.map((guide) => (
              <li key={guide.slug}>
                <Link to={guide.path}>
                  <img className="guide-card-thumb" src={guide.heroImage} alt="" />
                  <div className="guide-card-body">
                    <span className="guide-pill">{guide.category}</span>
                    <h2>{guide.title}</h2>
                    <p>{guide.description}</p>
                    <p className="guide-card-meta">
                      <span>{guide.author}</span>
                      <time dateTime={guide.date}>{formatGuideDate(guide.date)}</time>
                      <span>{readingLabel(guide.minutes)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GuideShell>
  );
}
