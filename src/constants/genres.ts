export type GenreOption = {
  label: string;
  slug: string;
  ink: string;
  wash: string;
  inkLight: string;
  washLight: string;
};

/** Curated DJ and electronic genres. Slugs stay single-hyphen so class names stay stable. */
export const GENRE_OPTIONS: readonly GenreOption[] = [
  { label: 'House', slug: 'house', ink: '#fbbf24', wash: 'rgba(217, 119, 6, 0.16)', inkLight: '#b45309', washLight: 'rgba(217, 119, 6, 0.14)' },
  { label: 'Tech House', slug: 'tech-house', ink: '#fdba74', wash: 'rgba(234, 88, 12, 0.16)', inkLight: '#c2410c', washLight: 'rgba(234, 88, 12, 0.14)' },
  { label: 'Deep House', slug: 'deep-house', ink: '#fde047', wash: 'rgba(202, 138, 4, 0.16)', inkLight: '#a16207', washLight: 'rgba(202, 138, 4, 0.16)' },
  { label: 'Afro House', slug: 'afro-house', ink: '#bef264', wash: 'rgba(101, 163, 13, 0.16)', inkLight: '#4d7c0f', washLight: 'rgba(101, 163, 13, 0.16)' },
  { label: 'Melodic House & Techno', slug: 'melodic-house', ink: '#7dd3fc', wash: 'rgba(2, 132, 199, 0.16)', inkLight: '#0369a1', washLight: 'rgba(2, 132, 199, 0.14)' },
  { label: 'Progressive House', slug: 'progressive-house', ink: '#93c5fd', wash: 'rgba(37, 99, 235, 0.16)', inkLight: '#1d4ed8', washLight: 'rgba(37, 99, 235, 0.12)' },
  { label: 'Organic House', slug: 'organic-house', ink: '#86efac', wash: 'rgba(22, 163, 74, 0.16)', inkLight: '#15803d', washLight: 'rgba(22, 163, 74, 0.14)' },
  { label: 'Techno', slug: 'techno', ink: '#67e8f9', wash: 'rgba(8, 145, 178, 0.16)', inkLight: '#0e7490', washLight: 'rgba(8, 145, 178, 0.14)' },
  { label: 'Peak Time Techno', slug: 'peak-time-techno', ink: '#a5b4fc', wash: 'rgba(79, 70, 229, 0.16)', inkLight: '#4338ca', washLight: 'rgba(79, 70, 229, 0.12)' },
  { label: 'Hard Techno', slug: 'hard-techno', ink: '#fda4af', wash: 'rgba(225, 29, 72, 0.16)', inkLight: '#be123c', washLight: 'rgba(225, 29, 72, 0.12)' },
  { label: 'Minimal / Deep Tech', slug: 'minimal-deep-tech', ink: '#c4b5fd', wash: 'rgba(124, 58, 237, 0.16)', inkLight: '#6d28d9', washLight: 'rgba(124, 58, 237, 0.12)' },
  { label: 'Electro', slug: 'electro', ink: '#f0abfc', wash: 'rgba(192, 38, 211, 0.16)', inkLight: '#a21caf', washLight: 'rgba(192, 38, 211, 0.12)' },
  { label: 'Breaks', slug: 'breaks', ink: '#d8b4fe', wash: 'rgba(147, 51, 234, 0.16)', inkLight: '#7e22ce', washLight: 'rgba(147, 51, 234, 0.12)' },
  { label: 'UK Garage', slug: 'uk-garage', ink: '#f9a8d4', wash: 'rgba(219, 39, 119, 0.16)', inkLight: '#be185d', washLight: 'rgba(219, 39, 119, 0.12)' },
  { label: 'Drum & Bass', slug: 'drum-and-bass', ink: '#fb7185', wash: 'rgba(190, 18, 60, 0.16)', inkLight: '#9f1239', washLight: 'rgba(190, 18, 60, 0.12)' },
  { label: 'Jungle', slug: 'jungle', ink: '#6ee7b7', wash: 'rgba(5, 150, 105, 0.16)', inkLight: '#047857', washLight: 'rgba(5, 150, 105, 0.14)' },
  { label: 'Dubstep', slug: 'dubstep', ink: '#fca5a5', wash: 'rgba(220, 38, 38, 0.16)', inkLight: '#b91c1c', washLight: 'rgba(220, 38, 38, 0.12)' },
  { label: 'Trance', slug: 'trance', ink: '#60a5fa', wash: 'rgba(29, 78, 216, 0.16)', inkLight: '#1e40af', washLight: 'rgba(29, 78, 216, 0.12)' },
  { label: 'Psytrance', slug: 'psytrance', ink: '#5eead4', wash: 'rgba(13, 148, 136, 0.16)', inkLight: '#0f766e', washLight: 'rgba(13, 148, 136, 0.14)' },
  { label: 'Disco / Nu-Disco', slug: 'disco', ink: '#fcd34d', wash: 'rgba(217, 119, 6, 0.18)', inkLight: '#b45309', washLight: 'rgba(217, 119, 6, 0.14)' },
  { label: 'Indie Dance', slug: 'indie-dance', ink: '#d6d3d1', wash: 'rgba(120, 113, 108, 0.20)', inkLight: '#57534e', washLight: 'rgba(120, 113, 108, 0.16)' },
  { label: 'Ambient / Downtempo', slug: 'ambient', ink: '#cbd5e1', wash: 'rgba(71, 85, 105, 0.20)', inkLight: '#334155', washLight: 'rgba(71, 85, 105, 0.14)' },
  { label: 'Hip-Hop / R&B', slug: 'hip-hop', ink: '#a3e635', wash: 'rgba(132, 204, 22, 0.16)', inkLight: '#3f6212', washLight: 'rgba(132, 204, 22, 0.14)' },
  { label: 'Pop / Dance', slug: 'pop-dance', ink: '#fb923c', wash: 'rgba(234, 88, 12, 0.16)', inkLight: '#9a3412', washLight: 'rgba(234, 88, 12, 0.14)' },
  { label: 'Latin / Baile', slug: 'latin', ink: '#fb7185', wash: 'rgba(249, 115, 22, 0.18)', inkLight: '#c2410c', washLight: 'rgba(249, 115, 22, 0.14)' },
] as const;

const SPLIT = /[;/,]+/;
const HOLD = '\uE000';
const HOLD_TOKEN = new RegExp(`^${HOLD}(\\d+)${HOLD}$`);

export function genreSlug(label: string): string {
  const key = label.trim().toLowerCase();
  return GENRE_OPTIONS.find((genre) => genre.label.toLowerCase() === key)?.slug ?? 'custom';
}

export function genreTagCss(): string {
  const dark = GENRE_OPTIONS.map(
    (genre) => `.genre-tag[data-tone="${genre.slug}"]{color:${genre.ink};background:${genre.wash}}`,
  ).join('');
  const light = GENRE_OPTIONS.map(
    (genre) =>
      `.lib-page .genre-tag[data-tone="${genre.slug}"],.genre-menu-library .genre-tag[data-tone="${genre.slug}"]{color:${genre.inkLight};background:${genre.washLight}}`,
  ).join('');
  return `${dark}@media (prefers-color-scheme: light){${light}}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function canonicalLabel(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const known = GENRE_OPTIONS.find((genre) => genre.label.toLowerCase() === trimmed.toLowerCase());
  return known ? known.label : trimmed;
}

function protectKnownPhrases(raw: string): { text: string; holds: string[] } {
  const holds: string[] = [];
  let text = raw;
  const phrases = GENRE_OPTIONS.filter((genre) => /[/,&]/.test(genre.label)).sort((a, b) => b.label.length - a.label.length);
  for (const genre of phrases) {
    const pattern = new RegExp(escapeRegExp(genre.label), 'ig');
    text = text.replace(pattern, () => {
      const token = `${HOLD}${holds.length}${HOLD}`;
      holds.push(genre.label);
      return token;
    });
  }
  return { text, holds };
}

/** Split a TCON string on semicolons, slashes, and commas. Known phrases that contain those marks stay intact. */
export function parseGenreTags(raw: string): string[] {
  const source = raw.trim();
  if (!source) return [];
  const { text, holds } = protectKnownPhrases(source);
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(SPLIT)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const token = HOLD_TOKEN.exec(trimmed);
    const label = token ? holds[Number(token[1])] ?? '' : canonicalLabel(trimmed);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    tags.push(label);
  }
  return tags;
}

export function joinGenreTags(tags: string[]): string {
  return parseGenreTags(tags.join(';')).join(';');
}

function bounded(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  if (before && /[a-z0-9]/i.test(before)) return false;
  if (after && /[a-z0-9]/i.test(after)) return false;
  return true;
}

/** Local match against filenames, albums, and comments. No network lookup. */
export function inferGenreTags(sources: string[]): string[] {
  const text = sources.filter((value) => value.trim()).join('\n');
  if (!text.trim()) return [];
  const lower = text.toLowerCase();
  const ranked = [...GENRE_OPTIONS].sort((a, b) => b.label.length - a.label.length);
  const found: { label: string; start: number; end: number }[] = [];
  for (const genre of ranked) {
    const needle = genre.label.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      const overlaps = found.some((hit) => at < hit.end && end > hit.start);
      if (!overlaps && bounded(lower, at, end)) found.push({ label: genre.label, start: at, end });
      from = at + 1;
    }
  }
  found.sort((a, b) => a.start - b.start);
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const hit of found) {
    const key = hit.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(hit.label);
  }
  return tags;
}

export function settleGenre(
  raw: string,
  hints: { filename?: string; album?: string; comment?: string } = {},
): string {
  const parsed = parseGenreTags(raw);
  if (parsed.length > 0) return parsed.join(';');
  return inferGenreTags([hints.filename ?? '', hints.album ?? '', hints.comment ?? '']).join(';');
}
