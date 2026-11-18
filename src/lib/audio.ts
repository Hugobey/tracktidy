import { guess } from 'web-audio-beat-detector';
import { estimateKeyFromSamples, type KeyEstimate } from './key.ts';

export type BpmDetection = {
  bpm: string;
  detail: string;
};

export type KeyDetection = {
  musical: string;
  camelot: string;
  low: boolean;
  detail: string;
};

/** One analysis step. Long enough for a large file, short enough to leave the screen. */
export const ANALYSIS_STEP_MS = 30_000;

export function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Decode for the crate. A suspended context returns quickly so the row does not wait out a full analysis. */
export async function decodeLibraryAudio(buffer: ArrayBuffer): Promise<{ audio: AudioBuffer | null; blocked: boolean }> {
  const copy = buffer.slice(0);
  const context = new AudioContext();
  try {
    if (context.state === 'suspended') {
      const unlocked = await Promise.race([
        context.resume().then(() => true, () => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
      ]);
      if (!unlocked || context.state === 'suspended') return { audio: null, blocked: true };
    }
    const audio = await withTimeout(context.decodeAudioData(copy), 8000, 'The waveform was not ready.');
    return { audio, blocked: false };
  } catch {
    return { audio: null, blocked: false };
  } finally {
    if (context.state !== 'closed') void context.close().catch(() => undefined);
  }
}

export async function decodeAudio(buffer: ArrayBuffer): Promise<AudioBuffer> {
  const copy = buffer.slice(0);
  const context = new AudioContext();
  try {
    // decodeAudioData can stay pending forever on some files, and on a suspended context.
    return await withTimeout(
      (async () => {
        if (context.state === 'suspended') await context.resume();
        return context.decodeAudioData(copy);
      })(),
      ANALYSIS_STEP_MS,
      'Decoding this MP3 took too long and was stopped. The browser did not return audio, so tempo and key were not measured. The tags can still be edited.',
    );
  } finally {
    if (context.state !== 'closed') void context.close().catch(() => undefined);
  }
}

/** Decode without a live audio device. Used for crate waveforms. Some files never settle, so this gives up. */
export async function readWaveAudio(bytes: ArrayBuffer): Promise<AudioBuffer | null> {
  const copy = bytes.slice(0);
  try {
    const context = new OfflineAudioContext(1, 44100, 44100);
    return await withTimeout(context.decodeAudioData(copy), 8000, 'The waveform was not ready.');
  } catch {
    return null;
  }
}

export type WaveBand = { low: number; mid: number; high: number };

function bitReverse(index: number, bits: number): number {
  let reversed = 0;
  let value = index;
  for (let bit = 0; bit < bits; bit += 1) {
    reversed = (reversed << 1) | (value & 1);
    value >>= 1;
  }
  return reversed;
}

function fftMagnitude(frame: Float32Array): Float32Array {
  const size = frame.length;
  const bits = Math.round(Math.log2(size));
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
    real[bitReverse(index, bits)] = frame[index] * window;
  }
  for (let span = 2; span <= size; span *= 2) {
    const half = span / 2;
    const step = (2 * Math.PI) / span;
    for (let start = 0; start < size; start += span) {
      for (let offset = 0; offset < half; offset += 1) {
        const angle = step * offset;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const even = start + offset;
        const odd = even + half;
        const rotatedReal = real[odd] * cos - imag[odd] * sin;
        const rotatedImag = real[odd] * sin + imag[odd] * cos;
        real[odd] = real[even] - rotatedReal;
        imag[odd] = imag[even] - rotatedImag;
        real[even] += rotatedReal;
        imag[even] += rotatedImag;
      }
    }
  }
  const magnitude = new Float32Array(size / 2);
  for (let index = 0; index < magnitude.length; index += 1) magnitude[index] = Math.hypot(real[index], imag[index]);
  return magnitude;
}

/** 48 columns of bass, mid, and high energy from a short FFT of each slice. */
export function frequencyBands(buffer: AudioBuffer, bars = 48): WaveBand[] {
  const rate = buffer.sampleRate;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const fftSize = 64;
  const raw: WaveBand[] = [];
  const slice = Math.max(fftSize, Math.floor(left.length / bars));
  for (let bar = 0; bar < bars; bar += 1) {
    const start = Math.min(Math.max(0, left.length - fftSize), bar * slice);
    const frame = new Float32Array(fftSize);
    for (let index = 0; index < fftSize; index += 1) {
      const sample = left[start + index] ?? 0;
      frame[index] = right ? (sample + (right[start + index] ?? 0)) / 2 : sample;
    }
    const magnitude = fftMagnitude(frame);
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let bin = 1; bin < magnitude.length; bin += 1) {
      const hz = (bin * rate) / fftSize;
      if (hz < 180) low += magnitude[bin];
      else if (hz < 2000) mid += magnitude[bin];
      else high += magnitude[bin];
    }
    raw.push({ low, mid, high });
  }
  const peak = Math.max(...raw.map((band) => band.low + band.mid + band.high), 0.0001);
  return raw.map((band) => ({ low: band.low / peak, mid: band.mid / peak, high: band.high / peak }));
}

export function waveformPeaks(buffer: AudioBuffer, buckets = 96): number[] {
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const size = Math.max(1, Math.floor(left.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const start = i * size;
    const end = i === buckets - 1 ? left.length : Math.min(left.length, start + size);
    let max = 0;
    for (let j = start; j < end; j += 16) {
      const sample = Math.abs(left[j]) + (right ? Math.abs(right[j]) : 0);
      if (sample > max) max = sample;
    }
    peaks.push(max);
  }
  const top = Math.max(...peaks, 0.0001);
  return peaks.map((peak) => peak / top);
}

function analysisWindow(duration: number): { offset: number; seconds: number; full: boolean } {
  if (duration <= 90) return { offset: 0, seconds: duration, full: true };
  const offset = Math.min(20, Math.max(0, duration * 0.15));
  const seconds = Math.min(60, Math.max(8, duration - offset));
  return { offset, seconds, full: false };
}

export async function detectBpm(buffer: AudioBuffer, ms = ANALYSIS_STEP_MS): Promise<BpmDetection> {
  const { offset, seconds, full } = analysisWindow(buffer.duration);
  const result = await withTimeout(
    guess(buffer, offset, seconds, { minTempo: 90, maxTempo: 180 }),
    ms,
    'Tempo detection took too long and was stopped.',
  );
  const where = full ? 'the full track' : 'a 60-second section';
  return {
    bpm: String(result.bpm),
    detail: `Detected from ${where}. The detector folds tempo into 90–180 BPM, so half or double time is possible.`,
  };
}

function mixRange(buffer: AudioBuffer, offset: number, seconds: number): Float32Array {
  const start = Math.max(0, Math.floor(offset * buffer.sampleRate));
  const length = Math.max(0, Math.min(buffer.length - start, Math.floor(seconds * buffer.sampleRate)));
  const mixed = new Float32Array(length);
  const channels = buffer.numberOfChannels;
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) mixed[i] += data[start + i];
  }
  if (channels > 1) {
    for (let i = 0; i < length; i += 1) mixed[i] /= channels;
  }
  return mixed;
}

export async function detectKey(buffer: AudioBuffer, ms = ANALYSIS_STEP_MS): Promise<KeyDetection> {
  const { offset, seconds, full } = analysisWindow(buffer.duration);
  const samples = mixRange(buffer, offset, seconds);
  const estimate: KeyEstimate | null = await withTimeout(
    estimateKeyFromSamples(samples, buffer.sampleRate),
    ms,
    'Key estimation took too long and was stopped.',
  );
  if (!estimate) {
    throw new Error('Not enough tonal information to estimate a key.');
  }
  const where = full ? 'the full track' : 'a 60-second section';
  const close = estimate.close ? ` Close to ${estimate.close}.` : '';
  const confidence = estimate.low ? ' Low confidence.' : '';
  return {
    musical: estimate.musical,
    camelot: estimate.camelot,
    low: estimate.low,
    detail: `Estimated from ${where} with a pitch-class profile.${confidence}${close} Confirm it by ear.`,
  };
}
