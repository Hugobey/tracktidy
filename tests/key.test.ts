import { describe, expect, it } from 'vitest';
import { estimateKeyFromSamples, parseKey } from '../src/lib/key.ts';

function tone(frequency: number, sampleRate: number, seconds: number, amplitude: number): Float32Array {
  const length = Math.floor(sampleRate * seconds);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

function mix(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts[0].length);
  for (const part of parts) {
    for (let i = 0; i < out.length; i += 1) out[i] += part[i];
  }
  return out;
}

describe('parseKey', () => {
  it('normalises musical and Camelot notation', () => {
    expect(parseKey('F#m')).toEqual({ musical: 'F#m', camelot: '11A', minor: true });
    expect(parseKey('11A')).toEqual({ musical: 'F#m', camelot: '11A', minor: true });
    expect(parseKey('A minor')).toEqual({ musical: 'Am', camelot: '8A', minor: true });
    expect(parseKey('Bb maj')).toEqual({ musical: 'Bb', camelot: '6B', minor: false });
    expect(parseKey('D♭')).toEqual({ musical: 'C#', camelot: '3B', minor: false });
    expect(parseKey('not a key')).toBeNull();
  });

  it('round-trips every pitch class', () => {
    const codes = ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A', '1B', '8B', '12B'];
    for (const code of codes) {
      const parsed = parseKey(code);
      expect(parsed?.camelot).toBe(code);
      expect(parseKey(parsed?.musical ?? '')?.camelot).toBe(code);
    }
  });
});

describe('estimateKeyFromSamples', () => {
  it('hears an A minor triad as A minor or its relative major', async () => {
    const rate = 22050;
    const samples = mix([
      tone(220, rate, 3, 0.5),
      tone(261.63, rate, 3, 0.28),
      tone(329.63, rate, 3, 0.28),
      tone(440, rate, 3, 0.2),
    ]);
    const estimate = await estimateKeyFromSamples(samples, rate);
    expect(estimate).not.toBeNull();
    expect(['Am', 'C']).toContain(estimate?.musical);
  });

  it('returns nothing for silence', async () => {
    const estimate = await estimateKeyFromSamples(new Float32Array(22050), 22050);
    expect(estimate).toBeNull();
  });
});
