import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { INDEXABLE_ROUTES, canonicalUrl, robotsTxt, sitemapXml } from '../src/lib/site.ts';

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function setMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const pattern = new RegExp(`<meta\\b[^>]*\\b${attr}="${key}"[^>]*>`);
  if (!pattern.test(html)) throw new Error(`Missing meta ${attr}="${key}"`);
  return html.replace(pattern, `<meta ${attr}="${key}" content="${content}" />`);
}

/** Rewrites the homepage shell so a route has its own title, description, and canonical URL. */
export function applyRouteMeta(html: string, route: (typeof INDEXABLE_ROUTES)[number], origin: string): string {
  const title = escapeAttr(route.title);
  const description = escapeAttr(route.description);
  const canonical = canonicalUrl(route.path, origin);
  const image = `${origin}/og.png`;
  let next = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  next = setMeta(next, 'name', 'description', description);
  next = setMeta(next, 'name', 'robots', 'index,follow');
  next = next.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`);
  next = setMeta(next, 'property', 'og:title', title);
  next = setMeta(next, 'property', 'og:description', description);
  next = setMeta(next, 'property', 'og:url', canonical);
  next = setMeta(next, 'property', 'og:image', image);
  next = setMeta(next, 'name', 'twitter:title', title);
  next = setMeta(next, 'name', 'twitter:description', description);
  next = setMeta(next, 'name', 'twitter:image', image);
  return next;
}

export function prerenderDist(dist = join(process.cwd(), 'dist'), origin?: string): void {
  const shell = readFileSync(join(dist, 'index.html'), 'utf8');
  const host = origin ?? new URL(canonicalUrl('/')).origin;
  for (const route of INDEXABLE_ROUTES) {
    const rendered = applyRouteMeta(shell, route, host);
    const file = route.path === '/' ? join(dist, 'index.html') : join(dist, route.path.slice(1), 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, rendered);
  }
  writeFileSync(join(dist, 'sitemap.xml'), sitemapXml(host));
  writeFileSync(join(dist, 'robots.txt'), robotsTxt(host));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prerenderDist();
}
