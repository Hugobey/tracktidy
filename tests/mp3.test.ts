import { describe, expect, it } from 'vitest';
import { isMp3, rejectionMessage } from '../src/lib/mp3.ts';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('isMp3', () => {
  it('accepts a frame sync and an ID3 header followed by a frame', () => {
    expect(isMp3(bytes(0xff, 0xfb, 0x90, 0x00))).toBe(true);
    const tagged = new Uint8Array(64);
    tagged.set([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 32]);
    tagged[42] = 0xff;
    tagged[43] = 0xfb;
    expect(isMp3(tagged)).toBe(true);
  });

  it('rejects wav, flac, and empty files', () => {
    expect(isMp3(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0))).toBe(false);
    expect(rejectionMessage('loop.wav', bytes(0x52, 0x49, 0x46, 0x46))).toMatch(/WAV/);
    expect(rejectionMessage('song.flac', bytes(0x66, 0x4c, 0x61, 0x43))).toMatch(/FLAC/);
    expect(rejectionMessage('empty.mp3', new Uint8Array())).toMatch(/empty/);
  });
});
