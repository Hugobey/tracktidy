export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${remain.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBitrate(bitsPerSecond: number | null): string {
  if (!bitsPerSecond || !Number.isFinite(bitsPerSecond)) return '';
  return `${Math.round(bitsPerSecond / 1000)} kbps`;
}

export function formatSampleRate(sampleRate: number | null): string {
  if (!sampleRate || !Number.isFinite(sampleRate)) return '';
  const khz = sampleRate / 1000;
  const text = Number.isInteger(khz) ? khz.toFixed(0) : khz.toFixed(1);
  return `${text} kHz`;
}

export function formatChannels(channels: number | null): string {
  if (!channels) return '';
  if (channels === 1) return 'Mono';
  if (channels === 2) return 'Stereo';
  return `${channels} ch`;
}

export function formatBpm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
