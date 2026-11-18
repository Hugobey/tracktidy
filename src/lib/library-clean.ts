import type { WaveBand } from './audio.ts';
import { applyTextCleanup } from './crate.ts';
import type { FallbackPayload, TrackFields } from './types.ts';

export type { WaveBand };

export type LibraryTrack = {
  id: string;
  sourceName: string;
  fields: TrackFields;
  cleaned: TrackFields;
  original: TrackFields;
  buffer: ArrayBuffer | null;
  bands: WaveBand[] | null;
  analysing: boolean;
  coverUrl: string | null;
  skeleton: boolean;
  scanning: boolean;
  failed: boolean;
  enterDelay: number;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
};

export const LIBRARY_LIMIT = 50;
export const FREE_LIBRARY_LIMIT = 5;
export const WAVE_BARS = 48;

export type GenreFamily = 'house' | 'techno' | 'dnb' | 'hiphop' | 'breaks' | 'other';

export function libraryRoom(count: number, pro: boolean): number {
  return Math.max(0, (pro ? LIBRARY_LIMIT : FREE_LIBRARY_LIMIT) - count);
}

export function genreFamily(genre: string): GenreFamily | 'empty' {
  const value = genre.trim().toLowerCase().replace(/&/g, ' and ').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return 'empty';
  if (/\b(drum and bass|drum n bass|dnb|jungle)\b/.test(value)) return 'dnb';
  if (/\b(hip hop|hiphop|rap|trap|r and b)\b/.test(value)) return 'hiphop';
  if (/\b(techno|minimal|industrial)\b/.test(value)) return 'techno';
  if (/\b(breakbeat|breaks)\b/.test(value)) return 'breaks';
  if (/\bhouse\b/.test(value)) return 'house';
  return 'other';
}

const CORE = ['artist', 'title', 'bpm', 'key'] as const;
const WATCHED = ['artist', 'title', 'remix', 'album', 'genre', 'bpm', 'key'] as const;

export type LibraryMark = 'cleaned' | 'review' | 'edited' | 'pending';
export type LibraryFilter = 'all' | 'cleaned' | 'review';

/** Strip promo text, then fix casing. BPM and key are left as they were read. */
export function autoCleanFields(fields: TrackFields): TrackFields {
  return applyTextCleanup(applyTextCleanup(fields, 'strip'), 'case');
}

export function libraryStatus(fields: TrackFields, cleaned: TrackFields): Exclude<LibraryMark, 'pending'> {
  const missing = CORE.some((key) => !fields[key].trim());
  if (missing) return 'review';
  const edited = WATCHED.some((key) => fields[key].trim() !== cleaned[key].trim());
  return edited ? 'edited' : 'cleaned';
}

export function libraryFieldsDiffer(fields: TrackFields, cleaned: TrackFields): boolean {
  return WATCHED.some((key) => fields[key].trim() !== cleaned[key].trim());
}

export function visibleLibraryStatus(track: { fields: TrackFields; cleaned: TrackFields; analysing: boolean }): LibraryMark {
  const status = libraryStatus(track.fields, track.cleaned);
  if (track.analysing && status === 'review') return 'pending';
  return status;
}

export function trackMatchesFilter(status: LibraryMark, filter: LibraryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'cleaned') return status === 'cleaned';
  return status === 'review' || status === 'pending';
}
