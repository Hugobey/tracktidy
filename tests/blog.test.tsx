import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { articleFallback } from '../scripts/blog-html.ts';
import { blogSitemapEntries, readBlogFiles } from '../scripts/blog-files.ts';
import { applyRouteMeta, injectFallback, injectJsonLd } from '../scripts/prerender-routes.ts';
import { ConsentProvider } from '../src/components/Consent.tsx';
import { BLOG_CTA } from '../src/lib/blog-cta.ts';
import {
  blogPostingJsonLd,
  formatBlogDate,
  parseBlogSource,
  readingMinutes,
  relatedPosts,
} from '../src/lib/blog-frontmatter.ts';
import { DEFAULT_ORIGIN, SITEMAP_LASTMOD, sitemapXml } from '../src/lib/site.ts';
import BlogIndexPage from '../src/pages/BlogIndexPage.tsx';
import BlogPostPage from '../src/pages/BlogPostPage.tsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE_MARKERS = ['Hugo Blanchart', '891239428', 'rue neuve', '75011', '+33 7 77 37 25 07', 'FR14891239428'];

describe('blog frontmatter', () => {
  it('reads a guide and rejects a bad date', () => {
    const parsed = parseBlogSource(
      '---\ntitle: One\ndescription: Two\ndate: 2026-11-12\ncluster: Library prep\nkeywords:\n  - alpha\n---\nHello world\n',
      'one-guide',
    );
    expect(parsed.frontmatter.title).toBe('One');
    expect(parsed.frontmatter.keywords).toEqual(['alpha']);
    expect(parsed.body).toBe('Hello world\n');
    expect(readingMinutes('word '.repeat(400))).toBe(2);
    expect(formatBlogDate('2026-11-12')).toBe('12 November 2026');
    expect(() => parseBlogSource('---\ntitle: One\ndescription: Two\ndate: 2026-13-40\ncluster: Prep\nkeywords:\n  - alpha\n---\nBody\n', 'bad-date')).toThrow(/Bad date/);
  });

  it('picks two other guides from the same cluster', () => {
    const posts = [
      { slug: 'a', cluster: 'Library prep', title: 'A' },
      { slug: 'b', cluster: 'Library prep', title: 'B' },
      { slug: 'c', cluster: 'Other', title: 'C' },
      { slug: 'd', cluster: 'Library prep', title: 'D' },
    ];
    expect(relatedPosts(posts, 'a').map((post) => post.slug)).toEqual(['b', 'd']);
  });
});

describe('seeded guides', () => {
  const posts = readBlogFiles(root);

  it('ships the three library-prep guides', () => {
    expect(posts.map((post) => post.slug)).toEqual([
      'batch-rename-mp3-files-online',
      'edit-mp3-metadata-online',
      'edit-mp3-tags-in-bulk',
    ]);
    expect(posts.map((post) => post.title)).toEqual([
      'How to Batch Rename MP3 Files Online (Fast DJ Workflow)',
      'How to Edit MP3 Metadata Online: Clean ID3 Tags in Seconds',
      'How to Edit MP3 Tags in Bulk Without Losing Your Mind',
    ]);
    for (const post of posts) {
      expect(post.date).toBe('2026-11-12');
      expect(post.cluster).toBe('Library prep');
      expect(post.keywords.length).toBeGreaterThan(0);
      expect(post.minutes).toBeGreaterThanOrEqual(3);
      expect(post.body).toContain('https://www.track-tidy.com/');
      expect(post.body).toContain('](/app)');
      for (const marker of PRIVATE_MARKERS) expect(post.body).not.toContain(marker);
    }
    const rename = posts[0];
    const metadata = posts[1];
    const bulk = posts[2];
    expect(rename?.body).toContain('01_track_final_v2_320kbps.mp3');
    expect(rename?.body).toContain('Artist - Title (124 BPM) [8A].mp3');
    expect(rename?.body).toContain('does not rename a folder');
    expect(metadata?.body).toContain('](/blog/batch-rename-mp3-files-online)');
    expect(metadata?.body).toContain('Rekordbox');
    expect(metadata?.body).toContain('Serato');
    expect(bulk?.body).toContain('will not edit a batch of files');
    expect(bulk?.body).toContain('poolsite.com');
  });

  it('keeps the call to action honest about one file', () => {
    expect(BLOG_CTA).toContain('One MP3 at a time');
    expect(BLOG_CTA).not.toContain('Batch rename');
  });
});

describe('blog seo', () => {
  const posts = readBlogFiles(root);

  it('adds /blog and each guide to the sitemap without moving older routes', () => {
    const entries = blogSitemapEntries(root);
    expect(entries.map((entry) => entry.path)).toEqual(['/blog', ...posts.map((post) => post.path)]);
    expect(entries.every((entry) => entry.lastmod === '2026-11-12')).toBe(true);
    const xml = sitemapXml(DEFAULT_ORIGIN, SITEMAP_LASTMOD, entries);
    expect(xml).toContain('<loc>https://www.track-tidy.com/app</loc>\n    <lastmod>2026-11-09</lastmod>');
    expect(xml).toContain('<loc>https://www.track-tidy.com/blog/edit-mp3-metadata-online</loc>\n    <lastmod>2026-11-12</lastmod>');
    expect(readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')).toBe(xml);
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
      rewrites: { source: string; destination: string }[];
    };
    expect(vercel.rewrites).toContainEqual({ source: '/blog', destination: '/blog/index.html' });
    expect(vercel.rewrites).toContainEqual({ source: '/blog/:slug', destination: '/blog/:slug/index.html' });
  });

  it('prerenders BlogPosting, the canonical URL, and the article text', () => {
    const post = posts[0];
    if (!post) throw new Error('missing rename guide');
    const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const html = injectFallback(
      injectJsonLd(
        applyRouteMeta(
          shell,
          { path: post.path, title: post.title, description: post.description, ogType: 'article' },
          DEFAULT_ORIGIN,
        ),
        blogPostingJsonLd(post, DEFAULT_ORIGIN),
      ),
      articleFallback(post, posts),
    );
    expect(html).toContain(`<title>${post.title}</title>`);
    expect(html).toContain(`content="${post.description}"`);
    expect(html).toContain('href="https://www.track-tidy.com/blog/batch-rename-mp3-files-online"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain('"headline":"How to Batch Rename MP3 Files Online (Fast DJ Workflow)"');
    expect(html).toContain('"datePublished":"2026-11-12"');
    expect(html).toContain('"name":"TrackTidy"');
    expect(html).toContain('01_track_final_v2_320kbps.mp3');
    expect(html).not.toContain('Hugo Blanchart');
    const tool = applyRouteMeta(shell, { path: '/app', title: 'MP3 metadata editor — TrackTidy', description: 'Tool' }, DEFAULT_ORIGIN);
    expect(tool).toContain('property="og:type" content="website"');
  });
});

function renderAt(path: string, page: 'index' | 'post'): string {
  const element = page === 'index' ? <BlogIndexPage /> : <BlogPostPage />;
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ConsentProvider>
        <Routes>
          <Route path="/blog" element={page === 'index' ? element : null} />
          <Route path="/blog/:slug" element={page === 'post' ? element : null} />
        </Routes>
      </ConsentProvider>
    </MemoryRouter>,
  );
}

describe('blog pages', () => {
  it('lists every guide with its cluster, date, and reading time', () => {
    const html = renderAt('/blog', 'index');
    expect(html).toContain('How to Batch Rename MP3 Files Online (Fast DJ Workflow)');
    expect(html).toContain('How to Edit MP3 Metadata Online: Clean ID3 Tags in Seconds');
    expect(html).toContain('How to Edit MP3 Tags in Bulk Without Losing Your Mind');
    expect(html).toContain('Library prep');
    expect(html).toContain('12 November 2026');
    expect(html).toContain('min read');
    expect(html).toContain('href="/blog/batch-rename-mp3-files-online"');
    expect(html).toContain('href="/blog"');
  });

  it('renders the guide, the other two links, and a path back to the tool', () => {
    const html = renderAt('/blog/edit-mp3-metadata-online', 'post');
    expect(html).toContain('TPE1');
    expect(html).toContain('href="/app"');
    expect(html).toContain('One MP3 at a time');
    expect(html).toContain('href="/blog/batch-rename-mp3-files-online"');
    expect(html).toContain('href="/blog/edit-mp3-tags-in-bulk"');
    expect(html).not.toContain('Batch rename tracks');
  });

  it('answers an unknown slug with the site 404', () => {
    const html = renderAt('/blog/not-a-guide', 'post');
    expect(html).toContain('This page does not exist.');
  });
});
