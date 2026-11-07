import { describe, expect, it } from 'vitest';
import { renderFilename } from '../src/lib/filename.ts';
import type { TrackFields } from '../src/lib/types.ts';

const fields = (patch: Partial<TrackFields> = {}): TrackFields => ({
  artist: 'Nora Voss',
  title: 'Night Circuit',
  remix: 'Original Mix',
  album: 'After Hours',
  genre: 'Deep House',
  bpm: '124',
  key: 'F#m',
  ...patch,
});

describe('renderFilename', () => {
  it('fills the default DJ template', () => {
    const preview = renderFilename('{artist} - {title} ({bpm} BPM) [{key}]', fields());
    expect(preview.file).toBe('Nora Voss - Night Circuit (124 BPM) [F#m].mp3');
    expect(preview.missing).toEqual([]);
  });

  it('drops empty bpm and key groups', () => {
    const preview = renderFilename('{artist} - {title} ({bpm} BPM) [{key}]', fields({ bpm: '', key: '' }));
    expect(preview.name).toBe('Nora Voss - Night Circuit');
    expect(preview.missing).toEqual(['bpm', 'key']);
  });

  it('drops a missing artist and the separator in front of the title', () => {
    const preview = renderFilename('{artist} - {title}', fields({ artist: '' }));
    expect(preview.name).toBe('Night Circuit');
  });

  it('rounds bpm and rejects a bpm that is not a number', () => {
    expect(renderFilename('{bpm}', fields({ bpm: '127.6' })).name).toBe('128');
    const invalid = renderFilename('{title} ({bpm} BPM)', fields({ bpm: 'fast' }));
    expect(invalid.name).toBe('Night Circuit');
    expect(invalid.invalidBpm).toBe(true);
  });

  it('removes characters that are unsafe in file names', () => {
    const preview = renderFilename('{artist} - {title}', fields({ title: 'Night/Circuit: Live?' }));
    expect(preview.file).toBe('Nora Voss - Night Circuit Live.mp3');
  });

  it('treats version as the remix token', () => {
    const preview = renderFilename('{title} ({version})', fields());
    expect(preview.name).toBe('Night Circuit (Original Mix)');
  });
});
