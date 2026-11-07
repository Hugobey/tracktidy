import { ID3Writer } from 'browser-id3-writer';
import { parseBuffer } from 'music-metadata';
import { describe, expect, it } from 'vitest';
import { writeTrack } from '../src/lib/id3.ts';
import type { TrackFields } from '../src/lib/types.ts';

const fields = (patch: Partial<TrackFields> = {}): TrackFields => ({
  artist: 'Ada',
  title: 'Old Title',
  remix: '',
  album: 'Night',
  genre: 'House',
  bpm: '120',
  key: 'Am',
  ...patch,
});

function taggedAudio(): ArrayBuffer {
  const audio = new Uint8Array(256);
  audio[0] = 0xff;
  audio[1] = 0xfb;
  const writer = new ID3Writer(audio.buffer);
  writer.setFrame('TIT2', 'Old Title');
  writer.setFrame('TPE1', ['Ada']);
  writer.setFrame('TALB', 'Night');
  writer.setFrame('TCON', ['House']);
  writer.setFrame('TBPM', 120);
  writer.setFrame('TKEY', 'Am');
  writer.setFrame('TXXX', { description: 'CUE', value: 'keep-me' });
  writer.setFrame('PRIV', { id: 'tracktidy.test', data: new Uint8Array([9, 8, 7]).buffer });
  return writer.addTag();
}

describe('writeTrack', () => {
  it('returns the original bytes when nothing changed', () => {
    const original = taggedAudio();
    const result = writeTrack(original, {
      fields: fields(),
      original: fields(),
      remixFrame: 'TIT3',
      fallback: null,
    });
    expect(Buffer.from(result.bytes).equals(Buffer.from(original))).toBe(true);
  });

  it('updates the title and keeps the private and custom frames', async () => {
    const original = taggedAudio();
    const result = writeTrack(original, {
      fields: fields({ title: 'New Title' }),
      original: fields(),
      remixFrame: 'TIT3',
      fallback: null,
    });
    const metadata = await parseBuffer(result.bytes, 'audio/mpeg');
    expect(metadata.common.title).toBe('New Title');
    expect(metadata.common.artist).toBe('Ada');
    expect(metadata.common.album).toBe('Night');
    expect(metadata.common.bpm).toBe(120);
    expect(metadata.common.key).toBe('Am');
    const native = metadata.native['ID3v2.3'] ?? [];
    const custom = native.find((frame) => frame.id.startsWith('TXXX'));
    expect(custom?.value).toBe('keep-me');
    expect(native.some((frame) => frame.id === 'PRIV')).toBe(true);
  });

  it('removes an ID3v1 trailer when a field changes', async () => {
    const original = new Uint8Array(taggedAudio());
    const withV1 = new Uint8Array(original.length + 128);
    withV1.set(original);
    withV1.set([0x54, 0x41, 0x47], original.length);
    const result = writeTrack(withV1.buffer, {
      fields: fields({ genre: 'Techno' }),
      original: fields(),
      remixFrame: 'TIT3',
      fallback: null,
    });
    expect(String.fromCharCode(result.bytes.at(-128) ?? 0, result.bytes.at(-127) ?? 0, result.bytes.at(-126) ?? 0)).not.toBe(
      'TAG',
    );
    const metadata = await parseBuffer(result.bytes, 'audio/mpeg');
    expect(metadata.common.genre).toEqual(['Techno']);
    expect(metadata.common.title).toBe('Old Title');
  });

  it('can add a remix to a file that had none', async () => {
    const original = taggedAudio();
    const result = writeTrack(original, {
      fields: fields({ remix: 'Original Mix' }),
      original: fields(),
      remixFrame: 'TIT3',
      fallback: null,
    });
    const metadata = await parseBuffer(result.bytes, 'audio/mpeg');
    expect(metadata.common.subtitle).toContain('Original Mix');
  });
});
