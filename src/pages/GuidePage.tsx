import type { ComponentProps, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GuideByline } from '../components/GuideByline.tsx';
import { GuideCallout } from '../components/GuideCallout.tsx';
import { GuideShell } from '../components/GuideShell.tsx';
import { RelatedGuides } from '../components/RelatedGuides.tsx';
import NotFoundPage from './NotFoundPage.tsx';
import { GUIDES, guideBySlug } from '../lib/guides.ts';
import { guidePostingJsonLd, relatedGuides } from '../lib/guide-frontmatter.ts';

function GuideLink({ href, children }: ComponentProps<'a'>): ReactNode {
  if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) {
    return <Link to={href}>{children}</Link>;
  }
  return <a href={href}>{children}</a>;
}

function GuideTable(props: ComponentProps<'table'>) {
  return (
    <div className="guide-table-scroll">
      <table {...props} />
    </div>
  );
}

export default function GuidePage() {
  const { slug } = useParams();
  const guide = guideBySlug(slug);
  if (!guide) return <NotFoundPage />;

  const Content = guide.Component;
  const related = relatedGuides(GUIDES, guide.slug);

  return (
    <GuideShell
      title={guide.title}
      description={guide.description}
      path={guide.path}
      ogType="article"
      image={guide.heroImage}
      jsonLd={guidePostingJsonLd(guide)}
    >
      <article className="guide-sheet">
        <p className="guide-crumb">
          <Link to="/guides">Guides</Link>
          <span className="guide-pill">{guide.category}</span>
        </p>
        <h1>{guide.title}</h1>
        <p className="guide-dek">{guide.description}</p>
        <GuideByline author={guide.author} role={guide.authorRole} date={guide.date} minutes={guide.minutes} />
        <img
          className="guide-hero"
          src={guide.heroImage}
          alt="A quiet desk with USB drives, a notebook, and a coiled audio cable, set up for sorting music files."
        />
        <div className="guide-copy">
          <Content components={{ a: GuideLink, table: GuideTable, Callout: GuideCallout }} />
        </div>
        <RelatedGuides guides={related} />
      </article>
    </GuideShell>
  );
}
