import type { TrackFields } from './types.ts';

export const CRATE_LIMIT = 24;

export const CRATE_TOKENS = ['artist', 'title', 'bpm', 'key'] as const;
export type CrateToken = (typeof CRATE_TOKENS)[number];

const SMALL = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'vs', 'feat']);

const PROMO = [
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /[[(]\s*\d+\s*kbps\s*[\])]/gi,
  /[[(]\s*master\s*[\])]/gi,
  /[[(]\s*promo\s*[\])]/gi,
  /[[(]\s*free\s*download\s*[\])]/gi,
];

export function stripPromoText(value: string): string {
  let next = value;
  for (const pattern of PROMO) next = next.replace(pattern, ' ');
  return next.replace(/\s+/g, ' ').replace(/\s+([)\].;,])/g, '$1').trim();
}

export function titleCaseText(value: string): string {
  const words = value.split(/(\s+)/);
  let seen = 0;
  const letterWords = words.filter((word) => /[A-Za-z]/.test(word)).length;
  return words
    .map((word) => {
      if (!/[A-Za-z]/.test(word)) return word;
      seen += 1;
      const match = /^([^A-Za-z]*)([A-Za-z])([A-Za-z']*)([^A-Za-z]*)$/.exec(word);
      if (!match) return word;
      const [, pre, first, rest, post] = match;
      const body = `${first}${rest}`.toLowerCase();
      const force = seen === 1 || seen === letterWords;
      const cased = !force && SMALL.has(body) ? body : body.charAt(0).toUpperCase() + body.slice(1);
      return `${pre}${cased}${post}`;
    })
    .join('');
}

export function crateTemplate(active: Record<CrateToken, boolean>): string {
  const name = [active.artist ? '{artist}' : '', active.title ? '{title}' : ''].filter(Boolean).join(' - ');
  const tail = [active.bpm ? '({bpm} BPM)' : '', active.key ? '[{key}]' : ''].filter(Boolean).join(' ');
  return [name, tail].filter(Boolean).join(' ').trim();
}

export function tokensFromTemplate(template: string): Record<CrateToken, boolean> {
  const lower = template.toLowerCase();
  return {
    artist: lower.includes('{artist}'),
    title: lower.includes('{title}'),
    bpm: lower.includes('{bpm}'),
    key: lower.includes('{key}'),
  };
}

export function fieldChanged(fields: TrackFields, original: TrackFields, key: keyof TrackFields): boolean {
  return fields[key].trim() !== original[key].trim();
}

export function applyTextCleanup(fields: TrackFields, mode: 'strip' | 'case'): TrackFields {
  const keys = ['artist', 'title', 'album', 'genre'] as const;
  const next = { ...fields };
  for (const key of keys) {
    next[key] = mode === 'strip' ? stripPromoText(fields[key]) : titleCaseText(fields[key]);
  }
  return next;
}
