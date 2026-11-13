import type { ComponentType } from 'react';
import { compareGuides, parseGuideSource, readingMinutes, type GuideFrontmatter } from './guide-frontmatter.ts';

export type GuideContent = ComponentType<{ components?: Record<string, unknown> }>;

export type Guide = GuideFrontmatter & {
  slug: string;
  path: `/guides/${string}`;
  minutes: number;
  body: string;
  Component: GuideContent;
};

type MdxModule = { default: GuideContent };

const compiled = import.meta.glob('/content/guides/*.mdx', { eager: true }) as Record<string, MdxModule>;
const sources = import.meta.glob('/content/guides/*.mdx', {
  query: '?guide-source',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function slugFromPath(path: string): string {
  const file = (path.split('/').pop() ?? '').split('?')[0] ?? '';
  return file.replace(/\.mdx$/, '');
}

function loadGuides(): Guide[] {
  return Object.entries(sources)
    .map(([path, source]) => {
      if (typeof source !== 'string') throw new Error(`Missing guide source for ${path}`);
      const slug = slugFromPath(path);
      const component = compiled[path.split('?')[0] ?? path]?.default;
      if (!component) throw new Error(`Missing MDX component for ${slug}`);
      const parsed = parseGuideSource(source, slug);
      return {
        ...parsed.frontmatter,
        slug,
        path: `/guides/${slug}` as const,
        minutes: readingMinutes(parsed.body),
        body: parsed.body,
        Component: component,
      };
    })
    .sort(compareGuides);
}

export const GUIDES: Guide[] = loadGuides();

export function guideBySlug(slug: string | undefined): Guide | undefined {
  if (!slug) return undefined;
  return GUIDES.find((guide) => guide.slug === slug);
}
