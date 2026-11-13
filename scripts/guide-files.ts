import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareGuides, parseGuideSource, readingMinutes, type GuideFrontmatter } from '../src/lib/guide-frontmatter.ts';
import { GUIDE_INDEX_PATH, type SitemapEntry } from '../src/lib/site.ts';

export type GuideFile = GuideFrontmatter & {
  slug: string;
  path: `/guides/${string}`;
  minutes: number;
  body: string;
};

export function readGuideFiles(root: string): GuideFile[] {
  const dir = join(root, 'content', 'guides');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => {
      const slug = name.slice(0, -'.mdx'.length);
      const parsed = parseGuideSource(readFileSync(join(dir, name), 'utf8'), slug);
      return {
        ...parsed.frontmatter,
        slug,
        path: `/guides/${slug}` as const,
        minutes: readingMinutes(parsed.body),
        body: parsed.body,
      };
    })
    .sort(compareGuides);
}

export function guideSitemapEntries(root: string): SitemapEntry[] {
  const guides = readGuideFiles(root);
  const newest = guides.reduce((max, guide) => (guide.date > max ? guide.date : max), guides[0]?.date ?? '2026-11-12');
  return [{ path: GUIDE_INDEX_PATH, lastmod: newest }, ...guides.map((guide) => ({ path: guide.path, lastmod: guide.date }))];
}
