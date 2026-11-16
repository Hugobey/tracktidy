import type { TrackFields } from './types.ts';

export const LIBRARY_PATH = '/pro';
export const LIBRARY_TITLE = 'TrackTidy Pro library';
export const LIBRARY_DESCRIPTION = 'Rename many MP3s at once in the browser. The audio stays on this computer.';

export type DemoTrack = {
  id: string;
  href: string;
  sourceName: string;
  fields: TrackFields;
};

/** Tiny local MP3s so the library list can be tried without a personal crate. */
export const DEMO_LIBRARY: readonly DemoTrack[] = [
  {
    id: 'demo-night',
    href: '/demo/night-circuit.mp3',
    sourceName: '01_nora_voss_night_circuit_MASTER.mp3',
    fields: {
      artist: 'nora voss',
      title: 'night circuit',
      remix: '',
      album: 'Night Circuit',
      genre: 'house',
      bpm: '124',
      key: '8A',
    },
  },
  {
    id: 'demo-harbour',
    href: '/demo/harbour-line.mp3',
    sourceName: 'kian blake - harbour line (free download).mp3',
    fields: {
      artist: 'kian blake',
      title: 'harbour line (free download)',
      remix: '',
      album: 'Harbour Line',
      genre: 'breaks',
      bpm: '132',
      key: '4A',
    },
  },
  {
    id: 'demo-glass',
    href: '/demo/glass-room.mp3',
    sourceName: 'LENA_OKADA_GLASS_ROOM.mp3',
    fields: {
      artist: 'lena okada',
      title: 'glass room',
      remix: '',
      album: 'Glass Room',
      genre: 'techno',
      bpm: '126',
      key: '10A',
    },
  },
  {
    id: 'demo-tide',
    href: '/demo/low-tide.mp3',
    sourceName: 'track_04_final.mp3',
    fields: {
      artist: 'mara ellison',
      title: 'low tide',
      remix: '',
      album: 'Low Tide',
      genre: 'deep house',
      bpm: '118',
      key: '6A',
    },
  },
];
