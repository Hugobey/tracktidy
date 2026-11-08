import { ID3Writer } from 'browser-id3-writer';
import { bpmToken } from './filename.ts';
import type { FallbackPayload, TagPlan, TrackFields } from './types.ts';

type RawFrame = { id: string; bytes: Uint8Array };

type ParsedTag = {
  version: 3 | 4;
  frames: RawFrame[];
  audioOffset: number;
};

const TEXT_FRAMES: Record<Exclude<keyof TrackFields, 'remix'>, string> = {
  artist: 'TPE1',
  title: 'TIT2',
  album: 'TALB',
  genre: 'TCON',
  bpm: 'TBPM',
  key: 'TKEY',
};

function readSynchsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readU32(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 16777216 + bytes[offset + 1] * 65536 + bytes[offset + 2] * 256 + bytes[offset + 3];
}

function writeU32(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function writeSynchsafe(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function stripId3v1(audio: Uint8Array): Uint8Array {
  if (audio.length < 128) return audio;
  const start = audio.length - 128;
  if (audio[start] === 0x54 && audio[start + 1] === 0x41 && audio[start + 2] === 0x47) {
    return audio.slice(0, start);
  }
  return audio;
}

export function hasId3v1(bytes: Uint8Array): boolean {
  if (bytes.length < 128) return false;
  const start = bytes.length - 128;
  return bytes[start] === 0x54 && bytes[start + 1] === 0x41 && bytes[start + 2] === 0x47;
}

function parseTag(bytes: Uint8Array): ParsedTag | 'fallback' | null {
  if (bytes.length < 10) return null;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const version = bytes[3];
  if (version < 2 || version > 4) return 'fallback';
  if (version === 2) return 'fallback';
  const flags = bytes[5];
  const unsync = (flags & 0x80) !== 0;
  const extended = (flags & 0x40) !== 0;
  const footer = version === 4 && (flags & 0x10) !== 0;
  if (unsync || footer) return 'fallback';

  const tagSize = readSynchsafe(bytes, 6);
  const tagEnd = 10 + tagSize;
  if (tagEnd > bytes.length) return 'fallback';

  let offset = 10;
  if (extended) {
    if (version === 4) {
      const size = readSynchsafe(bytes, offset);
      if (size < 6 || offset + size > tagEnd) return 'fallback';
      offset += size;
    } else {
      const sizeExcluding = readU32(bytes, offset);
      if (offset + 4 + sizeExcluding > tagEnd) return 'fallback';
      offset += 4 + sizeExcluding;
    }
  }

  const frames: RawFrame[] = [];
  while (offset + 10 <= tagEnd) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4 ? readSynchsafe(bytes, offset + 4) : readU32(bytes, offset + 4);
    if (offset + 10 + size > tagEnd) return 'fallback';
    frames.push({ id, bytes: bytes.slice(offset, offset + 10 + size) });
    offset += 10 + size;
  }

  if (frames.length === 0 && tagSize > 32) return 'fallback';
  return { version: version as 3 | 4, frames, audioOffset: tagEnd };
}

export function inspectTag(buffer: ArrayBuffer): TagPlan {
  const bytes = new Uint8Array(buffer);
  const v1 = hasId3v1(bytes);
  const parsed = parseTag(bytes);
  if (parsed === 'fallback') {
    return {
      canPatch: false,
      hasV1: v1,
      notice:
        'This MP3 uses an ID3 tag that can’t be updated in place. If you edit a field, TrackTidy writes a new ID3v2.3 tag. Common text and artwork are kept when they can be read. Cue points and uncommon frames may be dropped.',
    };
  }
  if (parsed && v1) {
    return {
      canPatch: true,
      hasV1: true,
      notice:
        'Export updates only the fields you change. Other frames, including artwork and cue data, stay in place. An old ID3v1 trailer is removed when a field changes, so it can’t contradict the edit.',
    };
  }
  if (parsed) {
    return {
      canPatch: true,
      hasV1: false,
      notice:
        'Export updates only the fields you change. Artwork, cue data, and the other frames stay in the file. The audio is not re-encoded.',
    };
  }
  return {
    canPatch: true,
    hasV1: v1,
    notice: v1
      ? 'This file has an ID3v1 tag only. An edit writes a new ID3v2.3 tag and removes the old trailer.'
      : 'This file has no ID3 tag. An edit adds an ID3v2.3 tag. The audio is not re-encoded.',
  };
}

/** Adjusts the static export note once the user has chosen different artwork. */
export function noticeWithArtwork(notice: string | null, artworkChanged: boolean, removed = false): string | null {
  if (removed) {
    if (notice?.includes('may be dropped')) {
      return 'The download removes the artwork and writes a new ID3v2.3 tag. Cue points and uncommon frames may be dropped. The audio is not re-encoded.';
    }
    return 'The download removes the artwork. Other frames stay in the file. The audio is not re-encoded.';
  }
  if (!artworkChanged) return notice;
  const embedded = 'The artwork shown here is embedded in the download. The audio is not re-encoded.';
  if (!notice) return embedded;
  if (notice.includes('may be dropped')) {
    return 'The artwork shown here is written into a new ID3v2.3 tag. Cue points and uncommon frames may be dropped. The audio is not re-encoded.';
  }
  if (notice.includes('Artwork, cue data')) {
    return 'Export updates the fields you change and embeds the artwork shown here. Cue data and the other frames stay in the file. The audio is not re-encoded.';
  }
  if (notice.includes('including artwork')) {
    return 'Export updates the fields you change and embeds the artwork shown here. Cue data stays in place. An old ID3v1 trailer is removed when a field changes, so it can’t contradict the edit.';
  }
  return `${notice} ${embedded}`;
}

function encodeText(value: string, version: 3 | 4): Uint8Array {
  const clean = value.split('\0').join('').trim();
  if (version === 4) {
    const encoded = new TextEncoder().encode(clean);
    const data = new Uint8Array(1 + encoded.length);
    data[0] = 3;
    data.set(encoded, 1);
    return data;
  }
  const data = new Uint8Array(1 + 2 + clean.length * 2);
  data[0] = 1;
  data[1] = 0xff;
  data[2] = 0xfe;
  for (let i = 0; i < clean.length; i += 1) {
    const code = clean.charCodeAt(i);
    data[3 + i * 2] = code & 0xff;
    data[4 + i * 2] = code >> 8;
  }
  return data;
}

function buildTextFrame(id: string, value: string, version: 3 | 4): Uint8Array {
  const data = encodeText(value, version);
  const frame = new Uint8Array(10 + data.length);
  for (let i = 0; i < 4; i += 1) frame[i] = id.charCodeAt(i);
  const size = version === 4 ? writeSynchsafe(data.length) : writeU32(data.length);
  frame.set(size, 4);
  frame.set(data, 10);
  return frame;
}

function normalizedField(key: keyof TrackFields, value: string): string {
  if (key === 'bpm') return bpmToken(value);
  return value.trim();
}

function changedFields(fields: TrackFields, original: TrackFields): (keyof TrackFields)[] {
  return (Object.keys(fields) as (keyof TrackFields)[]).filter(
    (key) => normalizedField(key, fields[key]) !== normalizedField(key, original[key]),
  );
}

function rebuild(bytes: Uint8Array, parsed: ParsedTag, updates: Map<string, Uint8Array | null>): Uint8Array {
  const next: Uint8Array[] = [];
  const seen = new Set<string>();
  for (const frame of parsed.frames) {
    if (!updates.has(frame.id)) {
      next.push(frame.bytes);
      continue;
    }
    if (seen.has(frame.id)) continue;
    seen.add(frame.id);
    const replacement = updates.get(frame.id);
    if (replacement) next.push(replacement);
  }
  for (const [id, replacement] of updates) {
    if (!seen.has(id) && replacement) next.push(replacement);
  }

  const padding = new Uint8Array(512);
  const body = concat([...next, padding]);
  const header = new Uint8Array(10);
  header[0] = 0x49;
  header[1] = 0x44;
  header[2] = 0x33;
  header[3] = parsed.version;
  header.set(writeSynchsafe(body.length), 6);
  const audio = stripId3v1(bytes.slice(parsed.audioOffset));
  return concat([header, body, audio]);
}

function pictureType(label: string | undefined, index: number): number {
  const types = [
    'Other',
    "32x32 pixels 'file icon' (PNG only)",
    'Other file icon',
    'Cover (front)',
    'Cover (back)',
    'Leaflet page',
    'Media (e.g. label side of CD)',
    'Lead artist/lead performer/soloist',
    'Artist/performer',
    'Conductor',
    'Band/Orchestra',
    'Composer',
    'Lyricist/text writer',
    'Recording Location',
    'During recording',
    'During performance',
    'Movie/video screen capture',
    'A bright coloured fish',
    'Illustration',
    'Band/artist logotype',
    'Publisher/Studio logotype',
  ];
  const found = label ? types.indexOf(label) : -1;
  if (found >= 0) return found;
  return index === 0 ? 3 : 0;
}

export function pictureTypeFromLabel(label: string | undefined, index: number): number {
  return pictureType(label, index);
}

function writerBuffer(buffer: ArrayBuffer): ArrayBuffer {
  const stripped = stripId3v1(new Uint8Array(buffer));
  return stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength) as ArrayBuffer;
}

export type ArtworkWrite = { data: Uint8Array; mime: string };

function artworkMime(mime: string): 'image/jpeg' | 'image/png' {
  const named = mime.toLowerCase();
  if (named === 'image/jpg' || named === 'image/jpeg') return 'image/jpeg';
  if (named === 'image/png') return 'image/png';
  throw new Error('Artwork must be a JPEG or PNG image.');
}

function buildApicFrame(mime: string, image: Uint8Array, version: 3 | 4): Uint8Array {
  const mimeBytes = new TextEncoder().encode(mime);
  const payload = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + image.length);
  let offset = 0;
  payload[offset] = 0;
  offset += 1;
  payload.set(mimeBytes, offset);
  offset += mimeBytes.length;
  payload[offset] = 0;
  offset += 1;
  payload[offset] = 3;
  offset += 1;
  payload[offset] = 0;
  offset += 1;
  payload.set(image, offset);
  const frame = new Uint8Array(10 + payload.length);
  frame[0] = 0x41;
  frame[1] = 0x50;
  frame[2] = 0x49;
  frame[3] = 0x43;
  frame.set(version === 4 ? writeSynchsafe(payload.length) : writeU32(payload.length), 4);
  frame.set(payload, 10);
  return frame;
}

function writeFresh(
  audio: ArrayBuffer,
  fields: TrackFields,
  fallback: FallbackPayload | null,
  artwork: 'keep' | 'remove' | ArtworkWrite,
): Uint8Array {
  const writer = new ID3Writer(writerBuffer(audio));
  if (fields.title.trim()) writer.setFrame('TIT2', fields.title.trim());
  if (fields.artist.trim()) writer.setFrame('TPE1', [fields.artist.trim()]);
  if (fields.album.trim()) writer.setFrame('TALB', fields.album.trim());
  if (fields.remix.trim()) writer.setFrame('TIT3', fields.remix.trim());
  if (fields.genre.trim()) writer.setFrame('TCON', [fields.genre.trim()]);
  const bpm = bpmToken(fields.bpm);
  if (bpm) writer.setFrame('TBPM', Number(bpm));
  if (fields.key.trim()) writer.setFrame('TKEY', fields.key.trim());
  if (fallback?.albumArtist) writer.setFrame('TPE2', fallback.albumArtist);
  if (fallback?.year) writer.setFrame('TYER', fallback.year);
  if (fallback?.track) writer.setFrame('TRCK', fallback.track);
  if (fallback?.composer) writer.setFrame('TCOM', [fallback.composer]);
  if (fallback?.comment) {
    writer.setFrame('COMM', { description: '', text: fallback.comment, language: 'eng' });
  }
  const pictures =
    artwork === 'keep'
      ? (fallback?.pictures ?? [])
      : artwork === 'remove'
        ? []
        : [{ data: artwork.data, type: 3, description: '' }];
  for (const picture of pictures) {
    const data = picture.data.buffer.slice(
      picture.data.byteOffset,
      picture.data.byteOffset + picture.data.byteLength,
    ) as ArrayBuffer;
    writer.setFrame('APIC', {
      type: picture.type,
      data,
      description: picture.description,
    });
  }
  return new Uint8Array(writer.addTag());
}

export type WriteResult = {
  bytes: Uint8Array;
  notice: string | null;
};

export function writeTrack(
  buffer: ArrayBuffer,
  edit: {
    fields: TrackFields;
    original: TrackFields;
    remixFrame: 'TIT3' | 'TPE4';
    fallback: FallbackPayload | null;
    /** `keep` leaves every APIC frame untouched. A picture replaces the cover. `remove` drops it. */
    artwork?: 'keep' | 'remove' | ArtworkWrite;
  },
): WriteResult {
  const artwork = edit.artwork ?? 'keep';
  const changed = changedFields(edit.fields, edit.original);
  if (changed.length === 0 && artwork === 'keep') {
    return { bytes: new Uint8Array(buffer), notice: null };
  }

  const invalidBpm = edit.fields.bpm.trim() !== '' && bpmToken(edit.fields.bpm) === '';
  const bytes = new Uint8Array(buffer);
  const parsed = parseTag(bytes);

  if (parsed === 'fallback' || !parsed) {
    return {
      bytes: writeFresh(buffer, edit.fields, edit.fallback, artwork),
      notice: invalidBpm ? 'BPM was not written because it is not a positive number.' : null,
    };
  }

  const updates = new Map<string, Uint8Array | null>();
  for (const key of changed) {
    if (key === 'bpm' && invalidBpm) continue;
    const frameId = key === 'remix' ? edit.remixFrame : TEXT_FRAMES[key];
    const value = normalizedField(key, edit.fields[key]);
    updates.set(frameId, value ? buildTextFrame(frameId, value, parsed.version) : null);
  }
  if (artwork === 'remove') {
    updates.set('APIC', null);
  } else if (artwork !== 'keep') {
    const mime = artworkMime(artwork.mime);
    if (artwork.data.byteLength === 0) throw new Error('Artwork is empty.');
    if (artwork.data.byteLength > 1_500_000) throw new Error('This image is too large to embed.');
    updates.set('APIC', buildApicFrame(mime, artwork.data, parsed.version));
  }

  if (updates.size === 0) {
    return {
      bytes: new Uint8Array(buffer),
      notice: 'BPM was not written because it is not a positive number.',
    };
  }

  return {
    bytes: rebuild(bytes, parsed, updates),
    notice: invalidBpm ? 'BPM was not written because it is not a positive number. The other edits were saved.' : null,
  };
}

