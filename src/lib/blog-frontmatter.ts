import { PUBLISHER } from '../legal/publisher.ts';
import { canonicalUrl, siteOrigin } from './site.ts';

export type BlogFrontmatter = {
  title: string;
  description: string;
  date: string;
  cluster: string;
  keywords: string[];
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Subset of YAML used by `content/blog`. Values may be quoted. Lists use two-space dashes. */
export function parseBlogSource(source: string, slug: string): { frontmatter: BlogFrontmatter; body: string } {
  if (!SLUG.test(slug)) throw new Error(`Bad blog slug: ${slug}`);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error(`Missing frontmatter in ${slug}`);
  const data = parseFields(match[1] ?? '', slug);
  const date = requiredString(data, 'date', slug);
  if (!isIsoDate(date)) throw new Error(`Bad date in ${slug}`);
  const keywords = data.keywords;
  if (!Array.isArray(keywords) || keywords.length === 0) throw new Error(`Missing keywords in ${slug}`);
  return {
    frontmatter: {
      title: requiredString(data, 'title', slug),
      description: requiredString(data, 'description', slug),
      date,
      cluster: requiredString(data, 'cluster', slug),
      keywords,
    },
    body: source.slice(match[0].length),
  };
}

export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function readingLabel(minutes: number): string {
  return `${minutes} min read`;
}

export function formatBlogDate(iso: string): string {
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

export function comparePosts<T extends { date: string; slug: string }>(a: T, b: T): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.slug.localeCompare(b.slug);
}

export function relatedPosts<T extends { slug: string; cluster: string }>(posts: readonly T[], slug: string, count = 2): T[] {
  const current = posts.find((post) => post.slug === slug);
  const others = posts.filter((post) => post.slug !== slug);
  const same = others.filter((post) => post.cluster === current?.cluster);
  const rest = others.filter((post) => post.cluster !== current?.cluster);
  return [...same, ...rest].slice(0, count);
}

export function blogPostingJsonLd(
  post: { title: string; description: string; date: string; path: string },
  origin = siteOrigin(),
): Record<string, unknown> {
  const url = canonicalUrl(post.path, origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    inLanguage: 'en',
    url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Organization',
      name: PUBLISHER.brand,
      url: `${origin}/`,
    },
    publisher: {
      '@type': 'Organization',
      name: PUBLISHER.brand,
      url: `${origin}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${origin}/favicon.svg`,
      },
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
      if (!value) throw new Error(`Empty keyword in ${slug}`);
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
