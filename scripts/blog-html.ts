import { marked } from 'marked';
import type { BlogFile } from './blog-files.ts';
import { BLOG_CTA } from '../src/lib/blog-cta.ts';
import { relatedPosts } from '../src/lib/blog-frontmatter.ts';
import { BLOG_INDEX_DESCRIPTION, BLOG_INDEX_TITLE } from '../src/lib/site.ts';

marked.use({ gfm: true, breaks: false });

export function articleFallback(post: BlogFile, posts: readonly BlogFile[]): string {
  const related = relatedPosts(posts, post.slug)
    .map((item) => `<li><a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a></li>`)
    .join('');
  return `<article><h1>${escapeHtml(post.title)}</h1>${markdownHtml(post.body)}<p>${escapeHtml(BLOG_CTA)}</p><p><a href="/app">Clean a track</a></p><nav aria-label="Related guides"><ul>${related}</ul></nav></article>`;
}

export function blogIndexFallback(posts: readonly BlogFile[]): string {
  const items = posts
    .map((post) => `<li><a href="${escapeHtml(post.path)}">${escapeHtml(post.title)}</a></li>`)
    .join('');
  return `<article><h1>${escapeHtml(BLOG_INDEX_TITLE)}</h1><p>${escapeHtml(BLOG_INDEX_DESCRIPTION)}</p><ul>${items}</ul></article>`;
}

function markdownHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true });
  if (typeof html !== 'string') throw new Error('Markdown renderer returned a promise');
  if (html.includes('</noscript>')) throw new Error('Blog HTML cannot close the noscript fallback');
  return html;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
