import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnalysisScreen, type Stage } from '../components/AnalysisScreen.tsx';
import { ArtworkPanel } from '../components/ArtworkPanel.tsx';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { Logo } from '../components/Logo.tsx';
import { MetadataEditor } from '../components/MetadataEditor.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { UploadOverlay } from '../components/UploadOverlay.tsx';
import { Waveform } from '../components/Waveform.tsx';
import { trackEvent } from '../lib/analytics.ts';
import { bytesEqual, fitArtwork, loadArtwork, searchArtwork, type ImageMime } from '../lib/artwork.ts';
import { clearPending, peekPending } from '../lib/pendingFile.ts';
import { TOOL_DESCRIPTION, TOOL_TITLE } from '../lib/site.ts';
import { ANALYSIS_STEP_MS, decodeAudio, detectBpm, detectKey, waveformPeaks, withTimeout } from '../lib/audio.ts';
import { DEFAULT_TEMPLATE, bpmToken, renderFilename, type FilenamePreview } from '../lib/filename.ts';
import { formatBitrate, formatBytes, formatChannels, formatDuration, formatSampleRate } from '../lib/format.ts';
import { noticeWithArtwork, writeTrack } from '../lib/id3.ts';
import { readTrack } from '../lib/metadata.ts';
import { maxFileBytes, readErrorMessage, rejectionMessage, tooLargeMessage } from '../lib/mp3.ts';
import type { FallbackPayload, TagPlan, TechnicalInfo, TrackFields } from '../lib/types.ts';

const TEMPLATE_KEY = 'tracktidy.template';

const FIELD_LABELS: Record<keyof TrackFields, string> = {
  artist: 'Artist',
  title: 'Title',
  remix: 'Remix',
  album: 'Album',
  genre: 'Genre',
  bpm: 'BPM',
  key: 'Key',
};

function comparable(key: keyof TrackFields, value: string): string {
  const trimmed = value.trim();
  if (key === 'bpm') return bpmToken(trimmed) || trimmed;
  return trimmed;
}

function originalMetaLine(fields: TrackFields): string {
  return (Object.keys(FIELD_LABELS) as (keyof TrackFields)[])
    .map((key) => fields[key].trim())
    .filter(Boolean)
    .join(' · ');
}

function updatedMeta(fields: TrackFields, fileFields: TrackFields): { label: string; value: string }[] {
  return (Object.keys(FIELD_LABELS) as (keyof TrackFields)[])
    .filter((key) => {
      const current = comparable(key, fields[key]);
      return current.length > 0 && current !== comparable(key, fileFields[key]);
    })
    .map((key) => ({ label: FIELD_LABELS[key], value: fields[key].trim() }));
}

type Analysis = {
  bpm: { value: string; detail: string } | null;
  bpmError: string | null;
  key: { value: string; camelot: string; low: boolean; detail: string } | null;
  keyError: string | null;
  bpmPending: boolean;
  keyPending: boolean;
};

type TrackState = {
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

type Prompt = { kind: 'replace'; file: File; extra: boolean } | { kind: 'close' } | null;

function storedTemplate(): string {
  try {
    const saved = localStorage.getItem(TEMPLATE_KEY);
    if (saved && saved.length <= 200) return saved;
  } catch {
    /* Private mode can block storage. The default template still works. */
  }
  return DEFAULT_TEMPLATE;
}

function emptyAnalysis(): Analysis {
  return {
    bpm: null,
    bpmError: null,
    key: null,
    keyError: null,
    bpmPending: false,
    keyPending: false,
  };
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

export default function ToolPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'idle' | 'processing' | 'edit'>('idle');
  const [track, setTrack] = useState<TrackState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [artworkBusy, setArtworkBusy] = useState(false);
  const [artworkNote, setArtworkNote] = useState<string | null>(null);
  const [extraNote, setExtraNote] = useState<string | null>(null);
  const [template, setTemplate] = useState(storedTemplate);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);
  const loadId = useRef(0);
  const trackRef = useRef<TrackState | null>(null);
  const audioRef = useRef<AudioBuffer | null>(null);
  const coverRef = useRef<string | null>(null);
  const artworkLock = useRef(false);
  const dragDepth = useRef(0);
  const acceptRef = useRef<(list: FileList | File[]) => void>(() => {});
  const ingestRef = useRef<(file: File, extra: boolean) => void>(() => {});
  const editedFields = useRef(new Set<string>());
  const filenameKey = useRef('');

  useEffect(() => {
    trackEvent('tool_opened');
  }, []);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

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
    }, ANALYSIS_STEP_MS * 4);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (coverRef.current) URL.revokeObjectURL(coverRef.current);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragOver(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      acceptRef.current(event.dataTransfer.files);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  function rememberCover(url: string | null) {
    if (coverRef.current) URL.revokeObjectURL(coverRef.current);
    coverRef.current = url;
  }

  function acceptFiles(list: FileList | File[]) {
    const files = [...list];
    if (files.length === 0) return;
    const file = files[0];
    const extra = files.length > 1;
    if (track) {
      setPrompt({ kind: 'replace', file, extra });
      return;
    }
    void ingest(file, extra);
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

    if (file.size > maxFileBytes()) {
      setImportError(tooLargeMessage(file.size));
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'size' });
      return;
    }

    let buffer: ArrayBuffer;
    try {
      buffer = await withTimeout(
        file.arrayBuffer(),
        ANALYSIS_STEP_MS,
        'Opening this file took too long and was stopped.',
      );
    } catch (error) {
      if (id !== loadId.current) return;
      setImportError(readErrorMessage(error));
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'read' });
      return;
    }
    if (id !== loadId.current) return;

    const rejected = rejectionMessage(file.name, new Uint8Array(buffer));
    if (rejected) {
      setImportError(rejected);
      setPhase('idle');
      trackEvent('processing_failed', { stage: 'type' });
      return;
    }

    let parsed;
    try {
      parsed = await withTimeout(
        readTrack(buffer),
        ANALYSIS_STEP_MS,
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
    try {
      const hits = await searchArtwork({
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
      const loaded = await loadArtwork(hit.imageUrl);
      if (id !== loadId.current || artworkLock.current) return;
      const fitted = await fitArtwork(loaded.bytes, loaded.mime);
      const seen = trackRef.current;
      if (id !== loadId.current || artworkLock.current || !seen || seen.coverUrl || seen.coverChanged || seen.hadCover) {
        return;
      }
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
          coverChanged: !bytesEqual(current.embeddedCover, bytes),
        };
      });
    } catch (caught) {
      if (id !== loadId.current || artworkLock.current) return;
      setArtworkNote(caught instanceof Error ? caught.message : 'Artwork search failed. You can upload an image instead.');
    } finally {
      if (id === loadId.current) setArtworkBusy(false);
    }
  }

  useEffect(() => {
    acceptRef.current = acceptFiles;
    ingestRef.current = (file, extra) => {
      void ingest(file, extra);
    };
  });

  useEffect(() => {
    let cancel = false;
    const next = peekPending();
    if (!next) return undefined;
    queueMicrotask(() => {
      if (cancel) return;
      clearPending();
      ingestRef.current(next.file, next.extra);
    });
    return () => {
      cancel = true;
    };
  }, []);

  async function analyse(id: number, buffer: ArrayBuffer) {
    let audio: AudioBuffer;
    try {
      audio = await decodeAudio(buffer);
    } catch (error) {
      if (id !== loadId.current) return;
      audioRef.current = null;
      const reason =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'The browser could not decode this MP3.';
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
    const peaks = waveformPeaks(audio);
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

    const bpmWork = detectBpm(audio)
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
          current
            ? { ...current, analysis: { ...current.analysis, bpmPending: false, bpmError: message } }
            : current,
        );
      });

    const keyWork = detectKey(audio)
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
          current
            ? { ...current, analysis: { ...current.analysis, keyPending: false, keyError: message } }
            : current,
        );
      });

    await Promise.all([bpmWork, keyWork]);
    if (id !== loadId.current) return;
    setPhase((current) => (current === 'processing' ? 'edit' : current));
  }

  async function rerunBpm() {
    const audio = audioRef.current;
    if (!audio || !track) {
      setTrack((current) =>
        current
          ? {
              ...current,
              analysis: {
                ...current.analysis,
                bpmError: current.waveformError ?? 'The audio is not ready to measure yet.',
              },
            }
          : current,
      );
      return;
    }
    const id = loadId.current;
    setTrack((current) =>
      current ? { ...current, analysis: { ...current.analysis, bpmPending: true, bpmError: null } } : current,
    );
    try {
      const result = await detectBpm(audio);
      if (id !== loadId.current) return;
      setTrack((current) =>
        current
          ? {
              ...current,
              fields: { ...current.fields, bpm: result.bpm },
              analysis: {
                ...current.analysis,
                bpmPending: false,
                bpm: { value: result.bpm, detail: result.detail },
                bpmError: null,
              },
            }
          : current,
      );
    } catch (error) {
      if (id !== loadId.current) return;
      const message = error instanceof Error ? error.message : 'Tempo could not be detected from this audio.';
      setTrack((current) =>
        current ? { ...current, analysis: { ...current.analysis, bpmPending: false, bpmError: message } } : current,
      );
    }
  }

  async function rerunKey() {
    const audio = audioRef.current;
    if (!audio || !track) {
      setTrack((current) =>
        current
          ? {
              ...current,
              analysis: {
                ...current.analysis,
                keyError: current.waveformError ?? 'The audio is not ready to measure yet.',
              },
            }
          : current,
      );
      return;
    }
    const id = loadId.current;
    setTrack((current) =>
      current ? { ...current, analysis: { ...current.analysis, keyPending: true, keyError: null } } : current,
    );
    try {
      const result = await detectKey(audio);
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
      setTrack((current) =>
        current ? { ...current, analysis: { ...current.analysis, keyPending: false, keyError: message } } : current,
      );
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
    setPhase('idle');
    setPrompt(null);
    setExportNote(null);
    setExtraNote(null);
    setImportError(null);
    setArtworkBusy(false);
    setArtworkNote(null);
    artworkLock.current = false;
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
            coverChanged: !bytesEqual(current.embeddedCover, bytes),
          }
        : current,
    );
    setExportNote(null);
    setExportError(false);
  }

  function removeArtwork() {
    rememberCover(null);
    setArtworkNote(null);
    setTrack((current) =>
      current
        ? {
            ...current,
            coverUrl: null,
            coverBytes: null,
            coverMime: null,
            coverFrom: null,
            coverChanged: current.hadCover,
          }
        : current,
    );
    setExportNote(null);
    setExportError(false);
  }

  function onDownload() {
    if (!track || !preview?.file) return;
    setExporting(true);
    setExportError(false);
    try {
      const result = writeTrack(track.buffer, {
        fields: track.fields,
        original: track.fileFields,
        remixFrame: track.remixFrame,
        fallback: track.fallback,
        artwork: !track.coverChanged
          ? 'keep'
          : track.coverBytes && track.coverMime
            ? { data: track.coverBytes, mime: track.coverMime }
            : 'remove',
      });
      const copy = new ArrayBuffer(result.bytes.byteLength);
      new Uint8Array(copy).set(result.bytes);
      const url = URL.createObjectURL(new Blob([copy], { type: 'audio/mpeg' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = preview.file;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      const extra = result.notice ? ` ${result.notice}` : '';
      setExportNote(`Downloaded ${preview.file}.${extra}`.trim());
      trackEvent('file_downloaded');
    } catch {
      setExportError(true);
      setExportNote('The file could not be prepared. Your original file was not changed.');
      trackEvent('processing_failed', { stage: 'export' });
    } finally {
      setExporting(false);
    }
  }

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
    ? [
        'MP3',
        formatBytes(track.size),
        formatBitrate(track.technical.bitrate),
        formatSampleRate(track.technical.sampleRate),
        formatChannels(track.technical.channels),
        formatDuration(track.technical.duration),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const exportNotice = track
    ? noticeWithArtwork(
        track.plan.notice,
        Boolean(track.coverChanged && track.coverBytes),
        Boolean(track.coverChanged && !track.coverBytes),
      )
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

  return (
    <div className={dragOver ? 'tool drag-active' : 'tool'}>
      <SiteHead title={TOOL_TITLE} description={TOOL_DESCRIPTION} path="/app" />
      <Atmosphere />
      <a className="skip" href="#content">
        Skip to content
      </a>
      {phase !== 'idle' ? (
      <header className="appbar">
        <Link to="/" className="logo-link" aria-label="TrackTidy, home">
          <Logo />
        </Link>
        <p className="appbar-kicker">Single track</p>
        <div className="appbar-actions">
          {track ? (
            <Button variant="secondary" onClick={() => setPrompt({ kind: 'close' })}>
              Close
            </Button>
          ) : null}
          <Button variant="primary" disabled={!track || !preview?.file || exporting} onClick={onDownload}>
            {exporting ? 'Preparing…' : 'Download'}
          </Button>
        </div>
      </header>
      ) : null}

      {exportNote ? (
        exportError ? (
          <ErrorBanner title="Could not prepare the file" testId="export-status" className="page-error">
            {exportNote}
          </ErrorBanner>
        ) : (
          <p className="status-strip" role="status" data-testid="export-status">
            {exportNote}
          </p>
        )
      ) : null}

      {phase === 'edit' && analysisProblem ? (
        <ErrorBanner title="Could not finish analysis" testId="analysis-error" className="page-error">
          {analysisProblem}
        </ErrorBanner>
      ) : null}

      {prompt ? (
        <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
          <p id="confirm-title">
            {prompt.kind === 'close'
              ? 'Close this track? Edits that are not downloaded will be lost.'
              : 'Replace this track? Edits that are not downloaded will be lost.'}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => setPrompt(null)}>
            Keep current
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (prompt.kind === 'close') closeTrack();
              else void ingest(prompt.file, prompt.extra);
            }}
          >
            {prompt.kind === 'close' ? 'Close' : 'Replace'}
          </button>
        </div>
      ) : null}

      <main id="content" className="workspace">
        {phase === 'idle' ? (
          <UploadOverlay
            error={importError}
            onClose={() => navigate('/')}
            onFile={(file, extra) => {
              void ingest(file, extra);
            }}
          />
        ) : null}

        {phase === 'processing' ? (
          <AnalysisScreen
            name={track?.name ?? 'Checking the file'}
            peaks={track?.peaks ?? null}
            scanning={scanning || !track}
            stages={stages}
            onEdit={track?.peaks ? () => setPhase('edit') : undefined}
            onStop={stopAnalysis}
          />
        ) : null}

        {phase === 'edit' && track && preview ? (
          <section className="studio stage-in">
            <ResultCompare name={track.name} fileFields={track.fileFields} fields={track.fields} preview={preview} />
            <div className="file-col">
              <div className="file-heading">
                <div>
                  <p className="kicker">File</p>
                  <p className="tech-line">{tech}</p>
                </div>
              </div>
              <ArtworkPanel
                previewUrl={track.coverUrl}
                source={track.coverFrom}
                artist={track.fields.artist}
                title={track.fields.title}
                album={track.fields.album}
                remix={track.fields.remix}
                busy={artworkBusy}
                note={artworkNote}
                onApply={applyArtwork}
                onRemove={removeArtwork}
                onInteract={() => {
                  artworkLock.current = true;
                  setArtworkNote(null);
                }}
              />
              {track.peaks ? (
                <Waveform peaks={track.peaks} scanning={scanning} label={`Waveform of ${track.name}`} />
              ) : track.waveformError ? (
                <p className="hint hint-danger">{track.waveformError}</p>
              ) : null}
              {extraNote ? <p className="hint">{extraNote}</p> : null}
              {exportNotice ? <p className="hint">{exportNotice}</p> : null}
              {keptOnExport.length > 0 ? <p className="hint">Also kept on export: {keptOnExport.join(', ')}.</p> : null}
              <p className="hint">The audio stays in this browser and is not uploaded.</p>
            </div>
            <div className="edit-col">
              <MetadataEditor
                fields={track.fields}
                fileFields={track.fileFields}
                bpm={track.analysis.bpm}
                keyEstimate={track.analysis.key}
                bpmError={track.analysis.bpmError}
                keyError={track.analysis.keyError}
                bpmPending={track.analysis.bpmPending}
                keyPending={track.analysis.keyPending}
                template={template}
                preview={preview}
                onField={updateField}
                onTemplate={updateTemplate}
                onDetectBpm={() => void rerunBpm()}
                onEstimateKey={() => void rerunKey()}
              />
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function ResultCompare({
  name,
  fileFields,
  fields,
  preview,
}: {
  name: string;
  fileFields: TrackFields;
  fields: TrackFields;
  preview: FilenamePreview;
}) {
  const originalMeta = originalMetaLine(fileFields);
  const updates = updatedMeta(fields, fileFields);
  return (
    <div className="result-band">
      <div className="original-block">
        <p className="kicker">Original</p>
        <p className="original-file">{name}</p>
        {originalMeta ? <p className="original-meta">{originalMeta}</p> : null}
      </div>
      <div className="nameplate nameplate-result" data-testid="filename-preview" aria-live="polite">
        <p className="kicker kicker-blue">Cleaned result</p>
        <h1>{preview.file || 'The name is empty. Add a field that has a value.'}</h1>
        {updates.length > 0 ? (
          <ul className="result-changes">
            {updates.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                {item.value}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

