/**
 * Key estimate uses the Krumhansl–Schmuckler pitch-class profiles.
 * It is a suggestion. Relative major and minor are a known ambiguity.
 */

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const MAJOR_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm'];
const CAMELOT_MAJOR = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'];
const CAMELOT_MINOR = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'];

const ROOTS: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  DB: 1,
  D: 2,
  'D#': 3,
  EB: 3,
  E: 4,
  FB: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  GB: 6,
  G: 7,
  'G#': 8,
  AB: 8,
  A: 9,
  'A#': 10,
  BB: 10,
  B: 11,
  CB: 11,
};

export type ParsedKey = {
  musical: string;
  camelot: string;
  minor: boolean;
};

export type KeyEstimate = {
  musical: string;
  camelot: string;
  low: boolean;
  close: string | null;
  score: number;
};

const CAMELOT_PATTERN = /^([1-9]|1[0-2])([AB])$/;

export function parseKey(input: string): ParsedKey | null {
  const compact = input
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!compact) return null;

  const camelot = compact.match(CAMELOT_PATTERN);
  if (camelot) {
    const code = `${camelot[1]}${camelot[2]}`;
    const minor = camelot[2] === 'A';
    const list = minor ? CAMELOT_MINOR : CAMELOT_MAJOR;
    const pc = list.indexOf(code);
    if (pc < 0) return null;
    return {
      musical: minor ? MINOR_NAMES[pc] : MAJOR_NAMES[pc],
      camelot: code,
      minor,
    };
  }

  const match = compact.match(/^(C#|DB|D#|EB|F#|GB|G#|AB|A#|BB|B#|E#|FB|CB|[A-G])(MAJOR|MAJ|MINOR|MIN|M)?$/);
  if (!match) return null;
  const pc = ROOTS[match[1]];
  if (pc === undefined) return null;
  const suffix = match[2] ?? '';
  const minor = suffix === 'M' || suffix === 'MIN' || suffix === 'MINOR';
  return {
    musical: minor ? MINOR_NAMES[pc] : MAJOR_NAMES[pc],
    camelot: minor ? CAMELOT_MINOR[pc] : CAMELOT_MAJOR[pc],
    minor,
  };
}

export function sameKey(a: string, b: string): boolean {
  const left = parseKey(a);
  const right = parseKey(b);
  if (left && right) return left.camelot === right.camelot && left.minor === right.minor;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function rotate(profile: readonly number[], tonic: number): number[] {
  return Array.from({ length: 12 }, (_, pc) => profile[(pc - tonic + 12) % 12]);
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i += 1) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}

function fftInPlace(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(angle);
    const wlenIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j += 1) {
        const evenRe = real[i + j];
        const evenIm = imag[i + j];
        const oddRe = real[i + j + half];
        const oddIm = imag[i + j + half];
        const vRe = oddRe * wRe - oddIm * wIm;
        const vIm = oddRe * wIm + oddIm * wRe;
        real[i + j] = evenRe + vRe;
        imag[i + j] = evenIm + vIm;
        real[i + j + half] = evenRe - vRe;
        imag[i + j + half] = evenIm - vIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function estimateKeyFromSamples(
  samples: Float32Array,
  sampleRate: number,
): Promise<KeyEstimate | null> {
  const fftSize = 8192;
  if (samples.length < fftSize || sampleRate < 8000) return null;

  const window = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const chroma = new Float64Array(12);
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);
  const hop = fftSize;
  let frames = 0;

  for (let start = 0; start + fftSize <= samples.length; start += hop) {
    for (let i = 0; i < fftSize; i += 1) {
      real[i] = samples[start + i] * window[i];
      imag[i] = 0;
    }
    fftInPlace(real, imag);
    const binHz = sampleRate / fftSize;
    const nyquist = fftSize >> 1;
    for (let bin = 1; bin < nyquist; bin += 1) {
      const freq = bin * binHz;
      if (freq < 80 || freq > 5000) continue;
      const mag = Math.hypot(real[bin], imag[bin]);
      if (mag <= 0) continue;
      const midi = 69 + 12 * Math.log2(freq / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      const octave = Math.floor(midi / 12);
      const weight = octave >= 3 && octave <= 7 ? 1 : 0.35;
      chroma[pc] += Math.log1p(mag) * weight;
    }
    frames += 1;
    if (frames % 24 === 0) await yieldToUi();
  }

  let energy = 0;
  for (let i = 0; i < 12; i += 1) energy += chroma[i];
  if (energy < 1) return null;

  const vector = Array.from(chroma, (value) => value / energy);
  const scores: { name: string; camelot: string; score: number }[] = [];
  for (let tonic = 0; tonic < 12; tonic += 1) {
    scores.push({
      name: MAJOR_NAMES[tonic],
      camelot: CAMELOT_MAJOR[tonic],
      score: pearson(vector, rotate(MAJOR_PROFILE, tonic)),
    });
    scores.push({
      name: MINOR_NAMES[tonic],
      camelot: CAMELOT_MINOR[tonic],
      score: pearson(vector, rotate(MINOR_PROFILE, tonic)),
    });
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  if (!best || best.score < 0.35) return null;
  const margin = best.score - (second?.score ?? 0);
  return {
    musical: best.name,
    camelot: best.camelot,
    low: margin < 0.04,
    close: second && margin < 0.08 ? second.name : null,
    score: best.score,
  };
}
