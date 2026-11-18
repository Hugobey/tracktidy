import { bpmToken, sanitizeToken } from './filename.ts';
import type { TrackFields } from './types.ts';

export type LibraryTokenId = 'artist' | 'title' | 'bpm' | 'key' | 'genre';

export type LibraryToken = {
  id: LibraryTokenId;
  on: boolean;
};

export const LIBRARY_TOKEN_LABEL: Record<LibraryTokenId, string> = {
  artist: 'Artist',
  title: 'Title',
  bpm: 'BPM',
  key: 'Key',
  genre: 'Genre',
};

export const DEFAULT_LIBRARY_TOKENS: LibraryToken[] = [
  { id: 'artist', on: true },
  { id: 'title', on: true },
  { id: 'bpm', on: true },
  { id: 'key', on: true },
  { id: 'genre', on: false },
];

function piece(token: LibraryTokenId, fields: TrackFields): string {
  if (token === 'bpm') {
    const bpm = bpmToken(fields.bpm);
    return bpm ? `[${bpm} BPM]` : '';
  }
  if (token === 'key') {
    const key = sanitizeToken(fields.key);
    return key ? `[${key}]` : '';
  }
  return sanitizeToken(fields[token]);
}

/** Filename from the active tokens, in the user's order. */
export function renderLibraryFilename(tokens: readonly LibraryToken[], fields: TrackFields): string {
  const parts = tokens.map((token) => (token.on ? piece(token.id, fields) : '')).filter(Boolean);
  if (parts.length === 0) return '';
  let name = '';
  for (const part of parts) {
    if (!name) {
      name = part;
      continue;
    }
    const bracket = part.startsWith('[');
    const previous = name.endsWith(']');
    name += bracket || previous ? ` ${part}` : ` - ${part}`;
  }
  if (name.length > 120) name = name.slice(0, 120).trim();
  return `${name}.mp3`;
}

export function libraryPatternLabel(tokens: readonly LibraryToken[]): string {
  const file = renderLibraryFilename(tokens, {
    artist: 'Artist',
    title: 'Title',
    remix: '',
    album: '',
    genre: 'Genre',
    bpm: '126',
    key: 'Key',
  });
  return file.replace(/\.mp3$/, '') || 'Add a filename token';
}

export function moveToken(tokens: readonly LibraryToken[], from: LibraryTokenId, to: LibraryTokenId): LibraryToken[] {
  if (from === to) return tokens.map((token) => ({ ...token }));
  const next = tokens.map((token) => ({ ...token }));
  const fromIndex = next.findIndex((token) => token.id === from);
  const toIndex = next.findIndex((token) => token.id === to);
  if (fromIndex < 0 || toIndex < 0) return next;
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function toggleToken(tokens: readonly LibraryToken[], id: LibraryTokenId): LibraryToken[] {
  return tokens.map((token) => (token.id === id ? { ...token, on: !token.on } : { ...token }));
}
