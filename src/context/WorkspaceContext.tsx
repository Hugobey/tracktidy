import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { autoCleanFields, type LibraryTrack } from '../lib/library-clean.ts';
import { DEMO_LIBRARY } from '../lib/library-demo.ts';
import { DEFAULT_LIBRARY_TOKENS, renderLibraryFilename, type LibraryToken } from '../lib/library-name.ts';
import type { FallbackPayload, TrackFields } from '../lib/types.ts';
import {
  fileForTrack,
  fieldsFromMetadata,
  metadataFromFields,
  sameFields,
  sameMetadata,
  statusFor,
  toLibraryRow,
  type CrateLibraryRow,
  type CrateTrack,
  type TrackMetadata,
} from '../types/track.ts';

export type CrateKind = 'demo' | 'files' | 'empty';
export type ViewMode = 'single' | 'crate';

const HISTORY_LIMIT = 40;
const TAGS = ['artist', 'title', 'remix', 'album', 'genre', 'bpm', 'key'] as const;

type StoredShape = {
  kind: CrateKind;
  tokens: LibraryToken[];
  rows: LibraryTrack[];
};

type HistoryEntry = {
  tracks: CrateTrack[];
  tokens: LibraryToken[];
  kind: CrateKind;
};

export type EditorAdopt = {
  id: string;
  file: File | null;
  buffer: ArrayBuffer;
  sourceName: string;
  fields: TrackFields;
  original: TrackFields;
  coverUrl: string | null;
  waveformPeaks: number[] | null;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
};

type WorkspaceValue = {
  tracks: CrateTrack[];
  libraryRows: CrateLibraryRow[];
  activeTrackId: string | null;
  viewMode: ViewMode;
  history: CrateTrack[][];
  future: CrateTrack[][];
  kind: CrateKind;
  tokens: LibraryToken[];
  updateTrack: (id: string, patch: Partial<TrackMetadata>) => CrateLibraryRow[] | null;
  updateTracks: (edits: { id: string; patch: Partial<TrackMetadata> }[]) => CrateLibraryRow[] | null;
  replaceRows: (rows: LibraryTrack[]) => CrateLibraryRow[];
  pushHistory: () => void;
  undo: () => { rows: CrateLibraryRow[]; tokens: LibraryToken[]; kind: CrateKind } | null;
  redo: () => { rows: CrateLibraryRow[]; tokens: LibraryToken[]; kind: CrateKind } | null;
  setTokens: (tokens: LibraryToken[], remember?: boolean) => void;
  setKind: (kind: CrateKind) => void;
  setViewMode: (mode: ViewMode) => void;
  openTrack: (id: string) => void;
  backToCrate: () => void;
  closeEditor: () => void;
  loadDemo: () => CrateLibraryRow[];
  adoptEditorTrack: (input: EditorAdopt) => void;
  mirrorMetadata: (id: string, fields: TrackFields) => void;
  mirrorMedia: (id: string, media: { coverUrl?: string | null; waveformPeaks?: number[] | null }) => void;
  trackById: (id: string) => CrateTrack | null;
  coverInUse: (url: string) => boolean;
  hasHydrated: () => boolean;
  finishHydrate: (stored: StoredShape | null) => { rows: CrateLibraryRow[]; kind: CrateKind; tokens: LibraryToken[] };
  markDirty: () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function cloneTokens(tokens: LibraryToken[]): LibraryToken[] {
  return tokens.map((token) => ({ ...token }));
}

function cloneMetadata(meta: TrackMetadata): TrackMetadata {
  return { ...meta };
}

function cloneTrack(track: CrateTrack): CrateTrack {
  return {
    ...track,
    file: track.file,
    buffer: track.buffer,
    originalMetadata: cloneMetadata(track.originalMetadata),
    currentMetadata: cloneMetadata(track.currentMetadata),
    cleaned: cloneMetadata(track.cleaned),
    bands: track.bands ? track.bands.map((band) => ({ ...band })) : null,
    waveformPeaks: track.waveformPeaks ? track.waveformPeaks.slice() : null,
    fallback: track.fallback
      ? { ...track.fallback, pictures: track.fallback.pictures.map((picture) => ({ ...picture, data: picture.data })) }
      : null,
  };
}

function cloneTracks(tracks: CrateTrack[]): CrateTrack[] {
  return tracks.map(cloneTrack);
}

function demoTracks(): CrateTrack[] {
  return DEMO_LIBRARY.map((track) => {
    const cleanedFields = autoCleanFields({ ...track.fields });
    const filename = renderLibraryFilename(DEFAULT_LIBRARY_TOKENS, cleanedFields) || track.sourceName;
    const cleaned = metadataFromFields(cleanedFields, filename, null);
    return {
      id: track.id,
      file: new File([], track.sourceName, { type: 'audio/mpeg' }),
      sourceName: track.sourceName,
      originalMetadata: metadataFromFields(track.fields, track.sourceName, null),
      currentMetadata: { ...cleaned },
      cleaned,
      coverUrl: null,
      coverRemoved: false,
      waveformPeaks: null,
      status: 'ready',
      bands: null,
      remixFrame: 'TIT3',
      fallback: null,
      skeleton: false,
      scanning: false,
      analysing: false,
      failed: false,
      enterDelay: 0,
      buffer: null,
    };
  });
}

function filenameFor(existing: CrateTrack | undefined, fields: TrackFields, tokens: LibraryToken[], sourceName: string): string {
  if (!existing) return renderLibraryFilename(tokens, fields) || sourceName;
  const previous = fieldsFromMetadata(existing.currentMetadata);
  const autoName = renderLibraryFilename(tokens, previous) || sourceName;
  const custom = existing.currentMetadata.filename !== autoName && existing.currentMetadata.filename !== sourceName;
  if (custom && sameFields(previous, fields)) return existing.currentMetadata.filename;
  if (custom && !sameFields(previous, fields)) return existing.currentMetadata.filename;
  return renderLibraryFilename(tokens, fields) || existing.currentMetadata.filename || sourceName;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<CrateTrack[]>(demoTracks);
  const [tokens, setTokensState] = useState<LibraryToken[]>(DEFAULT_LIBRARY_TOKENS);
  const [kind, setKindState] = useState<CrateKind>('demo');
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>('single');
  const [history, setHistory] = useState<CrateTrack[][]>([]);
  const [future, setFuture] = useState<CrateTrack[][]>([]);
  const tracksRef = useRef(tracks);
  const tokensRef = useRef(tokens);
  const kindRef = useRef(kind);
  const viewRef = useRef<CrateLibraryRow[]>(tracks.map(toLibraryRow));
  const past = useRef<HistoryEntry[]>([]);
  const ahead = useRef<HistoryEntry[]>([]);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);

  const libraryRows = useMemo(() => tracks.map(toLibraryRow), [tracks]);

  function publishHistory() {
    setHistory(past.current.map((entry) => entry.tracks));
    setFuture(ahead.current.map((entry) => entry.tracks));
  }

  function commitTracks(next: CrateTrack[]): CrateLibraryRow[] {
    tracksRef.current = next;
    const view = next.map(toLibraryRow);
    viewRef.current = view;
    setTracks(next);
    return view;
  }

  function pushHistory() {
    past.current.push({
      tracks: cloneTracks(tracksRef.current),
      tokens: cloneTokens(tokensRef.current),
      kind: kindRef.current,
    });
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    ahead.current = [];
    publishHistory();
  }

  function applyEntry(entry: HistoryEntry): CrateLibraryRow[] {
    tokensRef.current = cloneTokens(entry.tokens);
    kindRef.current = entry.kind;
    setTokensState(tokensRef.current);
    setKindState(entry.kind);
    return commitTracks(cloneTracks(entry.tracks));
  }

  function undo() {
    const entry = past.current.pop();
    if (!entry) return null;
    ahead.current.push({
      tracks: cloneTracks(tracksRef.current),
      tokens: cloneTokens(tokensRef.current),
      kind: kindRef.current,
    });
    const rows = applyEntry(entry);
    publishHistory();
    return { rows, tokens: tokensRef.current, kind: kindRef.current };
  }

  function redo() {
    const entry = ahead.current.pop();
    if (!entry) return null;
    past.current.push({
      tracks: cloneTracks(tracksRef.current),
      tokens: cloneTokens(tokensRef.current),
      kind: kindRef.current,
    });
    const rows = applyEntry(entry);
    publishHistory();
    return { rows, tokens: tokensRef.current, kind: kindRef.current };
  }

  function applyPatch(track: CrateTrack, patch: Partial<TrackMetadata>): CrateTrack {
    const nextMeta: TrackMetadata = { ...track.currentMetadata, ...patch };
    const tagsChanged = TAGS.some((key) => patch[key] !== undefined && patch[key] !== track.currentMetadata[key]);
    if (patch.filename === undefined && tagsChanged) {
      nextMeta.filename = renderLibraryFilename(tokensRef.current, fieldsFromMetadata(nextMeta)) || nextMeta.filename;
    }
    if (patch.filename !== undefined) nextMeta.filename = patch.filename;
    const coverUrl = patch.coverArt !== undefined ? patch.coverArt : track.coverUrl;
    const coverRemoved = patch.coverArt === undefined ? track.coverRemoved : patch.coverArt === null;
    nextMeta.coverArt = coverUrl;
    if (sameMetadata(track.currentMetadata, nextMeta) && coverUrl === track.coverUrl && coverRemoved === track.coverRemoved) return track;
    return { ...track, currentMetadata: nextMeta, coverUrl, coverRemoved };
  }

  function updateTracks(edits: { id: string; patch: Partial<TrackMetadata> }[]): CrateLibraryRow[] | null {
    if (edits.length === 0) return null;
    const patches = new Map(edits.map((edit) => [edit.id, edit.patch]));
    let changed = false;
    const next = tracksRef.current.map((track) => {
      const patch = patches.get(track.id);
      if (!patch) return track;
      const updated = applyPatch(track, patch);
      if (updated !== track) changed = true;
      return updated;
    });
    if (!changed) return null;
    pushHistory();
    dirtyRef.current = true;
    return commitTracks(next);
  }

  function updateTrack(id: string, patch: Partial<TrackMetadata>): CrateLibraryRow[] | null {
    return updateTracks([{ id, patch }]);
  }

  function replaceRows(rows: LibraryTrack[]): CrateLibraryRow[] {
    const previous = new Map(tracksRef.current.map((track) => [track.id, track]));
    const next = rows.map((row) => {
      const existing = previous.get(row.id);
      const filename = filenameFor(existing, row.fields, tokensRef.current, row.sourceName);
      const coverRemoved = existing?.coverRemoved ?? false;
      const coverUrl = coverRemoved ? null : row.coverUrl;
      return {
        id: row.id,
        file: fileForTrack(existing, row.sourceName, row.buffer),
        sourceName: row.sourceName,
        originalMetadata: metadataFromFields(row.original, row.sourceName, null),
        currentMetadata: metadataFromFields(row.fields, filename, coverUrl),
        cleaned: metadataFromFields(row.cleaned, filename, coverUrl),
        coverUrl,
        coverRemoved,
        waveformPeaks: existing?.waveformPeaks ?? null,
        status: statusFor(row),
        bands: row.bands,
        remixFrame: row.remixFrame,
        fallback: row.fallback,
        skeleton: row.skeleton,
        scanning: row.scanning,
        analysing: row.analysing,
        failed: row.failed,
        enterDelay: row.enterDelay,
        buffer: row.buffer,
      } satisfies CrateTrack;
    });
    return commitTracks(next);
  }

  function retitle(nextTokens: LibraryToken[], source: CrateTrack[]): CrateTrack[] {
    return source.map((track) => {
      const fields = fieldsFromMetadata(track.currentMetadata);
      const filename = renderLibraryFilename(nextTokens, fields) || track.currentMetadata.filename;
      if (filename === track.currentMetadata.filename) return track;
      return { ...track, currentMetadata: { ...track.currentMetadata, filename } };
    });
  }

  function setTokens(next: LibraryToken[], remember = false) {
    if (remember) pushHistory();
    const copy = cloneTokens(next);
    tokensRef.current = copy;
    setTokensState(copy);
    commitTracks(retitle(copy, tracksRef.current));
  }

  function setKind(next: CrateKind) {
    kindRef.current = next;
    setKindState(next);
  }

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
  }

  function openTrack(id: string) {
    setActiveTrackId(id);
    setViewModeState('single');
  }

  function backToCrate() {
    setViewModeState('crate');
  }

  function closeEditor() {
    setActiveTrackId(null);
  }

  function loadDemo(): CrateLibraryRow[] {
    pushHistory();
    kindRef.current = 'demo';
    setKindState('demo');
    dirtyRef.current = true;
    return commitTracks(demoTracks());
  }

  function adoptEditorTrack(input: EditorAdopt) {
    dirtyRef.current = true;
    const existing = tracksRef.current.find((track) => track.id === input.id || track.sourceName === input.sourceName);
    const file =
      input.file && input.file.size > 0
        ? input.file
        : existing && existing.file.size > 0
          ? existing.file
          : new File([input.buffer], input.sourceName, { type: 'audio/mpeg' });
    const filename =
      existing && sameFields(fieldsFromMetadata(existing.currentMetadata), input.fields)
        ? existing.currentMetadata.filename
        : renderLibraryFilename(tokensRef.current, input.fields) || existing?.currentMetadata.filename || input.sourceName;
    const track: CrateTrack = {
      id: existing?.id ?? input.id,
      file,
      sourceName: input.sourceName,
      originalMetadata: metadataFromFields(input.original, input.sourceName, null),
      currentMetadata: metadataFromFields(input.fields, filename, input.coverUrl),
      cleaned: existing?.cleaned ?? metadataFromFields(input.fields, filename, input.coverUrl),
      coverUrl: input.coverUrl,
      coverRemoved: input.coverUrl ? false : (existing?.coverRemoved ?? false),
      waveformPeaks: input.waveformPeaks ?? existing?.waveformPeaks ?? null,
      status: 'ready',
      bands: existing?.bands ?? null,
      remixFrame: input.remixFrame,
      fallback: input.fallback,
      skeleton: false,
      scanning: false,
      analysing: false,
      failed: false,
      enterDelay: existing?.enterDelay ?? 0,
      buffer: input.buffer,
    };
    let next: CrateTrack[];
    if (kindRef.current !== 'files') {
      next = [track];
      setKind('files');
    } else if (!existing) {
      next = [...tracksRef.current, track];
    } else {
      next = tracksRef.current.map((item) => (item.id === existing.id ? track : item));
    }
    commitTracks(next);
    setActiveTrackId(track.id);
    setViewModeState('single');
  }

  function mirrorMetadata(id: string, fields: TrackFields) {
    const track = tracksRef.current.find((item) => item.id === id);
    if (!track) return;
    const previous = fieldsFromMetadata(track.currentMetadata);
    const autoName = renderLibraryFilename(tokensRef.current, previous) || track.sourceName;
    const custom = track.currentMetadata.filename !== autoName && track.currentMetadata.filename !== track.sourceName;
    const nextMeta: TrackMetadata = {
      ...track.currentMetadata,
      ...fields,
      filename: custom ? track.currentMetadata.filename : renderLibraryFilename(tokensRef.current, fields) || track.currentMetadata.filename,
      coverArt: track.coverUrl,
    };
    if (sameMetadata(track.currentMetadata, nextMeta)) return;
    commitTracks(tracksRef.current.map((item) => (item.id === id ? { ...item, currentMetadata: nextMeta } : item)));
  }

  function mirrorMedia(id: string, media: { coverUrl?: string | null; waveformPeaks?: number[] | null }) {
    const track = tracksRef.current.find((item) => item.id === id);
    if (!track) return;
    const coverUrl = media.coverUrl === undefined ? track.coverUrl : media.coverUrl;
    const waveformPeaks = media.waveformPeaks === undefined ? track.waveformPeaks : media.waveformPeaks;
    if (coverUrl === track.coverUrl && waveformPeaks === track.waveformPeaks) return;
    const nextMeta = { ...track.currentMetadata, coverArt: coverUrl };
    commitTracks(
      tracksRef.current.map((item) => (item.id === id ? { ...item, coverUrl, waveformPeaks, currentMetadata: nextMeta } : item)),
    );
  }

  function trackById(id: string): CrateTrack | null {
    return tracksRef.current.find((track) => track.id === id) ?? null;
  }

  function coverInUse(url: string): boolean {
    return tracksRef.current.some((item) => item.coverUrl === url);
  }

  function hasHydrated() {
    return hydratedRef.current;
  }

  function hydrateView(): { rows: CrateLibraryRow[]; kind: CrateKind; tokens: LibraryToken[] } {
    return { rows: viewRef.current, kind: kindRef.current, tokens: tokensRef.current };
  }

  function finishHydrate(stored: StoredShape | null): { rows: CrateLibraryRow[]; kind: CrateKind; tokens: LibraryToken[] } {
    hydratedRef.current = true;
    if (!stored) return hydrateView();
    if (!dirtyRef.current) {
      const copy = cloneTokens(stored.tokens.length > 0 ? stored.tokens : DEFAULT_LIBRARY_TOKENS);
      tokensRef.current = copy;
      setTokensState(copy);
      kindRef.current = stored.kind;
      setKindState(stored.kind);
      replaceRows(stored.rows);
      return hydrateView();
    }
    if (stored.kind !== 'files') return hydrateView();
    const known = new Set(tracksRef.current.flatMap((track) => [track.id, track.sourceName]));
    const extras = stored.rows.filter((row) => !known.has(row.id) && !known.has(row.sourceName));
    if (extras.length > 0) replaceRows([...viewRef.current, ...extras]);
    return hydrateView();
  }

  function markDirty() {
    dirtyRef.current = true;
  }

  const value: WorkspaceValue = {
    tracks,
    libraryRows,
    activeTrackId,
    viewMode,
    history,
    future,
    kind,
    tokens,
    updateTrack,
    updateTracks,
    replaceRows,
    pushHistory,
    undo,
    redo,
    setTokens,
    setKind,
    setViewMode,
    openTrack,
    backToCrate,
    closeEditor,
    loadDemo,
    adoptEditorTrack,
    mirrorMetadata,
    mirrorMedia,
    trackById,
    coverInUse,
    hasHydrated,
    finishHydrate,
    markDirty,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('Workspace is missing');
  return value;
}
