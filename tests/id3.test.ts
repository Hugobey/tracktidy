import { readFileSync } from 'node:fs';
import { ID3Writer } from 'browser-id3-writer';
import { parseBuffer } from 'music-metadata';
import { describe, expect, it } from 'vitest';
import { noticeWithArtwork, writeTrack } from '../src/lib/id3.ts';
import type { TrackFields } from '../src/lib/types.ts';

const jpeg = new Uint8Array(readFileSync(new URL('./fixtures/pixel.jpg', import.meta.url)));
const jpegB = new Uint8Array(readFileSync(new URL('./fixtures/pixel-b.jpg', import.meta.url)));

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

  it('embeds a front-cover APIC and leaves the audio bytes unchanged', async () => {
    const original = taggedAudio();
    const audio = new Uint8Array(original).slice(-256);
    const result = writeTrack(original, {
      fields: fields({ title: 'New Title' }),
      original: fields(),
      remixFrame: 'TIT3',
      fallback: null,
      artwork: { data: jpeg, mime: 'image/jpeg' },
    });
    expect(result.bytes.slice(-256)).toEqual(audio);
    const metadata = await parseBuffer(result.bytes, 'audio/mpeg');
    expect(metadata.common.title).toBe('New Title');
    expect(metadata.common.artist).toBe('Ada');
    expect(metadata.common.picture).toHaveLength(1);
    expect(metadata.common.picture?.[0].type).toBe('Cover (front)');
    expect(metadata.common.picture?.[0].format).toBe('image/jpeg');
    expect(metadata.common.picture?.[0].data).toEqual(jpeg);
    const native = metadata.native['ID3v2.3'] ?? [];
    expect(native.some((frame) => frame.id === 'PRIV')).toBe(true);
    expect(native.some((frame) => frame.id.startsWith('TXXX'))).toBe(true);
  });

  it('replaces an existing cover without a text edit', async () => {
    const audio = new Uint8Array(256);
    audio[0] = 0xff;
    audio[1] = 0xfb;
    const writer = new ID3Writer(audio.buffer);
    writer.setFrame('TIT2', 'Old Title');
    writer.setFrame('TPE1', ['Ada']);
    writer.setFrame('APIC', {
      type: 3,
      description: 'old',
      data: jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength),
    });
    const original = writer.addTag();
    const result = writeTrack(original, {
      fields: fields(),
      original: fields(),
      remixFrame: 'TIT3',
      fallback: null,
      artwork: { data: jpegB, mime: 'image/jpeg' },
    });
    const metadata = await parseBuffer(result.bytes, 'audio/mpeg');
    expect(metadata.common.title).toBe('Old Title');
    expect(metadata.common.picture).toHaveLength(1);
    expect(metadata.common.picture?.[0].data).toEqual(jpegB);
    expect(result.bytes.slice(-256)).toEqual(audio);
  });

  it('removes the cover and leaves the audio bytes unchanged', async () => {
    const audio = new Uint8Array(256);
    audio[0] = 0xff;
    audio[1] = 0xfb;
    const writer = new ID3Writer(audio.buffer);
    writer.setFrame('TIT2', 'Old Title');
    writer.setFrame('TPE1', ['Ada']);
    writer.setFrame('APIC', {
      type: 3,
      description: 'old',
      data: jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength),
    });
    const original = writer.addTag();
    const result = writeTrack(original, {
      fields: fields(),
      original: fields(),
      remixFrame: 'TIT3',
      fallback: null,
      artwork: 'remove',
    });
    const metadata = await parseBuffer(result.bytes, 'audio/mpeg');
    expect(metadata.common.title).toBe('Old Title');
    expect(metadata.common.picture ?? []).toHaveLength(0);
    expect(result.bytes.slice(-256)).toEqual(audio);
    expect(noticeWithArtwork('Artwork stays.', false, true)).toMatch(/removes the artwork/);
  });

  it('refuses an image that is not JPEG or PNG', () => {
    expect(() =>
      writeTrack(taggedAudio(), {
        fields: fields(),
        original: fields(),
        remixFrame: 'TIT3',
        fallback: null,
        artwork: { data: jpeg, mime: 'image/gif' },
      }),
    ).toThrow(/JPEG or PNG/);
  });

  it('mentions embedded artwork only after the user changes it', () => {
    const notice = 'Export updates only the fields you change. Artwork, cue data, and the other frames stay in the file. The audio is not re-encoded.';
    expect(noticeWithArtwork(notice, false)).toBe(notice);
    expect(noticeWithArtwork(notice, true)).toMatch(/embeds the artwork shown here/);
    expect(noticeWithArtwork(notice, true)).not.toMatch(/Artwork, cue data/);
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
