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

export async function detectBpm(buffer: AudioBuffer): Promise<BpmDetection> {
  const { offset, seconds, full } = analysisWindow(buffer.duration);
  const result = await withTimeout(
    guess(buffer, offset, seconds, { minTempo: 90, maxTempo: 180 }),
    ANALYSIS_STEP_MS,
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

export async function detectKey(buffer: AudioBuffer): Promise<KeyDetection> {
  const { offset, seconds, full } = analysisWindow(buffer.duration);
  const samples = mixRange(buffer, offset, seconds);
  const estimate: KeyEstimate | null = await withTimeout(
    estimateKeyFromSamples(samples, buffer.sampleRate),
    ANALYSIS_STEP_MS,
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
