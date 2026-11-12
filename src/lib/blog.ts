import type { ComponentType } from 'react';
import {
  comparePosts,
  parseBlogSource,
  readingMinutes,
  type BlogFrontmatter,
} from './blog-frontmatter.ts';

export type BlogContent = ComponentType<{ components?: Record<string, unknown> }>;

export type BlogPost = BlogFrontmatter & {
  slug: string;
  path: `/blog/${string}`;
  minutes: number;
  body: string;
  Component: BlogContent;
};

type MdxModule = { default: BlogContent };

const compiled = import.meta.glob('/content/blog/*.mdx', { eager: true }) as Record<string, MdxModule>;
const sources = import.meta.glob('/content/blog/*.mdx', {
  query: '?blog-source',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function slugFromPath(path: string): string {
  const file = (path.split('/').pop() ?? '').split('?')[0] ?? '';
  return file.replace(/\.mdx$/, '');
}

function loadPosts(): BlogPost[] {
  return Object.entries(sources)
    .map(([path, source]) => {
      if (typeof source !== 'string') throw new Error(`Missing blog source for ${path}`);
      const slug = slugFromPath(path);
      const component = compiled[path.split('?')[0] ?? path]?.default;
      if (!component) throw new Error(`Missing MDX component for ${slug}`);
      const parsed = parseBlogSource(source, slug);
      return {
        ...parsed.frontmatter,
        slug,
        path: `/blog/${slug}` as const,
        minutes: readingMinutes(parsed.body),
        body: parsed.body,
        Component: component,
      };
    })
    .sort(comparePosts);
}

export const BLOG_POSTS: BlogPost[] = loadPosts();

export function blogPost(slug: string | undefined): BlogPost | undefined {
  if (!slug) return undefined;
  return BLOG_POSTS.find((post) => post.slug === slug);
}
