import { marked } from 'marked';
import type { GuideFile } from './guide-files.ts';
import { GUIDE_CTA } from '../src/lib/guide-cta.ts';
import { relatedGuides } from '../src/lib/guide-frontmatter.ts';
import { GUIDE_INDEX_DESCRIPTION, GUIDE_INDEX_TITLE } from '../src/lib/site.ts';

marked.use({ gfm: true, breaks: false });

export function guideFallback(guide: GuideFile, guides: readonly GuideFile[]): string {
  const related = relatedGuides(guides, guide.slug)
    .map((item) => `<li><a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a></li>`)
    .join('');
  return `<article><p>${escapeHtml(guide.category)}</p><h1>${escapeHtml(guide.title)}</h1><p>${escapeHtml(guide.description)}</p><p>${escapeHtml(guide.author)}</p><img src="${escapeHtml(guide.heroImage)}" alt="" />${markdownHtml(guide.body)}<p>${escapeHtml(GUIDE_CTA)}</p><p><a href="/#upload">Clean a track</a></p><nav aria-label="Related guides"><ul>${related}</ul></nav></article>`;
}

export function guideIndexFallback(guides: readonly GuideFile[]): string {
  const items = guides
    .map((guide) => `<li><a href="${escapeHtml(guide.path)}">${escapeHtml(guide.title)}</a></li>`)
    .join('');
  return `<article><h1>${escapeHtml(GUIDE_INDEX_TITLE)}</h1><p>${escapeHtml(GUIDE_INDEX_DESCRIPTION)}</p><ul>${items}</ul></article>`;
}

function markdownHtml(markdown: string): string {
  const withoutComponents = markdown.replace(/<Callout\b[^>]*>/g, '\n\n').replace(/<\/Callout>/g, '\n\n');
  const html = marked.parse(withoutComponents, { async: false, gfm: true });
  if (typeof html !== 'string') throw new Error('Markdown renderer returned a promise');
  if (html.includes('</noscript>')) throw new Error('Guide HTML cannot close the noscript fallback');
  return html;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
