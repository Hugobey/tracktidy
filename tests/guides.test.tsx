import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { guideFallback } from '../scripts/guide-html.ts';
import { guideSitemapEntries, readGuideFiles } from '../scripts/guide-files.ts';
import { applyRouteMeta, injectFallback, injectJsonLd } from '../scripts/prerender-routes.ts';
import { ConsentProvider } from '../src/components/Consent.tsx';
import { GUIDE_CTA } from '../src/lib/guide-cta.ts';
import {
  formatGuideDate,
  guidePostingJsonLd,
  parseGuideSource,
  readingMinutes,
  relatedGuides,
} from '../src/lib/guide-frontmatter.ts';
import { DEFAULT_ORIGIN, SITEMAP_LASTMOD, sitemapXml } from '../src/lib/site.ts';
import GuidePage from '../src/pages/GuidePage.tsx';
import GuidesIndexPage from '../src/pages/GuidesIndexPage.tsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE_MARKERS = ['Hugo Blanchart', '891239428', 'rue neuve', '75011', '+33 7 77 37 25 07', 'FR14891239428'];
const HERO = '/images/guides/batch-rename-hero.jpg';

const FRONT = `---
title: "One: a title"
description: "Two words."
date: "2026-11-12"
author: "Julian Vance"
authorRole: "Resident DJ & Audio Systems Engineer"
category: "Workflow"
heroImage: "/images/guides/batch-rename-hero.jpg"
keywords:
  - alpha
---
`;

describe('guide frontmatter', () => {
  it('reads a guide and rejects a bad date', () => {
    const parsed = parseGuideSource(`${FRONT}Hello world\n`, 'one-guide');
    expect(parsed.frontmatter.title).toBe('One: a title');
    expect(parsed.frontmatter.author).toBe('Julian Vance');
    expect(parsed.frontmatter.keywords).toEqual(['alpha']);
    expect(parsed.body).toBe('Hello world\n');
    expect(readingMinutes('word '.repeat(400))).toBe(2);
    expect(readingMinutes('Hello <Callout type="tool-promo">skip</Callout> there')).toBe(1);
    expect(formatGuideDate('2026-11-12')).toBe('12 November 2026');
    expect(() =>
      parseGuideSource(FRONT.replace('2026-11-12', '2026-13-40') + 'Body\n', 'bad-date'),
    ).toThrow(/Bad date/);
  });

  it('picks two other guides and prefers the same category', () => {
    const guides = [
      { slug: 'a', category: 'Workflow', title: 'A' },
      { slug: 'b', category: 'Workflow', title: 'B' },
      { slug: 'c', category: 'Metadata', title: 'C' },
      { slug: 'd', category: 'Workflow', title: 'D' },
    ];
    expect(relatedGuides(guides, 'a').map((guide) => guide.slug)).toEqual(['b', 'd']);
  });
});

describe('seeded guides', () => {
  const guides = readGuideFiles(root);

  it('ships the three guides under /guides', () => {
    expect(guides.map((guide) => guide.slug)).toEqual([
      'batch-rename-mp3-files-online',
      'edit-mp3-metadata-online',
      'edit-mp3-tags-in-bulk',
    ]);
    expect(guides.map((guide) => guide.category)).toEqual(['Workflow', 'Metadata', 'DJ Prep']);
    expect(guides.map((guide) => guide.title)).toEqual([
      'How to Batch Rename MP3 Files Online (Fast DJ Workflow)',
      'How to Edit MP3 Metadata Online: Clean ID3 Tags in Seconds',
      'How to Edit MP3 Tags in Bulk Without Losing Your Mind',
    ]);
    for (const guide of guides) {
      expect(guide.date).toBe('2026-11-12');
      expect(guide.author).toBe('Julian Vance');
      expect(guide.authorRole).toBe('Resident DJ & Audio Systems Engineer');
      expect(guide.heroImage).toBe(HERO);
      expect(guide.path.startsWith('/guides/')).toBe(true);
      expect(guide.keywords.length).toBeGreaterThan(0);
      expect(guide.minutes).toBeGreaterThanOrEqual(1);
      expect(guide.body).toContain('<Callout type="tool-promo">');
      expect(guide.body).not.toContain('/blog/');
      expect(guide.body).not.toContain('Free Batch Renamer');
      for (const marker of PRIVATE_MARKERS) expect(guide.body).not.toContain(marker);
    }
    const rename = guides[0];
    const metadata = guides[1];
    const bulk = guides[2];
    expect(rename?.body).toContain('12_track_name_MASTER_final_320.mp3');
    expect(rename?.body).toContain('Artist - Track Name (124 BPM) [8A].mp3');
    expect(rename?.body).toContain('does not rename a folder');
    expect(rename?.body).toContain('does not take WAV');
    expect(rename?.description).not.toContain('batch rename multiple MP3 files directly');
    expect(metadata?.body).toContain('](/guides/batch-rename-mp3-files-online)');
    expect(metadata?.body).toContain('Rekordbox');
    expect(metadata?.body).toContain('Serato');
    expect(metadata?.body).toContain('https://www.track-tidy.com/');
    expect(bulk?.body).toContain('will not edit a batch of files');
    expect(bulk?.body).toContain('poolsite.com');
  });

  it('keeps the call to action honest about one file', () => {
    expect(GUIDE_CTA).toContain('one MP3');
    expect(GUIDE_CTA).not.toContain('Batch rename');
    expect(GUIDE_CTA).not.toContain('batch');
  });
});

describe('guide seo', () => {
  const guides = readGuideFiles(root);

  it('adds /guides and each article without moving older routes', () => {
    const entries = guideSitemapEntries(root);
    expect(entries.map((entry) => entry.path)).toEqual(['/guides', ...guides.map((guide) => guide.path)]);
    expect(entries.every((entry) => entry.lastmod === '2026-11-12')).toBe(true);
    const xml = sitemapXml(DEFAULT_ORIGIN, SITEMAP_LASTMOD, entries);
    expect(xml).toContain('<loc>https://www.track-tidy.com/app</loc>\n    <lastmod>2026-11-09</lastmod>');
    expect(xml).toContain(
      '<loc>https://www.track-tidy.com/guides/edit-mp3-metadata-online</loc>\n    <lastmod>2026-11-12</lastmod>',
    );
    expect(xml).not.toContain('/blog');
    expect(readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')).toBe(xml);
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
      rewrites: { source: string; destination: string }[];
    };
    expect(vercel.rewrites).toContainEqual({ source: '/guides', destination: '/guides/index.html' });
    expect(vercel.rewrites).toContainEqual({ source: '/guides/:slug', destination: '/guides/:slug/index.html' });
    expect(vercel.rewrites.some((rule) => rule.source.includes('/blog'))).toBe(false);
  });

  it('prerenders BlogPosting, the canonical URL, and the article text', () => {
    const guide = guides[0];
    if (!guide) throw new Error('missing rename guide');
    const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const html = injectFallback(
      injectJsonLd(
        applyRouteMeta(
          shell,
          {
            path: guide.path,
            title: guide.title,
            description: guide.description,
            ogType: 'article',
            image: guide.heroImage,
          },
          DEFAULT_ORIGIN,
        ),
        guidePostingJsonLd(guide, DEFAULT_ORIGIN),
      ),
      guideFallback(guide, guides),
    );
    expect(html).toContain(`<title>${guide.title}</title>`);
    expect(html).toContain(`content="${guide.description}"`);
    expect(html).toContain('href="https://www.track-tidy.com/guides/batch-rename-mp3-files-online"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('property="og:image" content="https://www.track-tidy.com/images/guides/batch-rename-hero.jpg"');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain('"headline":"How to Batch Rename MP3 Files Online (Fast DJ Workflow)"');
    expect(html).toContain('"datePublished":"2026-11-12"');
    expect(html).toContain('"@type":"Person"');
    expect(html).toContain('"name":"Julian Vance"');
    expect(html).toContain('"jobTitle":"Resident DJ & Audio Systems Engineer"');
    expect(html).toContain('"name":"TrackTidy"');
    expect(html).toContain('12_track_name_MASTER_final_320.mp3');
    expect(html).not.toContain('Hugo Blanchart');
    expect(html).not.toContain('/blog');
    const tool = applyRouteMeta(shell, { path: '/app', title: 'MP3 metadata editor — TrackTidy', description: 'Tool' }, DEFAULT_ORIGIN);
    expect(tool).toContain('property="og:type" content="website"');
    expect(tool).toContain('property="og:image" content="https://www.track-tidy.com/og.png"');
  });
});

function renderAt(path: string, page: 'index' | 'guide'): string {
  const element = page === 'index' ? <GuidesIndexPage /> : <GuidePage />;
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ConsentProvider>
        <Routes>
          <Route path="/guides" element={page === 'index' ? element : null} />
          <Route path="/guides/:slug" element={page === 'guide' ? element : null} />
        </Routes>
      </ConsentProvider>
    </MemoryRouter>,
  );
}

describe('guide pages', () => {
  it('lists every guide with its category, author, date, and reading time', () => {
    const html = renderAt('/guides', 'index');
    expect(html).toContain('How to Batch Rename MP3 Files Online (Fast DJ Workflow)');
    expect(html).toContain('How to Edit MP3 Metadata Online: Clean ID3 Tags in Seconds');
    expect(html).toContain('How to Edit MP3 Tags in Bulk Without Losing Your Mind');
    expect(html).toContain('Workflow');
    expect(html).toContain('Metadata');
    expect(html).toContain('DJ Prep');
    expect(html).toContain('Julian Vance');
    expect(html).toContain('12 November 2026');
    expect(html).toContain('min read');
    expect(html).toContain('href="/guides/batch-rename-mp3-files-online"');
    expect(html).toContain('href="/guides"');
    expect(html).toContain('>Guides<');
    expect(html).not.toContain('/blog');
  });

  it('renders the byline, the hero, the tool callout, and the other two guides', () => {
    const html = renderAt('/guides/batch-rename-mp3-files-online', 'guide');
    expect(html).toContain('Julian Vance');
    expect(html).toContain('Resident DJ &amp; Audio Systems Engineer');
    expect(html).toContain('>JV<');
    expect(html).toContain(`src="${HERO}"`);
    expect(html).toContain('href="/#upload"');
    expect(html).toContain('Clean a track');
    expect(html).toContain('does not rename a folder');
    expect(html).toContain('href="/guides/edit-mp3-metadata-online"');
    expect(html).toContain('href="/guides/edit-mp3-tags-in-bulk"');
    expect(html).not.toContain('Free Batch Renamer');
    expect(html).not.toContain('Batch rename tracks');
  });

  it('answers an unknown slug with the site 404', () => {
    const html = renderAt('/guides/not-a-guide', 'guide');
    expect(html).toContain('This page does not exist.');
  });
});
