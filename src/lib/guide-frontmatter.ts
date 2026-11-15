import { PUBLISHER } from '../legal/publisher.ts';
import { canonicalUrl, siteOrigin } from './site.ts';

export type GuideFrontmatter = {
  title: string;
  pageTitle: string;
  description: string;
  date: string;
  author: string;
  authorRole: string;
  category: string;
  heroImage: string;
  heroAlt: string;
  ogImage: string;
  keywords: string[];
};

/** Related guides, skipping the current page. Same order on every article. */
export const RELATED_GUIDE_ORDER = [
  'find-bpm-of-a-song-online',
  'camelot-wheel-harmonic-mixing',
  'prepare-usb-for-cdj',
  'edit-mp3-metadata-online',
  'batch-rename-mp3-files-online',
  'edit-mp3-tags-in-bulk',
] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HERO = /^\/images\/guides\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/;

/** Subset of YAML used by `content/guides`. Values may be quoted. Lists use two-space dashes. */
export function parseGuideSource(source: string, slug: string): { frontmatter: GuideFrontmatter; body: string } {
  if (!SLUG.test(slug)) throw new Error(`Bad guide slug: ${slug}`);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`Missing frontmatter in ${slug}`);
  const data = parseFields(match[1] ?? '', slug);
  const declared = data.slug;
  if (typeof declared === 'string' && declared !== slug) throw new Error(`Slug mismatch in ${slug}`);
  const date = requiredString(data, 'date', slug);
  if (!isIsoDate(date)) throw new Error(`Bad date in ${slug}`);
  const heroImage = requiredString(data, 'heroImage', slug);
  if (!HERO.test(heroImage)) throw new Error(`Bad hero image in ${slug}`);
  const ogImage = optionalString(data, 'ogImage');
  if (ogImage && !HERO.test(ogImage)) throw new Error(`Bad og image in ${slug}`);
  const keywords = data.keywords;
  const title = requiredString(data, 'title', slug);
  return {
    frontmatter: {
      title,
      pageTitle: optionalString(data, 'pageTitle') || title,
      description: requiredString(data, 'description', slug),
      date,
      author: requiredString(data, 'author', slug),
      authorRole: optionalString(data, 'authorRole'),
      category: requiredString(data, 'category', slug),
      heroImage,
      heroAlt: optionalString(data, 'heroAlt'),
      ogImage: ogImage || heroImage,
      keywords: Array.isArray(keywords) ? keywords : [],
    },
    body: source.slice(match[0].length),
  };
}

export function readingMinutes(body: string): number {
  const words = body.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function readingLabel(minutes: number): string {
  return `${minutes} min read`;
}

export function formatGuideDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function compareGuides<T extends { date: string; slug: string }>(a: T, b: T): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.slug.localeCompare(b.slug);
}

export function relatedGuides<T extends { slug: string }>(guides: readonly T[], slug: string): T[] {
  const rank = new Map<string, number>(RELATED_GUIDE_ORDER.map((id, index) => [id, index]));
  return guides
    .filter((guide) => guide.slug !== slug)
    .sort((a, b) => {
      const left = rank.get(a.slug) ?? RELATED_GUIDE_ORDER.length;
      const right = rank.get(b.slug) ?? RELATED_GUIDE_ORDER.length;
      if (left !== right) return left - right;
      return a.slug.localeCompare(b.slug);
    });
}

export function guideFaqs(body: string): { question: string; answer: string }[] {
  const heading = body.match(/^## Quick answers\s*$/m);
  if (!heading || heading.index === undefined) return [];
  const section = body.slice(heading.index + heading[0].length).split(/^## /m)[0] ?? '';
  return section
    .split(/^### /m)
    .slice(1)
    .map((chunk) => {
      const [questionLine, ...rest] = chunk.split('\n');
      const question = (questionLine ?? '').trim();
      const answer = (rest.join('\n').trim().split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
      return { question, answer };
    })
    .filter((faq) => faq.question !== '' && faq.answer !== '');
}

export function guideFaqJsonLd(body: string): Record<string, unknown> | null {
  const faqs = guideFaqs(body);
  if (faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function guidePostingJsonLd(
  guide: {
    title: string;
    description: string;
    date: string;
    path: string;
    author: string;
    authorRole: string;
    heroImage: string;
    ogImage?: string;
  },
  origin = siteOrigin(),
): Record<string, unknown> {
  const url = canonicalUrl(guide.path, origin);
  const author: Record<string, unknown> = { '@type': 'Person', name: guide.author };
  if (guide.authorRole) author.jobTitle = guide.authorRole;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: guide.title,
    description: guide.description,
    datePublished: guide.date,
    inLanguage: 'en',
    url,
    image: new URL(guide.ogImage || guide.heroImage, `${origin}/`).href,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author,
    publisher: {
      '@type': 'Organization',
      name: PUBLISHER.brand,
      url: `${origin}/`,
      logo: { '@type': 'ImageObject', url: `${origin}/favicon.svg` },
    },
  };
}

function parseFields(raw: string, slug: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const item = /^  - (.+)$/.exec(line);
    if (item && listKey) {
      const current = result[listKey];
      const value = unquote(item[1] ?? '');
      if (!value) throw new Error(`Empty list item in ${slug}`);
      if (Array.isArray(current)) current.push(value);
      else result[listKey] = [value];
      continue;
    }
    const field = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`Bad frontmatter line in ${slug}`);
    const key = field[1] ?? '';
    const value = field[2] ?? '';
    if (value.trim() === '') {
      result[key] = [];
      listKey = key;
      continue;
    }
    listKey = null;
    result[key] = unquote(value);
  }
  return result;
}

function requiredString(data: Record<string, string | string[]>, key: string, slug: string): string {
  const value = data[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing ${key} in ${slug}`);
  return value.trim();
}

function optionalString(data: Record<string, string | string[]>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
