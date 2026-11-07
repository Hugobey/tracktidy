export type TrackFields = {
  artist: string;
  title: string;
  remix: string;
  album: string;
  genre: string;
  bpm: string;
  key: string;
};

export type FieldKey = keyof TrackFields;

export const FIELD_KEYS: FieldKey[] = [
  'artist',
  'title',
  'remix',
  'album',
  'genre',
  'bpm',
  'key',
];

export const EMPTY_FIELDS: TrackFields = {
  artist: '',
  title: '',
  remix: '',
  album: '',
  genre: '',
  bpm: '',
  key: '',
};

export type TechnicalInfo = {
  duration: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
};

export type FallbackPicture = {
  data: Uint8Array;
  type: number;
  description: string;
};

export type FallbackPayload = {
  year: number | null;
  track: string;
  albumArtist: string;
  comment: string;
  composer: string;
  pictures: FallbackPicture[];
};

export type TagPlan = {
  /** True when the existing ID3v2.3 or ID3v2.4 tag can be patched in place. */
  canPatch: boolean;
  hasV1: boolean;
  notice: string | null;
};
