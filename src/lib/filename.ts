import type { TrackFields } from './types.ts';

export const DEFAULT_TEMPLATE = '{artist} - {title} ({bpm} BPM) [{key}]';

export const FILENAME_PRESETS = [
  { id: 'basic', label: 'Artist - Title', template: '{artist} - {title}' },
  { id: 'bpm', label: 'With BPM', template: '{artist} - {title} ({bpm} BPM)' },
  { id: 'full', label: 'BPM and key', template: DEFAULT_TEMPLATE },
  { id: 'remix', label: 'With remix', template: '{artist} - {title} ({remix})' },
] as const;

const TOKEN = /\{(artist|title|remix|version|album|genre|bpm|key)\}/gi;
const EMPTY = '\uE000';
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export type FilenamePreview = {
  name: string;
  file: string;
  missing: string[];
  invalidBpm: boolean;
};

export function bpmToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n));
}

const FORBIDDEN = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);

export function sanitizeToken(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    out += code < 32 || FORBIDDEN.has(char) ? ' ' : char;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function cleanup(input: string): string {
  let s = input;
  s = s.replace(new RegExp(`\\([^()\\n]*${EMPTY}[^()\\n]*\\)`, 'g'), '');
  s = s.replace(new RegExp(`\\[[^\\]\\n]*${EMPTY}[^\\]\\n]*\\]`, 'g'), '');
  s = s.split(EMPTY).join('');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/(\s[-–—]\s*){2,}/g, ' - ');
  s = s.replace(/\s+([)\].;,])/g, '$1');
  s = s.replace(/\(\s+/g, '(');
  s = s.replace(/\[\s+/g, '[');
  s = s.replace(/^[\s\-–—._]+/, '');
  s = s.replace(/[\s\-–—._]+$/, '');
  s = s.trim();
  return s;
}

export function renderFilename(template: string, fields: TrackFields): FilenamePreview {
  const missing: string[] = [];
  let invalidBpm = false;

  const rendered = template.replace(TOKEN, (match) => {
    const token = match.slice(1, -1);
    const key = token.toLowerCase() === 'version' ? 'remix' : token.toLowerCase();
    const source = fields[key as keyof TrackFields] ?? '';
    if (key === 'bpm') {
      const bpm = bpmToken(source);
      if (!bpm) {
        if (source.trim()) invalidBpm = true;
        missing.push('bpm');
        return EMPTY;
      }
      return bpm;
    }
    const value = sanitizeToken(source);
    if (!value) {
      missing.push(key);
      return EMPTY;
    }
    return value;
  });

  let name = sanitizeToken(cleanup(rendered)).replace(/[. ]+$/g, '').trim();
  if (name.length > 120) name = name.slice(0, 120).trim();
  if (RESERVED.test(name)) name = `${name} track`;

  const uniqueMissing = [...new Set(missing)];
  return {
    name,
    file: name ? `${name}.mp3` : '',
    missing: uniqueMissing,
    invalidBpm,
  };
}
