import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guideFallback, guideIndexFallback } from './guide-html.ts';
import { guideSitemapEntries, readGuideFiles } from './guide-files.ts';
import { guidePostingJsonLd } from '../src/lib/guide-frontmatter.ts';
import {
  GUIDE_INDEX_DESCRIPTION,
  GUIDE_INDEX_PATH,
  GUIDE_INDEX_TITLE,
  INDEXABLE_ROUTES,
  SITEMAP_LASTMOD,
  canonicalUrl,
  robotsTxt,
  sitemapXml,
} from '../src/lib/site.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export type PrerenderRoute = {
  path: string;
  title: string;
  description: string;
  ogType?: 'website' | 'article';
  image?: string;
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function setMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const pattern = new RegExp(`<meta\\b[^>]*\\b${attr}="${key}"[^>]*>`);
  if (!pattern.test(html)) throw new Error(`Missing meta ${attr}="${key}"`);
  return html.replace(pattern, `<meta ${attr}="${key}" content="${content}" />`);
}

/** Rewrites the homepage shell so a route has its own title, description, and canonical URL. */
export function applyRouteMeta(html: string, route: PrerenderRoute, origin: string): string {
  const title = escapeAttr(route.title);
  const description = escapeAttr(route.description);
  const canonical = canonicalUrl(route.path, origin);
  const image = route.image ? new URL(route.image, `${origin}/`).href : `${origin}/og.png`;
  let next = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  next = setMeta(next, 'name', 'description', description);
  next = setMeta(next, 'name', 'robots', 'index,follow');
  next = next.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`);
  next = setMeta(next, 'property', 'og:title', title);
  next = setMeta(next, 'property', 'og:description', description);
  next = setMeta(next, 'property', 'og:url', canonical);
  next = setMeta(next, 'property', 'og:image', image);
  if (route.ogType) next = setMeta(next, 'property', 'og:type', route.ogType);
  next = setMeta(next, 'name', 'twitter:title', title);
  next = setMeta(next, 'name', 'twitter:description', description);
  next = setMeta(next, 'name', 'twitter:image', image);
  return next;
}

export function injectJsonLd(html: string, data: Record<string, unknown>): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const script = `<script type="application/ld+json" id="tracktidy-ld">${json}</script>`;
  if (html.includes('id="tracktidy-ld"')) return html.replace(/<script type="application\/ld\+json" id="tracktidy-ld">[\s\S]*?<\/script>/, script);
  return html.replace('</head>', `  ${script}\n  </head>`);
}

export function injectFallback(html: string, inner: string): string {
  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) throw new Error('Missing #root');
  if (inner.includes('</noscript>')) throw new Error('Fallback HTML cannot close noscript');
  return html.replace(marker, `<noscript>${inner}</noscript>\n    ${marker}`);
}

function writeRoute(dist: string, routePath: string, html: string): void {
  const file = routePath === '/' ? join(dist, 'index.html') : join(dist, routePath.slice(1), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

export function prerenderDist(dist = join(process.cwd(), 'dist'), origin?: string): void {
  const shell = readFileSync(join(dist, 'index.html'), 'utf8');
  const host = origin ?? new URL(canonicalUrl('/')).origin;
  for (const route of INDEXABLE_ROUTES) {
    writeRoute(dist, route.path, applyRouteMeta(shell, route, host));
  }

  const guides = readGuideFiles(ROOT);
  writeRoute(
    dist,
    GUIDE_INDEX_PATH,
    injectFallback(
      applyRouteMeta(shell, { path: GUIDE_INDEX_PATH, title: GUIDE_INDEX_TITLE, description: GUIDE_INDEX_DESCRIPTION }, host),
      guideIndexFallback(guides),
    ),
  );
  for (const guide of guides) {
    const page = injectFallback(
      injectJsonLd(
        applyRouteMeta(
          shell,
          { path: guide.path, title: guide.title, description: guide.description, ogType: 'article', image: guide.heroImage },
          host,
        ),
        guidePostingJsonLd(guide, host),
      ),
      guideFallback(guide, guides),
    );
    writeRoute(dist, guide.path, page);
  }

  writeFileSync(join(dist, 'sitemap.xml'), sitemapXml(host, SITEMAP_LASTMOD, guideSitemapEntries(ROOT)));
  writeFileSync(join(dist, 'robots.txt'), robotsTxt(host));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prerenderDist();
}
