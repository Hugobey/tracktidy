import { createContext, useContext } from 'react';
import type { Stage } from '../components/AnalysisScreen.tsx';
import type { ImageMime } from '../lib/artwork.ts';
import { bpmToken, type FilenamePreview } from '../lib/filename.ts';
import type { FallbackPayload, TagPlan, TechnicalInfo, TrackFields } from '../lib/types.ts';

const FIELD_LABELS: Record<keyof TrackFields, string> = {
  artist: 'Artist',
  title: 'Title',
  remix: 'Remix',
  album: 'Album',
  genre: 'Genre',
  bpm: 'BPM',
  key: 'Key',
};

type Analysis = {
  bpm: { value: string; detail: string } | null;
  bpmError: string | null;
  key: { value: string; camelot: string; low: boolean; detail: string } | null;
  keyError: string | null;
  bpmPending: boolean;
  keyPending: boolean;
};

export type TrackState = {
  name: string;
  size: number;
  buffer: ArrayBuffer;
  fileFields: TrackFields;
  fields: TrackFields;
  remixFrame: 'TIT3' | 'TPE4';
  technical: TechnicalInfo;
  kept: string[];
  coverUrl: string | null;
  coverBytes: Uint8Array | null;
  coverMime: ImageMime | null;
  embeddedCover: Uint8Array | null;
  hadCover: boolean;
  coverFrom: 'file' | 'search' | 'upload' | null;
  coverChanged: boolean;
  plan: TagPlan;
  fallback: FallbackPayload | null;
  peaks: number[] | null;
  waveformError: string | null;
  analysis: Analysis;
};

export type Prompt = { kind: 'replace'; file: File; extra: boolean } | { kind: 'close' } | null;
export type Phase = 'idle' | 'processing' | 'edit';

export type TrackSessionValue = {
  phase: Phase;
  track: TrackState | null;
  importError: string | null;
  artworkBusy: boolean;
  artworkNote: string | null;
  extraNote: string | null;
  template: string;
  prompt: Prompt;
  exporting: boolean;
  exportNote: string | null;
  exportError: boolean;
  preview: FilenamePreview | null;
  scanning: boolean;
  tech: string;
  exportNotice: string | null;
  keptOnExport: string[];
  stages: Stage[];
  analysisProblem: string;
  acceptFiles: (list: FileList | File[]) => void;
  openFile: (file: File, extra: boolean) => void;
  dismissPrompt: () => void;
  confirmPrompt: () => void;
  requestClose: () => void;
  stopAnalysis: () => void;
  openEditor: () => void;
  updateField: (key: keyof TrackFields, value: string) => void;
  updateTemplate: (value: string) => void;
  applyArtwork: (data: Uint8Array, mime: ImageMime, from: 'search' | 'upload') => void;
  removeArtwork: () => void;
  lockArtwork: () => void;
  onDownload: () => void;
  rerunBpm: () => void;
  rerunKey: () => void;
};

export const TrackSessionContext = createContext<TrackSessionValue | null>(null);

export function useTrackSession(): TrackSessionValue {
  const value = useContext(TrackSessionContext);
  if (!value) throw new Error('Track session is missing');
  return value;
}

function comparable(key: keyof TrackFields, value: string): string {
  const trimmed = value.trim();
  if (key === 'bpm') return bpmToken(trimmed) || trimmed;
  return trimmed;
}

export function updatedMeta(fields: TrackFields, fileFields: TrackFields): { label: string; value: string }[] {
  return (Object.keys(FIELD_LABELS) as (keyof TrackFields)[])
    .filter((key) => {
      const current = comparable(key, fields[key]);
      return current.length > 0 && current !== comparable(key, fileFields[key]);
    })
    .map((key) => ({ label: FIELD_LABELS[key], value: fields[key].trim() }));
}

export function originalMeta(fields: TrackFields): string {
  return (Object.keys(FIELD_LABELS) as (keyof TrackFields)[])
    .map((key) => fields[key].trim())
    .filter(Boolean)
    .join(' · ');
}
