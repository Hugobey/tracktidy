import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  comparePosts,
  parseBlogSource,
  readingMinutes,
  type BlogFrontmatter,
} from '../src/lib/blog-frontmatter.ts';
import { BLOG_INDEX_PATH, type SitemapEntry } from '../src/lib/site.ts';

export type BlogFile = BlogFrontmatter & {
  slug: string;
  path: `/blog/${string}`;
  minutes: number;
  body: string;
};

export function readBlogFiles(root: string): BlogFile[] {
  const dir = join(root, 'content', 'blog');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => {
      const slug = name.slice(0, -'.mdx'.length);
      const parsed = parseBlogSource(readFileSync(join(dir, name), 'utf8'), slug);
      return {
        ...parsed.frontmatter,
        slug,
        path: `/blog/${slug}` as const,
        minutes: readingMinutes(parsed.body),
        body: parsed.body,
      };
    })
    .sort(comparePosts);
}

export function blogSitemapEntries(root: string): SitemapEntry[] {
  const posts = readBlogFiles(root);
  const newest = posts.reduce((max, post) => (post.date > max ? post.date : max), posts[0]?.date ?? '2026-11-12');
  return [{ path: BLOG_INDEX_PATH, lastmod: newest }, ...posts.map((post) => ({ path: post.path, lastmod: post.date }))];
}
