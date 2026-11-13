import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnalysisScreen, type Stage } from '../components/AnalysisScreen.tsx';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { trackEvent } from '../lib/analytics.ts';
import type { ImageMime } from '../lib/artwork.ts';
import { DEFAULT_TEMPLATE, renderFilename } from '../lib/filename.ts';
import { formatBitrate, formatBytes, formatChannels, formatDuration, formatSampleRate } from '../lib/format.ts';
import type { TrackFields } from '../lib/types.ts';
import { TrackSessionContext, useTrackSession, type Phase, type Prompt, type TrackSessionValue, type TrackState } from './session-context.ts';

/** Matches `ANALYSIS_STEP_MS` in audio.ts without pulling that module into the landing bundle. */
const STEP_MS = 30_000;
const TEMPLATE_KEY = 'tracktidy.template';

type Tools = {
  withTimeout: typeof import('../lib/audio.ts').withTimeout;
  decodeAudio: typeof import('../lib/audio.ts').decodeAudio;
  detectBpm: typeof import('../lib/audio.ts').detectBpm;
  detectKey: typeof import('../lib/audio.ts').detectKey;
  waveformPeaks: typeof import('../lib/audio.ts').waveformPeaks;
  readTrack: typeof import('../lib/metadata.ts').readTrack;
  maxFileBytes: typeof import('../lib/mp3.ts').maxFileBytes;
  readErrorMessage: typeof import('../lib/mp3.ts').readErrorMessage;
  rejectionMessage: typeof import('../lib/mp3.ts').rejectionMessage;
  tooLargeMessage: typeof import('../lib/mp3.ts').tooLargeMessage;
  bytesEqual: typeof import('../lib/artwork.ts').bytesEqual;
  fitArtwork: typeof import('../lib/artwork.ts').fitArtwork;
  loadArtwork: typeof import('../lib/artwork.ts').loadArtwork;
  searchArtwork: typeof import('../lib/artwork.ts').searchArtwork;
  writeTrack: typeof import('../lib/id3.ts').writeTrack;
};

let toolsPromise: Promise<Tools> | null = null;

function tools(): Promise<Tools> {
  if (!toolsPromise) {
    toolsPromise = Promise.all([
      import('../lib/audio.ts'),
      import('../lib/metadata.ts'),
      import('../lib/mp3.ts'),
      import('../lib/artwork.ts'),
      import('../lib/id3.ts'),
    ])
      .then(([audio, metadata, mp3, artwork, id3]) => ({
        withTimeout: audio.withTimeout,
        decodeAudio: audio.decodeAudio,
        detectBpm: audio.detectBpm,
        detectKey: audio.detectKey,
        waveformPeaks: audio.waveformPeaks,
        readTrack: metadata.readTrack,
        maxFileBytes: mp3.maxFileBytes,
        readErrorMessage: mp3.readErrorMessage,
        rejectionMessage: mp3.rejectionMessage,
        tooLargeMessage: mp3.tooLargeMessage,
        bytesEqual: artwork.bytesEqual,
        fitArtwork: artwork.fitArtwork,
        loadArtwork: artwork.loadArtwork,
        searchArtwork: artwork.searchArtwork,
        writeTrack: id3.writeTrack,
      }))
      .catch((error: unknown) => {
        toolsPromise = null;
        throw error;
      });
  }
  return toolsPromise;
}

type Analysis = {
  bpm: { value: string; detail: string } | null;
  bpmError: string | null;
  key: { value: string; camelot: string; low: boolean; detail: string } | null;
  keyError: string | null;
  bpmPending: boolean;
  keyPending: boolean;
};

function storedTemplate(): string {
  try {
    const saved = localStorage.getItem(TEMPLATE_KEY);
    if (saved && saved.length <= 200) return saved;
  } catch {
    /* Private mode can block storage. The default template still works. */
  }
  return DEFAULT_TEMPLATE;
}

function noticeWithArtwork(notice: string | null, artworkChanged: boolean, removed = false): string | null {
  if (removed) {
    if (notice?.includes('may be dropped')) {
      return 'The download removes the artwork and writes a new ID3v2.3 tag. Cue points and uncommon frames may be dropped. The audio is not re-encoded.';
    }
    return 'The download removes the artwork. Other frames stay in the file. The audio is not re-encoded.';
  }
  if (!artworkChanged) return notice;
  const embedded = 'The artwork shown here is embedded in the download. The audio is not re-encoded.';
  if (!notice) return embedded;
  if (notice.includes('may be dropped')) {
    return 'The artwork shown here is written into a new ID3v2.3 tag. Cue points and uncommon frames may be dropped. The audio is not re-encoded.';
  }
  if (notice.includes('Artwork, cue data')) {
    return 'Export updates the fields you change and embeds the artwork shown here. Cue data and the other frames stay in the file. The audio is not re-encoded.';
  }
  if (notice.includes('including artwork')) {
    return 'Export updates the fields you change and embeds the artwork shown here. Cue data stays in place. An old ID3v1 trailer is removed when a field changes, so it can’t contradict the edit.';
  }
  return `${notice} ${embedded}`;
}

function emptyAnalysis(): Analysis {
  return { bpm: null, bpmError: null, key: null, keyError: null, bpmPending: false, keyPending: false };
}

function stagesFor(current: TrackState | null): Stage[] {
  if (!current) {
    return [
      { label: 'Read', detail: 'Reading the file', state: 'run' },
      { label: 'Wave', detail: 'Waiting', state: 'wait' },
      { label: 'Tempo', detail: 'Waiting', state: 'wait' },
      { label: 'Key', detail: 'Waiting', state: 'wait' },
    ];
  }
  const decoding = !current.peaks && !current.waveformError;
  const wave: Stage = current.waveformError
    ? { label: 'Wave', detail: 'Could not decode the audio', state: 'warn' }
    : current.peaks
      ? { label: 'Wave', detail: 'Drawn', state: 'done' }
      : { label: 'Wave', detail: 'Decoding audio', state: 'run' };
  const tempo: Stage = current.analysis.bpm
    ? { label: 'Tempo', detail: 'Measured', state: 'done' }
    : current.analysis.bpmError
      ? { label: 'Tempo', detail: 'Not measured', state: 'warn' }
      : current.analysis.bpmPending
        ? { label: 'Tempo', detail: 'Detecting tempo', state: 'run' }
        : { label: 'Tempo', detail: decoding ? 'Waiting for audio' : 'Waiting', state: 'wait' };
  const key: Stage = current.analysis.key
    ? { label: 'Key', detail: current.analysis.key.low ? 'Low confidence' : 'Estimated', state: 'done' }
    : current.analysis.keyError
      ? { label: 'Key', detail: 'Not estimated', state: 'warn' }
      : current.analysis.keyPending
        ? { label: 'Key', detail: 'Estimating key', state: 'run' }
        : { label: 'Key', detail: decoding ? 'Waiting for audio' : 'Waiting', state: 'wait' };
  return [{ label: 'Read', detail: 'Tags read', state: 'done' }, wave, tempo, key];
}

export function TrackSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [track, setTrack] = useState<TrackState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [artworkBusy, setArtworkBusy] = useState(false);
  const [artworkNote, setArtworkNote] = useState<string | null>(null);
  const [extraNote, setExtraNote] = useState<string | null>(null);
  const [template, setTemplate] = useState(storedTemplate);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);
  const loadId = useRef(0);
  const trackRef = useRef<TrackState | null>(null);
  const audioRef = useRef<AudioBuffer | null>(null);
  const coverRef = useRef<string | null>(null);
  const artworkLock = useRef(false);
  const editedFields = useRef(new Set<string>());
  const filenameKey = useRef('');
  const phaseRef = useRef<Phase>('idle');
  const ingestRef = useRef<(file: File, extra: boolean) => void>(() => {});

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    const previous = phaseRef.current;
    phaseRef.current = phase;
    if (previous !== 'edit' && phase === 'edit' && location.pathname !== '/app') {
      navigate('/app');
    }
  }, [phase, location.pathname, navigate]);

  useEffect(() => {
    if (phase !== 'processing') return undefined;
    const id = loadId.current;
    const timer = window.setTimeout(() => {
      if (loadId.current !== id) return;
      loadId.current += 1;
      const current = trackRef.current;
      if (!current) {
        setImportError('Reading this file took too long and was stopped. It may be damaged, or the browser could not finish opening it.');
        setPhase('idle');
        trackEvent('processing_failed', { stage: 'read' });
        return;
      }
      setTrack((trackState) =>
        trackState
          ? {
              ...trackState,
              waveformError:
                trackState.peaks || trackState.waveformError
                  ? trackState.waveformError
                  : 'The waveform was not drawn because analysis was stopped.',
              analysis: {
                ...trackState.analysis,
                bpmPending: false,
                keyPending: false,
                bpmError:
                  trackState.analysis.bpm || trackState.analysis.bpmError
                    ? trackState.analysis.bpmError
                    : 'Tempo detection did not finish and was stopped.',
                keyError:
                  trackState.analysis.key || trackState.analysis.keyError
                    ? trackState.analysis.keyError
                    : 'Key estimation did not finish and was stopped.',
              },
            }
          : trackState,
      );
      setPhase('edit');
      trackEvent('processing_failed', { stage: 'decode' });
    }, STEP_MS * 4);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (coverRef.current) URL.revokeObjectURL(coverRef.current);
      audioRef.current = null;
    };
  }, []);

  function rememberCover(url: string | null) {
    if (coverRef.current) URL.revokeObjectURL(coverRef.current);
    coverRef.current = url;
  }

  function openFile(file: File, extra: boolean) {
    if (trackRef.current) {
      setPrompt({ kind: 'replace', file, extra });
      return;
    }
    void ingest(file, extra);
  }

  function acceptFiles(list: FileList | File[]) {
    const file = list[0];
    if (!file) return;
    openFile(file, list.length > 1);
  }

  async function ingest(file: File, extra: boolean) {
    const id = ++loadId.current;
    editedFields.current = new Set();
    filenameKey.current = '';
    audioRef.current = null;
    setPrompt(null);
    setImportError(null);
    setArtworkBusy(false);
    setArtworkNote(null);
    artworkLock.current = false;
    setExportNote(null);
    setExportError(false);
    setExtraNote(extra ? 'Only the first file was used. TrackTidy handles one track at a time.' : null);
    setPhase('processing');
    setTrack(null);
    trackRef.current = null;
    trackEvent('file_upload_started');

    let lib: Tools;
    try {
      lib = await tools();
    } catch {
      if (id !== loadId.current) return;
      setImportError('The editor could not be loaded. Check the connection and try the file again.');
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'read' });
      return;
    }
    if (id !== loadId.current) return;

    if (file.size > lib.maxFileBytes()) {
      setImportError(lib.tooLargeMessage(file.size));
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'size' });
      return;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await lib.withTimeout(file.arrayBuffer(), STEP_MS, 'Opening this file took too long and was stopped.');
    } catch (error) {
      if (id !== loadId.current) return;
      setImportError(lib.readErrorMessage(error));
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'read' });
      return;
    }
    if (id !== loadId.current) return;

    const rejected = lib.rejectionMessage(file.name, new Uint8Array(buffer));
    if (rejected) {
      setImportError(rejected);
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'type' });
      return;
    }

    let parsed;
    try {
      parsed = await lib.withTimeout(
        lib.readTrack(buffer),
        STEP_MS,
        'Reading the tags took too long and was stopped. The file may be damaged or too unusual to parse.',
      );
    } catch (error) {
      if (id !== loadId.current) return;
      setImportError(
        error instanceof Error && error.message.includes('was stopped')
          ? error.message
          : 'This MP3 could not be read. The file may be damaged.',
      );
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'tags' });
      return;
    }
    if (id !== loadId.current) {
      if (parsed.coverUrl) URL.revokeObjectURL(parsed.coverUrl);
      return;
    }

    rememberCover(parsed.coverUrl);
    trackEvent('file_upload_completed');
    trackEvent('metadata_analysis_completed', {
      bpm_tag: parsed.fields.bpm.trim() ? 'yes' : 'no',
      key_tag: parsed.fields.key.trim() ? 'yes' : 'no',
    });
    const next: TrackState = {
      name: file.name,
      size: file.size,
      buffer,
      fileFields: parsed.fields,
      fields: { ...parsed.fields },
      remixFrame: parsed.remixFrame,
      technical: parsed.technical,
      kept: parsed.kept,
      coverUrl: parsed.coverUrl,
      coverBytes: parsed.cover?.data ?? null,
      coverMime: parsed.cover?.mime ?? null,
      embeddedCover: parsed.cover?.data ?? null,
      hadCover: Boolean(parsed.coverUrl),
      coverFrom: parsed.coverUrl ? 'file' : null,
      coverChanged: false,
      plan: parsed.plan,
      fallback: parsed.fallback,
      peaks: null,
      waveformError: null,
      analysis: emptyAnalysis(),
    };
    trackRef.current = next;
    setTrack(next);
    void analyse(id, buffer);
    if (!parsed.coverUrl && parsed.fields.artist.trim() && parsed.fields.title.trim()) {
      void lookupCover(id, parsed.fields);
    }
  }

  async function lookupCover(id: number, fields: TrackFields) {
    setArtworkBusy(true);
    setArtworkNote(null);
    const lib = await tools();
    try {
      const hits = await lib.searchArtwork({
        artist: fields.artist,
        title: fields.title,
        album: fields.album,
        remix: fields.remix,
      });
      if (id !== loadId.current || artworkLock.current) return;
      const hit = hits[0];
      if (!hit) {
        setArtworkNote('No reliable artwork match was found for this artist and title. You can upload an image instead.');
        return;
      }
      const loaded = await lib.loadArtwork(hit.imageUrl);
      if (id !== loadId.current || artworkLock.current) return;
      const fitted = await lib.fitArtwork(loaded.bytes, loaded.mime);
      const seen = trackRef.current;
      if (id !== loadId.current || artworkLock.current || !seen || seen.coverUrl || seen.coverChanged || seen.hadCover) return;
      const copy = new ArrayBuffer(fitted.bytes.byteLength);
      new Uint8Array(copy).set(fitted.bytes);
      const bytes = new Uint8Array(copy);
      const url = URL.createObjectURL(new Blob([copy], { type: fitted.mime }));
      rememberCover(url);
      setTrack((current) => {
        if (artworkLock.current || !current || current.coverUrl || current.coverChanged || current.hadCover) return current;
        return {
          ...current,
          coverUrl: url,
          coverBytes: bytes,
          coverMime: fitted.mime,
          coverFrom: 'search',
          coverChanged: !lib.bytesEqual(current.embeddedCover, bytes),
        };
      });
    } catch (caught) {
      if (id !== loadId.current || artworkLock.current) return;
      setArtworkNote(caught instanceof Error ? caught.message : 'Artwork search failed. You can upload an image instead.');
    } finally {
      if (id === loadId.current) setArtworkBusy(false);
    }
  }

  async function analyse(id: number, buffer: ArrayBuffer) {
    const lib = await tools();
    let audio: AudioBuffer;
    try {
      audio = await lib.decodeAudio(buffer);
    } catch (error) {
      if (id !== loadId.current) return;
      audioRef.current = null;
      const reason = error instanceof Error && error.message.trim() ? error.message.trim() : 'The browser could not decode this MP3.';
      const message = reason.includes('tags can still be edited')
        ? reason
        : `${reason.replace(/[.!?]\s*$/, '')}. Tempo and key were not measured. The tags can still be edited.`;
      trackEvent('processing_failed', { stage: 'decode' });
      setTrack((current) =>
        current
          ? {
              ...current,
              waveformError: message,
              analysis: {
                ...current.analysis,
                bpmPending: false,
                keyPending: false,
                bpmError: 'Tempo was not measured because the audio could not be decoded.',
                keyError: 'Key was not estimated because the audio could not be decoded.',
              },
            }
          : current,
      );
      setPhase('edit');
      return;
    }
    if (id !== loadId.current) return;
    audioRef.current = audio;
    const peaks = lib.waveformPeaks(audio);
    setTrack((current) =>
      current
        ? {
            ...current,
            peaks,
            technical: { ...current.technical, duration: audio.duration },
            analysis: { ...current.analysis, bpmPending: true, keyPending: true },
          }
        : current,
    );

    const bpmWork = lib
      .detectBpm(audio)
      .then((result) => {
        if (id !== loadId.current) return;
        setTrack((current) => {
          if (!current) return current;
          const fields = current.fields.bpm.trim() ? current.fields : { ...current.fields, bpm: result.bpm };
          return {
            ...current,
            fields,
            analysis: { ...current.analysis, bpmPending: false, bpm: { value: result.bpm, detail: result.detail }, bpmError: null },
          };
        });
      })
      .catch((error: unknown) => {
        if (id !== loadId.current) return;
        const message = error instanceof Error ? error.message : 'Tempo could not be detected from this audio.';
        setTrack((current) =>
          current ? { ...current, analysis: { ...current.analysis, bpmPending: false, bpmError: message } } : current,
        );
      });

    const keyWork = lib
      .detectKey(audio)
      .then((result) => {
        if (id !== loadId.current) return;
        setTrack((current) => {
          if (!current) return current;
          const fields = current.fields.key.trim() ? current.fields : { ...current.fields, key: result.musical };
          return {
            ...current,
            fields,
            analysis: {
              ...current.analysis,
              keyPending: false,
              key: { value: result.musical, camelot: result.camelot, low: result.low, detail: result.detail },
              keyError: null,
            },
          };
        });
      })
      .catch((error: unknown) => {
        if (id !== loadId.current) return;
        const message = error instanceof Error ? error.message : 'A key could not be estimated from this audio.';
        setTrack((current) =>
          current ? { ...current, analysis: { ...current.analysis, keyPending: false, keyError: message } } : current,
        );
      });

    await Promise.all([bpmWork, keyWork]);
    if (id !== loadId.current) return;
    setPhase((current) => (current === 'processing' ? 'edit' : current));
  }

  async function rerunBpm() {
    const audio = audioRef.current;
    if (!audio || !trackRef.current) {
      setTrack((current) =>
        current
          ? { ...current, analysis: { ...current.analysis, bpmError: current.waveformError ?? 'The audio is not ready to measure yet.' } }
          : current,
      );
      return;
    }
    const id = loadId.current;
    setTrack((current) => (current ? { ...current, analysis: { ...current.analysis, bpmPending: true, bpmError: null } } : current));
    try {
      const lib = await tools();
      const result = await lib.detectBpm(audio);
      if (id !== loadId.current) return;
      setTrack((current) =>
        current
          ? {
              ...current,
              fields: { ...current.fields, bpm: result.bpm },
              analysis: { ...current.analysis, bpmPending: false, bpm: { value: result.bpm, detail: result.detail }, bpmError: null },
            }
          : current,
      );
    } catch (error) {
      if (id !== loadId.current) return;
      const message = error instanceof Error ? error.message : 'Tempo could not be detected from this audio.';
      setTrack((current) => (current ? { ...current, analysis: { ...current.analysis, bpmPending: false, bpmError: message } } : current));
    }
  }

  async function rerunKey() {
    const audio = audioRef.current;
    if (!audio || !trackRef.current) {
      setTrack((current) =>
        current
          ? { ...current, analysis: { ...current.analysis, keyError: current.waveformError ?? 'The audio is not ready to measure yet.' } }
          : current,
      );
      return;
    }
    const id = loadId.current;
    setTrack((current) => (current ? { ...current, analysis: { ...current.analysis, keyPending: true, keyError: null } } : current));
    try {
      const lib = await tools();
      const result = await lib.detectKey(audio);
      if (id !== loadId.current) return;
      setTrack((current) =>
        current
          ? {
              ...current,
              fields: { ...current.fields, key: result.musical },
              analysis: {
                ...current.analysis,
                keyPending: false,
                key: { value: result.musical, camelot: result.camelot, low: result.low, detail: result.detail },
                keyError: null,
              },
            }
          : current,
      );
    } catch (error) {
      if (id !== loadId.current) return;
      const message = error instanceof Error ? error.message : 'A key could not be estimated from this audio.';
      setTrack((current) => (current ? { ...current, analysis: { ...current.analysis, keyPending: false, keyError: message } } : current));
    }
  }

  function updateField(key: keyof TrackFields, value: string) {
    setTrack((current) => (current ? { ...current, fields: { ...current.fields, [key]: value } } : current));
    setExportNote(null);
    if (!editedFields.current.has(key)) {
      editedFields.current.add(key);
      trackEvent('metadata_edit_completed', { field: key });
    }
  }

  function updateTemplate(value: string) {
    setTemplate(value);
    try {
      localStorage.setItem(TEMPLATE_KEY, value);
    } catch {
      /* The template still applies for this session. */
    }
  }

  function closeTrack() {
    loadId.current += 1;
    audioRef.current = null;
    rememberCover(null);
    setTrack(null);
    trackRef.current = null;
    setPhase('idle');
    setPrompt(null);
    setExportNote(null);
    setExtraNote(null);
    setImportError(null);
    setArtworkBusy(false);
    setArtworkNote(null);
    artworkLock.current = false;
    navigate('/');
  }

  function stopAnalysis() {
    loadId.current += 1;
    audioRef.current = null;
    const current = trackRef.current;
    if (!current) {
      setImportError('Reading was stopped before the file could be opened.');
      setTrack(null);
      setPhase('idle');
      return;
    }
    setTrack((trackState) =>
      trackState
        ? {
            ...trackState,
            waveformError:
              trackState.peaks || trackState.waveformError
                ? trackState.waveformError
                : 'Decoding was stopped, so the waveform, tempo, and key were not measured. The tags can still be edited.',
            analysis: {
              ...trackState.analysis,
              bpmPending: false,
              keyPending: false,
              bpm: trackState.analysis.bpm,
              key: trackState.analysis.key,
              bpmError:
                trackState.analysis.bpm || trackState.analysis.bpmError
                  ? trackState.analysis.bpmError
                  : 'Tempo detection was stopped before it finished.',
              keyError:
                trackState.analysis.key || trackState.analysis.keyError
                  ? trackState.analysis.keyError
                  : 'Key estimation was stopped before it finished.',
            },
          }
        : trackState,
    );
    setPhase('edit');
  }

  function applyArtwork(data: Uint8Array, mime: ImageMime, from: 'search' | 'upload') {
    void tools().then((lib) => {
      const copy = new ArrayBuffer(data.byteLength);
      new Uint8Array(copy).set(data);
      const bytes = new Uint8Array(copy);
      const url = URL.createObjectURL(new Blob([copy], { type: mime }));
      rememberCover(url);
      setArtworkNote(null);
      setTrack((current) =>
        current
          ? {
              ...current,
              coverUrl: url,
              coverBytes: bytes,
              coverMime: mime,
              coverFrom: from,
              coverChanged: !lib.bytesEqual(current.embeddedCover, bytes),
            }
          : current,
      );
      setExportNote(null);
      setExportError(false);
    });
  }

  function removeArtwork() {
    rememberCover(null);
    setArtworkNote(null);
    setTrack((current) =>
      current
        ? { ...current, coverUrl: null, coverBytes: null, coverMime: null, coverFrom: null, coverChanged: current.hadCover }
        : current,
    );
    setExportNote(null);
    setExportError(false);
  }

  function onDownload() {
    const current = trackRef.current;
    const name = current ? renderFilename(template, current.fields).file : '';
    if (!current || !name) return;
    setExporting(true);
    setExportError(false);
    void tools()
      .then((lib) => {
        const result = lib.writeTrack(current.buffer, {
          fields: current.fields,
          original: current.fileFields,
          remixFrame: current.remixFrame,
          fallback: current.fallback,
          artwork: !current.coverChanged
            ? 'keep'
            : current.coverBytes && current.coverMime
              ? { data: current.coverBytes, mime: current.coverMime }
              : 'remove',
        });
        const copy = new ArrayBuffer(result.bytes.byteLength);
        new Uint8Array(copy).set(result.bytes);
        const url = URL.createObjectURL(new Blob([copy], { type: 'audio/mpeg' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        const extra = result.notice ? ` ${result.notice}` : '';
        setExportNote(`Downloaded ${name}.${extra}`.trim());
        trackEvent('file_downloaded');
      })
      .catch(() => {
        setExportError(true);
        setExportNote('The file could not be prepared. Your original file was not changed.');
        trackEvent('processing_failed', { stage: 'export' });
      })
      .finally(() => setExporting(false));
  }

  useEffect(() => {
    ingestRef.current = (file, extra) => {
      void ingest(file, extra);
    };
  });

  const preview = track ? renderFilename(template, track.fields) : null;

  useEffect(() => {
    if (!track || !preview?.file) return;
    const key = `${loadId.current}:${template}`;
    if (filenameKey.current === key) return;
    filenameKey.current = key;
    trackEvent('filename_generated');
  }, [preview, template, track]);

  const scanning = Boolean(track && (track.analysis.bpmPending || track.analysis.keyPending || !track.peaks) && !track.waveformError);
  const tech = track
    ? ['MP3', formatBytes(track.size), formatBitrate(track.technical.bitrate), formatSampleRate(track.technical.sampleRate), formatChannels(track.technical.channels), formatDuration(track.technical.duration)]
        .filter(Boolean)
        .join(' · ')
    : '';
  const exportNotice = track
    ? noticeWithArtwork(track.plan.notice, Boolean(track.coverChanged && track.coverBytes), Boolean(track.coverChanged && !track.coverBytes))
    : null;
  const keptOnExport = track
    ? track.coverChanged
      ? track.kept.filter((item) => item !== 'artwork' && !item.endsWith(' images'))
      : track.kept
    : [];
  const stages = stagesFor(phase === 'processing' ? track : null);
  const analysisProblem = !track
    ? ''
    : track.waveformError
      ? track.waveformError
      : [track.analysis.bpmError, track.analysis.keyError].filter(Boolean).join(' ');

  const value: TrackSessionValue = {
    phase,
    track,
    importError,
    artworkBusy,
    artworkNote,
    extraNote,
    template,
    prompt,
    exporting,
    exportNote,
    exportError,
    preview,
    scanning,
    tech,
    exportNotice,
    keptOnExport,
    stages,
    analysisProblem,
    acceptFiles,
    openFile,
    dismissPrompt: () => setPrompt(null),
    confirmPrompt: () => {
      const current = prompt;
      if (!current) return;
      if (current.kind === 'close') closeTrack();
      else ingestRef.current(current.file, current.extra);
    },
    requestClose: () => setPrompt({ kind: 'close' }),
    stopAnalysis,
    openEditor: () => setPhase('edit'),
    updateField,
    updateTemplate,
    applyArtwork,
    removeArtwork,
    lockArtwork: () => {
      artworkLock.current = true;
      setArtworkNote(null);
    },
    onDownload,
    rerunBpm: () => void rerunBpm(),
    rerunKey: () => void rerunKey(),
  };

  return (
    <TrackSessionContext.Provider value={value}>
      <SessionChrome />
      {children}
    </TrackSessionContext.Provider>
  );
}

function SessionChrome() {
  const session = useTrackSession();
  if (session.phase !== 'processing' && !session.prompt) return null;
  return (
    <>
      {session.phase === 'processing' ? (
        <div className="process-layer">
          <Atmosphere />
          <AnalysisScreen
            name={session.track?.name ?? 'Checking the file'}
            peaks={session.track?.peaks ?? null}
            scanning={session.scanning || !session.track}
            stages={session.stages}
            onEdit={session.track?.peaks ? session.openEditor : undefined}
            onStop={session.stopAnalysis}
          />
        </div>
      ) : null}
      {session.prompt ? (
        <div
          className="confirm-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) session.dismissPrompt();
          }}
        >
          <div
            className="confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') session.dismissPrompt();
            }}
          >
            <p id="confirm-title">
              {session.prompt.kind === 'close'
                ? 'Start a new track? Edits that are not downloaded will be lost.'
                : 'Replace this track? Edits that are not downloaded will be lost.'}
            </p>
            <div className="confirm-actions">
              <button autoFocus type="button" className="btn btn-secondary" onClick={session.dismissPrompt}>
                Keep current
              </button>
              <button type="button" className="btn btn-primary" onClick={session.confirmPrompt}>
                {session.prompt.kind === 'close' ? 'New track' : 'Replace'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


