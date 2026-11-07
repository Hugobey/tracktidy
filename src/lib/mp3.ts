const MAX_BYTES = 100 * 1024 * 1024;

export function maxFileBytes(): number {
  return MAX_BYTES;
}

function readSynchsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function frameSyncAt(bytes: Uint8Array, index: number): boolean {
  if (index + 1 >= bytes.length) return false;
  if (bytes[index] !== 0xff) return false;
  const next = bytes[index + 1];
  if ((next & 0xe0) !== 0xe0) return false;
  const version = (next >> 3) & 0x03;
  const layer = (next >> 1) & 0x03;
  return version !== 0x01 && layer !== 0x00;
}

function findFrameSync(bytes: Uint8Array, from: number, limit: number): boolean {
  const end = Math.min(bytes.length - 1, from + limit);
  for (let i = from; i < end; i += 1) {
    if (frameSyncAt(bytes, i)) return true;
  }
  return false;
}

export function isMp3(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const version = bytes[3];
    if (version < 2 || version > 4) return false;
    const size = readSynchsafe(bytes, 6);
    const audioAt = Math.min(bytes.length, 10 + size);
    return findFrameSync(bytes, audioAt, 8192) || findFrameSync(bytes, 0, 64);
  }
  return findFrameSync(bytes, 0, 4096);
}

export type FileKind = 'mp3' | 'wav' | 'aiff' | 'flac' | 'm4a' | 'ogg' | 'unknown';

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length && offset + i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

export function sniffKind(name: string, bytes: Uint8Array): FileKind {
  if (isMp3(bytes)) return 'mp3';
  if (ascii(bytes, 0, 4) === 'RIFF') return 'wav';
  if (ascii(bytes, 0, 4) === 'FORM') return 'aiff';
  if (ascii(bytes, 0, 4) === 'fLaC') return 'flac';
  if (ascii(bytes, 0, 4) === 'OggS') return 'ogg';
  if (ascii(bytes, 4, 4) === 'ftyp') return 'm4a';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'wav') return 'wav';
  if (ext === 'aiff' || ext === 'aif') return 'aiff';
  if (ext === 'flac') return 'flac';
  if (ext === 'm4a' || ext === 'mp4' || ext === 'aac') return 'm4a';
  if (ext === 'ogg' || ext === 'opus') return 'ogg';
  return 'unknown';
}

const KIND_LABEL: Record<Exclude<FileKind, 'mp3' | 'unknown'>, string> = {
  wav: 'WAV',
  aiff: 'AIFF',
  flac: 'FLAC',
  m4a: 'M4A',
  ogg: 'OGG',
};

export function rejectionMessage(name: string, bytes: Uint8Array): string | null {
  if (bytes.length === 0) return 'This file is empty.';
  if (bytes.length > MAX_BYTES) {
    const mb = Math.round(bytes.length / (1024 * 1024));
    return `This file is ${mb} MB. TrackTidy processes one MP3 up to 100 MB in the browser.`;
  }
  if (isMp3(bytes)) return null;
  const kind = sniffKind(name, bytes);
  if (kind !== 'mp3' && kind !== 'unknown') {
    return `${KIND_LABEL[kind]} isn’t supported in this version. TrackTidy reads and writes MP3 only, so this file was not imported.`;
  }
  if (name.toLowerCase().endsWith('.mp3')) {
    return 'This file is named like an MP3, but the audio data is not an MP3 stream. It was not imported.';
  }
  return 'This file is not an MP3. TrackTidy reads and writes MP3 only in this version.';
}
