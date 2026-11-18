import type { WaveBand } from '../lib/audio.ts';
import type { LibraryTrack } from '../lib/library-clean.ts';
import type { FallbackPayload, TrackFields } from '../lib/types.ts';

/** Tag fields plus the output filename and cover. Cover is a blob URL and stays in memory. */
export type TrackMetadata = {
  artist: string;
  title: string;
  remix: string;
  album: string;
  genre: string;
  bpm: string;
  key: string;
  filename: string;
  coverArt: string | null;
};

export type TrackStatus = 'reading' | 'pending' | 'ready' | 'failed';

/**
 * One crate row. `file`, `waveformPeaks`, and `coverUrl` are live browser objects.
 * They are not written to localStorage. `buffer` is the bytes already read from `file`.
 */
export type CrateTrack = {
  id: string;
  file: File;
  originalMetadata: TrackMetadata;
  currentMetadata: TrackMetadata;
  coverUrl: string | null;
  /** True after the cover is cleared in this tab. Stops a later file read from putting the embedded image back. */
  coverRemoved: boolean;
  waveformPeaks: number[] | null;
  status: TrackStatus;
  sourceName: string;
  cleaned: TrackMetadata;
  bands: WaveBand[] | null;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
  skeleton: boolean;
  scanning: boolean;
  analysing: boolean;
  failed: boolean;
  enterDelay: number;
  buffer: ArrayBuffer | null;
};

export type CrateLibraryRow = LibraryTrack & { filename: string };

const TAG_KEYS = ['artist', 'title', 'remix', 'album', 'genre', 'bpm', 'key'] as const;

export function fieldsFromMetadata(meta: TrackMetadata): TrackFields {
  return {
    artist: meta.artist,
    title: meta.title,
    remix: meta.remix,
    album: meta.album,
    genre: meta.genre,
    bpm: meta.bpm,
    key: meta.key,
  };
}

export function metadataFromFields(fields: TrackFields, filename: string, coverArt: string | null): TrackMetadata {
  return {
    artist: fields.artist,
    title: fields.title,
    remix: fields.remix,
    album: fields.album,
    genre: fields.genre,
    bpm: fields.bpm,
    key: fields.key,
    filename,
    coverArt,
  };
}

export function sameFields(left: TrackFields, right: TrackFields): boolean {
  return TAG_KEYS.every((key) => left[key] === right[key]);
}

export function sameMetadata(left: TrackMetadata, right: TrackMetadata): boolean {
  return (
    sameFields(left, right) && left.filename === right.filename && left.coverArt === right.coverArt
  );
}

export function statusFor(row: {
  failed: boolean;
  skeleton: boolean;
  scanning: boolean;
  analysing: boolean;
}): TrackStatus {
  if (row.failed) return 'failed';
  if (row.skeleton || row.scanning) return 'reading';
  if (row.analysing) return 'pending';
  return 'ready';
}

export function toLibraryRow(track: CrateTrack): CrateLibraryRow {
  return {
    id: track.id,
    sourceName: track.sourceName,
    fields: fieldsFromMetadata(track.currentMetadata),
    cleaned: fieldsFromMetadata(track.cleaned),
    original: fieldsFromMetadata(track.originalMetadata),
    buffer: track.buffer,
    bands: track.bands,
    analysing: track.analysing,
    coverUrl: track.coverUrl,
    skeleton: track.skeleton,
    scanning: track.scanning,
    failed: track.failed,
    enterDelay: track.enterDelay,
    remixFrame: track.remixFrame,
    fallback: track.fallback,
    filename: track.currentMetadata.filename,
  };
}

export function fileForTrack(existing: CrateTrack | undefined, sourceName: string, buffer: ArrayBuffer | null): File {
  if (existing && existing.buffer === buffer && existing.sourceName === sourceName) return existing.file;
  if (buffer) return new File([buffer], sourceName, { type: 'audio/mpeg' });
  if (existing && existing.sourceName === sourceName) return existing.file;
  return new File([], sourceName, { type: 'audio/mpeg' });
}
