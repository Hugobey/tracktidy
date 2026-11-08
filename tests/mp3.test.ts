import { describe, expect, it } from 'vitest';
import { isMp3, readErrorMessage, rejectionMessage } from '../src/lib/mp3.ts';

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
    expect(rejectionMessage('loop.wav', bytes(0x52, 0x49, 0x46, 0x46))).toMatch(/WAV, not an MP3/);
    expect(rejectionMessage('song.flac', bytes(0x66, 0x4c, 0x61, 0x43))).toMatch(/FLAC, not an MP3/);
    expect(rejectionMessage('voice.aiff', bytes(0x46, 0x4f, 0x52, 0x4d))).toMatch(/AIFF, not an MP3/);
    expect(rejectionMessage('song.m4a', bytes(0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70))).toMatch(/M4A, not an MP3/);
    expect(rejectionMessage('song.ogg', bytes(0x4f, 0x67, 0x67, 0x53))).toMatch(/OGG, not an MP3/);
    expect(rejectionMessage('notes.txt', bytes(1, 2, 3, 4))).toMatch(/not an MP3/);
    expect(rejectionMessage('empty.mp3', new Uint8Array())).toMatch(/empty/);
    expect(rejectionMessage('broken.mp3', bytes(1, 2, 3, 4))).toMatch(/named like an MP3/);
  });
});

describe('read errors', () => {
  it('names a timeout, a lost file, and a failed connection', () => {
    expect(readErrorMessage(new Error('Opening this file took too long and was stopped.'))).toMatch(/was stopped/);
    expect(readErrorMessage(new DOMException('gone', 'NotFoundError'))).toMatch(/could not be found/);
    expect(readErrorMessage(new DOMException('blocked', 'NotReadableError'))).toMatch(/connection to it failed/);
    expect(readErrorMessage(new DOMException('nope', 'SecurityError'))).toMatch(/blocked access/);
    expect(readErrorMessage(new Error('nope'))).toMatch(/could not be read from this computer/);
  });
});
