import { PUBLISHER } from '../legal/publisher.ts';

/** Production origin assumed from the track-tidy.com mail domain. Override with VITE_SITE_URL. */
export const DEFAULT_ORIGIN = 'https://track-tidy.com';

export const HOME_TITLE = 'TrackTidy — DJ file renamer and MP3 metadata editor';
export const HOME_DESCRIPTION =
  'DJ file renamer and MP3 metadata editor. Detect BPM, estimate musical key, and generate MP3 filenames. One track at a time, in your browser.';

export const TOOL_TITLE = 'MP3 metadata editor — TrackTidy';
export const TOOL_DESCRIPTION =
  'MP3 metadata and BPM editor for one track. Detect tempo, estimate key, edit tags, and generate a filename without re-encoding.';

export function siteOrigin(raw: string | undefined = import.meta.env.VITE_SITE_URL): string {
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
