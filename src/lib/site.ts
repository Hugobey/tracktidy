import { PUBLISHER } from '../legal/publisher.ts';

/** The live site answers on www. Apex redirects there. Override with VITE_SITE_URL. */
export const DEFAULT_ORIGIN = 'https://www.track-tidy.com';

export const SITEMAP_LASTMOD = '2026-11-09';

export const BLOG_INDEX_PATH = '/blog';
export const BLOG_INDEX_TITLE = 'DJ library guides — TrackTidy';
export const BLOG_INDEX_DESCRIPTION =
  'Practical guides for cleaning MP3 tags, renaming files, and reading BPM and key. One track at a time, in the browser.';

export const HOME_TITLE = 'TrackTidy — DJ file renamer and MP3 metadata editor';
export const HOME_DESCRIPTION =
  'DJ file renamer and MP3 metadata editor. Detect BPM, estimate musical key, and generate MP3 filenames. One track at a time, in your browser.';

export const TOOL_TITLE = 'MP3 metadata editor — TrackTidy';
export const TOOL_DESCRIPTION =
  'MP3 metadata and BPM editor for one track. Detect tempo, estimate key, edit tags, and generate a filename without re-encoding.';

function configuredOrigin(): string | undefined {
  const env = (import.meta as ImportMeta & { env?: { VITE_SITE_URL?: string } }).env;
  if (!env || typeof env.VITE_SITE_URL !== 'string') return undefined;
  return env.VITE_SITE_URL;
}

export function siteOrigin(raw: string | undefined = configuredOrigin()): string {
  if (typeof raw !== 'string' || raw.trim() === '') return DEFAULT_ORIGIN;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') return DEFAULT_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

export function canonicalUrl(path: string, origin = siteOrigin()): string {
  if (path === '/') return `${origin}/`;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export type IndexableRoute = {
  path: '/' | '/app' | '/privacy-policy' | '/terms-of-use' | '/cookie-policy' | '/legal-notice';
  title: string;
  description: string;
};

export const INDEXABLE_ROUTES: IndexableRoute[] = [
  { path: '/', title: HOME_TITLE, description: HOME_DESCRIPTION },
  { path: '/app', title: TOOL_TITLE, description: TOOL_DESCRIPTION },
  {
    path: '/privacy-policy',
    title: 'Privacy policy — TrackTidy',
    description: 'How TrackTidy handles audio files, metadata, local storage, and optional analytics.',
  },
  {
    path: '/terms-of-use',
    title: 'Terms of use — TrackTidy',
    description: 'The rules for using TrackTidy, including file rights and the limits of BPM and key estimates.',
  },
  {
    path: '/cookie-policy',
    title: 'Cookie policy — TrackTidy',
    description: 'The storage and cookies TrackTidy uses, and how to accept or reject analytics.',
  },
  {
    path: '/legal-notice',
    title: 'Legal notice — TrackTidy',
    description: 'Publisher information for the TrackTidy website.',
  },
];

export function routeMeta(path: IndexableRoute['path']): IndexableRoute {
  const found = INDEXABLE_ROUTES.find((route) => route.path === path);
  if (!found) throw new Error(`Unknown public route: ${path}`);
  return found;
}

export type SitemapEntry = {
  path: string;
  lastmod: string;
};

export function sitemapXml(origin = DEFAULT_ORIGIN, lastmod = SITEMAP_LASTMOD, extra: SitemapEntry[] = []): string {
  const entries: SitemapEntry[] = [...INDEXABLE_ROUTES.map((route) => ({ path: route.path, lastmod })), ...extra];
  const urls = entries
    .map((entry) => `  <url>\n    <loc>${canonicalUrl(entry.path, origin)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(origin = DEFAULT_ORIGIN): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function homeJsonLd(origin = siteOrigin()): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: PUBLISHER.brand,
        url: `${origin}/`,
        email: PUBLISHER.hello,
        logo: `${origin}/favicon.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: PUBLISHER.brand,
        url: `${origin}/`,
        description: HOME_DESCRIPTION,
        inLanguage: 'en',
        publisher: { '@id': `${origin}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        name: PUBLISHER.brand,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        url: `${origin}/app`,
        description: TOOL_DESCRIPTION,
        isAccessibleForFree: true,
      },
    ],
  };
}
