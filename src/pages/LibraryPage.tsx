import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button.tsx';
import { CrateLibrary } from '../components/CrateLibrary.tsx';
import { GenreSelector } from '../components/GenreSelector.tsx';
import { TokenPills } from '../components/LibraryArray.tsx';
import { Logo } from '../components/Logo.tsx';
import { ProAccount } from '../components/ProAccount.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { usePro } from '../components/pro-context.ts';
import { decodeLibraryAudio, detectBpm, detectKey, frequencyBands, readWaveAudio, withTimeout } from '../lib/audio.ts';
import { applyTextCleanup } from '../lib/crate.ts';
import { onCrateFiles, takeCrateFiles } from '../lib/crate-files.ts';
import { zipTracks } from '../lib/crate-zip.ts';
import { writeTrack } from '../lib/id3.ts';
import {
  autoCleanFields,
  FREE_LIBRARY_LIMIT,
  LIBRARY_LIMIT,
  libraryFieldsDiffer,
  libraryRoom,
  trackMatchesFilter,
  visibleLibraryStatus,
  WAVE_BARS,
  type LibraryFilter,
  type LibraryTrack,
} from '../lib/library-clean.ts';
import { DEMO_LIBRARY, LIBRARY_DESCRIPTION, LIBRARY_PATH, LIBRARY_TITLE } from '../lib/library-demo.ts';
import { filesFromDrop } from '../lib/library-files.ts';
import {
  DEFAULT_LIBRARY_TOKENS,
  libraryPatternLabel,
  moveToken,
  renderLibraryFilename,
  toggleToken,
  type LibraryToken,
} from '../lib/library-name.ts';
import { takeEditorFields } from '../lib/library-link.ts';
import { loadCrate, packCrate, saveCrate, unpackCrate } from '../lib/library-store.ts';
import { useWorkspace } from '../context/WorkspaceContext.tsx';
import { readTrack } from '../lib/metadata.ts';
import { maxFileBytes, rejectionMessage } from '../lib/mp3.ts';
import { PRO_COPY } from '../lib/pro.ts';
import { TrackSessionContext } from '../session/session-context.ts';
import '../styles/library.css';
import { EMPTY_FIELDS, type TrackFields } from '../lib/types.ts';

type CrateKind = 'demo' | 'files' | 'empty';

function cloneTrack(row: LibraryTrack): LibraryTrack {
  return {
    ...row,
    fields: { ...row.fields },
    cleaned: { ...row.cleaned },
    original: { ...row.original },
    bands: row.bands ? row.bands.map((band) => ({ ...band })) : null,
  };
}

function failedTrack(sourceName: string, id: string): LibraryTrack {
  const empty = { ...EMPTY_FIELDS };
  return {
    id,
    sourceName,
    fields: empty,
    original: { ...empty },
    cleaned: { ...empty },
    buffer: null,
    bands: null,
    analysing: false,
    coverUrl: null,
    skeleton: false,
    scanning: false,
    failed: true,
    enterDelay: 0,
    remixFrame: 'TIT3',
    fallback: null,
  };
}

function blankTrack(sourceName: string, delay: number): LibraryTrack {
  const empty = { ...EMPTY_FIELDS };
  return {
    id: crypto.randomUUID(),
    sourceName,
    fields: empty,
    original: { ...empty },
    cleaned: { ...empty },
    buffer: null,
    bands: null,
    analysing: true,
    coverUrl: null,
    skeleton: true,
    scanning: false,
    failed: false,
    enterDelay: delay,
    remixFrame: 'TIT3',
    fallback: null,
  };
}

async function readLibraryFile(file: File): Promise<LibraryTrack | string> {
  if (file.size > maxFileBytes()) return `${file.name} is over 100 MB, so it was not added.`;
  try {
    const buffer = await file.arrayBuffer();
    const rejected = rejectionMessage(file.name, new Uint8Array(buffer));
    if (rejected) return 'skip';
    const parsed = await readTrack(buffer, { filename: file.name });
    const original = { ...parsed.fields };
    const cleaned = autoCleanFields(original);
    cleaned.genre = parsed.fields.genre;
    const overlay = takeEditorFields(file.name);
    const fields = overlay ? { ...cleaned, ...overlay } : cleaned;
    return {
      id: crypto.randomUUID(),
      sourceName: file.name,
      fields,
      original,
      cleaned,
      buffer,
      bands: null,
      analysing: true,
      coverUrl: parsed.coverUrl,
      skeleton: false,
      scanning: false,
      failed: false,
      enterDelay: 0,
      remixFrame: parsed.remixFrame,
      fallback: parsed.fallback,
    };
  } catch {
    return `${file.name} could not be read.`;
  }
}

export default function LibraryPage() {
  const pro = usePro();
  const session = useContext(TrackSessionContext);
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const rows = workspace.libraryRows;
  const kind = workspace.kind;
  const tokens = workspace.tokens;
  const undoCount = workspace.history.length;
  const redoCount = workspace.future.length;
  const [loadId, setLoadId] = useState(0);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [note, setNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genreDraft, setGenreDraft] = useState('');
  const [bpmDraft, setBpmDraft] = useState('');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const dragDepth = useRef(0);
  const run = useRef(0);
  const rowsRef = useRef<LibraryTrack[]>(rows);
  const tokensRef = useRef(tokens);
  const kindRef = useRef(kind);
  const proRef = useRef(pro.pro);
  const hydratedRef = useRef(false);
  const modalRef = useRef(pro.modalOpen);
  const selectedRef = useRef(selected);
  const openUpgradeRef = useRef(pro.openUpgrade);
  const workspaceRef = useRef(workspace);
  const fileRef = useRef<HTMLInputElement>(null);
  const failedWaves = useRef(new Set<string>());
  const stops = useRef(new Set<string>());
  const deleteTimer = useRef<number | null>(null);
  const demoGen = useRef(0);
  const addFilesRef = useRef<(files: File[]) => Promise<void>>(async () => undefined);
  const enrichRef = useRef<(tracks: LibraryTrack[], alive?: () => boolean) => Promise<void>>(async () => undefined);
  const undoRef = useRef<() => void>(() => undefined);
  const redoRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!confirmClear) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setConfirmClear(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmClear]);

  useEffect(() => {
    workspaceRef.current = workspace;
    rowsRef.current = rows;
    tokensRef.current = tokens;
    kindRef.current = kind;
    proRef.current = pro.pro;
    hydratedRef.current = hydrated;
    modalRef.current = pro.modalOpen;
    selectedRef.current = selected;
    openUpgradeRef.current = pro.openUpgrade;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (modalRef.current) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redoRef.current();
      else undoRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
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
      if (!event.dataTransfer?.files?.length && !event.dataTransfer?.items?.length) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      const transfer = event.dataTransfer;
      if (!transfer) return;
      void filesFromDrop(transfer).then((files) => {
        if (files.length > 0) void addFilesRef.current(files);
      });
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

  useEffect(() => {
    const current = workspaceRef.current;
    current.setViewMode('crate');
    let cancelled = false;
    void (async () => {
      if (current.hasHydrated()) {
        if (!cancelled) setHydrated(true);
        return;
      }
      let stored: Awaited<ReturnType<typeof loadCrate>> = null;
      try {
        stored = await loadCrate();
      } catch {
        stored = null;
      }
      if (cancelled) return;
      if (stored && stored.rows) {
        const unpacked = unpackCrate(stored);
        const nextTokens = unpacked.tokens.length > 0 ? unpacked.tokens : DEFAULT_LIBRARY_TOKENS;
        const view = current.finishHydrate({ kind: unpacked.kind, tokens: nextTokens, rows: unpacked.rows });
        rowsRef.current = view.rows;
        tokensRef.current = view.tokens;
        kindRef.current = view.kind;
      } else {
        const view = current.finishHydrate(null);
        rowsRef.current = view.rows;
        tokensRef.current = view.tokens;
        kindRef.current = view.kind;
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setRows(action: LibraryTrack[] | ((current: LibraryTrack[]) => LibraryTrack[])) {
    const current = rowsRef.current;
    const next = typeof action === 'function' ? action(current) : action;
    rowsRef.current = workspace.replaceRows(next);
  }

  function setKind(next: CrateKind) {
    kindRef.current = next;
    workspace.setKind(next);
  }

  function remember() {
    workspace.pushHistory();
  }

  function undo() {
    const restored = workspace.undo();
    if (!restored) return;
    rowsRef.current = restored.rows;
    tokensRef.current = restored.tokens;
    kindRef.current = restored.kind;
    setSelected(new Set());
    const missing = restored.rows.filter((row) => row.buffer && !row.bands && !row.failed);
    if (missing.length > 0) void paintBands(missing);
  }

  function redo() {
    const restored = workspace.redo();
    if (!restored) return;
    rowsRef.current = restored.rows;
    tokensRef.current = restored.tokens;
    kindRef.current = restored.kind;
    setSelected(new Set());
    const missing = restored.rows.filter((row) => row.buffer && !row.bands && !row.failed);
    if (missing.length > 0) void paintBands(missing);
  }

  async function paintBands(tracks: LibraryTrack[]) {
    for (const track of tracks) {
      if (!track.buffer) continue;
      const audio = await readWaveAudio(track.buffer);
      if (!audio) {
        setRows((current) => {
          const next = current.map((row) =>
            row.id === track.id ? { ...row, analysing: false, scanning: false, failed: true } : row,
          );
          rowsRef.current = next;
          return next;
        });
        continue;
      }
      const bands = frequencyBands(audio, WAVE_BARS);
      setRows((current) => {
        const next = current.map((row) => (row.id === track.id && !row.bands ? { ...row, bands, analysing: false } : row));
        rowsRef.current = next;
        return next;
      });
    }
  }

  async function enrich(tracks: LibraryTrack[], alive: () => boolean = () => true) {
    for (const track of tracks) {
      if (!alive() || !track.buffer || failedWaves.current.has(track.id) || stops.current.has(track.id)) continue;
      const holder = rowsRef.current.find((row) => row.id === track.id);
      const coverKeptOff = workspace.trackById(track.id)?.coverRemoved ?? false;
      if (holder && !holder.coverUrl && !coverKeptOff) {
        try {
          const parsed = await readTrack(track.buffer, { filename: track.sourceName });
          if (parsed.coverUrl) {
            setRows((current) => {
              const next = current.map((row) => (row.id === track.id && !row.coverUrl ? { ...row, coverUrl: parsed.coverUrl } : row));
              rowsRef.current = next;
              return next;
            });
          }
        } catch {
          /* The row can stay without a thumbnail. */
        }
      }
      if (!alive()) return;
      const audio = await readWaveAudio(track.buffer);
      if (!alive()) return;
      if (!audio || stops.current.has(track.id)) {
        failedWaves.current.add(track.id);
        setRows((current) => {
          const next = current.map((row) =>
            row.id === track.id ? { ...row, analysing: false, scanning: false, skeleton: false, failed: true } : row,
          );
          rowsRef.current = next;
          return next;
        });
        continue;
      }
      const bands = frequencyBands(audio, WAVE_BARS);
      let bpm = '';
      let key = '';
      const latest = rowsRef.current.find((row) => row.id === track.id);
      if (latest && !latest.fields.bpm.trim()) {
        try {
          bpm = (await detectBpm(audio, 12000)).bpm;
        } catch {
          bpm = '';
        }
      }
      if (!alive()) return;
      if (latest && !latest.fields.key.trim()) {
        try {
          key = (await detectKey(audio, 12000)).camelot;
        } catch {
          key = '';
        }
      }
      if (!alive()) return;
      setRows((current) => {
        const next = current.map((row) => {
          if (row.id !== track.id) return row;
          const fields = { ...row.fields };
          const cleaned = { ...row.cleaned };
          if (!fields.bpm.trim() && bpm) {
            fields.bpm = bpm;
            cleaned.bpm = bpm;
          }
          if (!fields.key.trim() && key) {
            fields.key = key;
            cleaned.key = key;
          }
          if (stops.current.has(track.id)) return { ...row, analysing: false, scanning: false, skeleton: false, failed: true };
          return {
            ...row,
            buffer: row.buffer ?? track.buffer,
            coverUrl: row.coverUrl ?? track.coverUrl,
            fields,
            cleaned,
            bands,
            analysing: false,
            scanning: false,
            failed: false,
          };
        });
        rowsRef.current = next;
        return next;
      });
    }
  }

  async function askUpgrade(message: string) {
    if (hydratedRef.current) {
      try {
        await saveCrate(packCrate(kindRef.current, tokensRef.current, rowsRef.current));
      } catch {
        /* The playlist stays in this tab if storage is busy. */
      }
    }
    openUpgradeRef.current(message);
  }

  function publishRows(next: LibraryTrack[]) {
    rowsRef.current = next;
    setRows(next);
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    const id = ++run.current;
    const proNow = proRef.current;
    const replacing = kindRef.current !== 'files';
    let shown = replacing ? [] : rowsRef.current.map(cloneTrack);
    const cap = proNow ? LIBRARY_LIMIT : FREE_LIBRARY_LIMIT;
    const readyCount = () => shown.filter((row) => !row.skeleton).length;
    if (!replacing && libraryRoom(shown.length, proNow) <= 0) {
      if (proNow) setNote(`The crate holds ${LIBRARY_LIMIT} MP3s in this tab.`);
      else void askUpgrade(PRO_COPY.libraryLimit);
      return;
    }
    const queue = [...files];
    const notes: string[] = [];
    let skipped = 0;
    let hitCap = false;
    let remembered = false;
    let added = 0;
    setReading(true);
    setNote(null);
    setFilter('all');

    const ensureRemembered = () => {
      if (remembered) return;
      remember();
      workspace.markDirty();
      remembered = true;
      if (replacing) {
        shown = [];
        kindRef.current = 'files';
        setKind('files');
        setSelected(new Set());
      }
    };

    while (queue.length > 0) {
      const room = cap - readyCount();
      if (room <= 0) {
        hitCap = true;
        break;
      }
      const batch = queue.splice(0, room);
      ensureRemembered();
      const slots = batch.map((file, index) => blankTrack(file.name, index * 30));
      shown = [...shown, ...slots];
      publishRows(shown);
      for (let index = 0; index < slots.length; index += 1) {
        const slot = slots[index];
        const file = batch[index];
        shown = shown.map((row) => ({ ...row, scanning: row.id === slot.id }));
        publishRows(shown);
        let result: LibraryTrack | string;
        try {
          result = await withTimeout(readLibraryFile(file), 20000, `${file.name} took too long to read.`);
        } catch (error) {
          result = error instanceof Error ? error.message : `${file.name} could not be read.`;
        }
        if (run.current !== id) {
          setReading(false);
          return;
        }
        if (stops.current.has(slot.id)) {
          const stopped = typeof result === 'string'
            ? failedTrack(file.name, slot.id)
            : {
                ...result,
                id: slot.id,
                skeleton: false,
                scanning: false,
                analysing: false,
                failed: true,
                enterDelay: slot.enterDelay,
              };
          if (typeof result === 'string') {
            if (result !== 'skip') notes.push(result);
          } else added += 1;
          shown = shown.map((row) => (row.id === slot.id ? stopped : row));
          publishRows(shown);
          continue;
        }
        if (result === 'skip' || typeof result === 'string') {
          if (result === 'skip') skipped += 1;
          else notes.push(result);
          shown = result === 'skip'
            ? shown.filter((row) => row.id !== slot.id)
            : shown.map((row) => (row.id === slot.id ? failedTrack(file.name, slot.id) : row));
          publishRows(shown);
          continue;
        }
        const live: LibraryTrack = {
          ...result,
          id: slot.id,
          skeleton: false,
          scanning: true,
          analysing: true,
          enterDelay: slot.enterDelay,
        };
        shown = shown.map((row) => (row.id === slot.id ? live : { ...row, scanning: false }));
        publishRows(shown);
        await enrich([live], () => run.current === id);
        if (run.current !== id) {
          setReading(false);
          return;
        }
        shown = rowsRef.current.map((row) => ({ ...row, scanning: false, skeleton: row.id === slot.id ? false : row.skeleton }));
        publishRows(shown);
        added += 1;
      }
    }
    if (queue.length > 0) hitCap = true;
    if (skipped > 0) {
      notes.push(`${skipped} ${skipped === 1 ? 'file was not an MP3' : 'files were not MP3s'}, so ${skipped === 1 ? 'it was' : 'they were'} not added.`);
    }
    setReading(false);
    if (run.current !== id) return;
    if (shown.length === 0) {
      kindRef.current = 'empty';
      setKind('empty');
    }
    if (hitCap && proNow) notes.push(`The crate holds ${LIBRARY_LIMIT} MP3s in this tab. The rest were not added.`);
    if (added === 0 && !hitCap) setNote(notes[0] ?? 'No MP3s were added.');
    else if (notes.length > 0) setNote(notes.join(' '));
    else setNote(null);
    if (hitCap && !proNow) void askUpgrade(PRO_COPY.libraryLimit);
  }

  useEffect(() => {
    addFilesRef.current = addFiles;
    enrichRef.current = enrich;
    undoRef.current = undo;
    redoRef.current = redo;
  });

  useEffect(() => {
    if (!hydrated) return undefined;
    const queued = takeCrateFiles();
    if (queued.length > 0) void addFilesRef.current(queued);
    const stop = onCrateFiles(() => {
      const next = takeCrateFiles();
      if (next.length > 0) void addFilesRef.current(next);
    });
    return () => stop();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || kind !== 'demo') return undefined;
    const id = ++demoGen.current;
    let cancelled = false;
    const alive = () => !cancelled && demoGen.current === id;
    void (async () => {
      const loaded = new Map<string, Pick<LibraryTrack, 'buffer' | 'remixFrame' | 'fallback' | 'coverUrl'>>();
      await Promise.all(
        DEMO_LIBRARY.map(async (track) => {
          try {
            const response = await fetch(track.href);
            if (!response.ok) return;
            const buffer = await response.arrayBuffer();
            const parsed = await readTrack(buffer, { filename: track.sourceName });
            loaded.set(track.id, {
              buffer,
              remixFrame: parsed.remixFrame,
              fallback: parsed.fallback,
              coverUrl: parsed.coverUrl,
            });
          } catch {
            /* The row stays visible. The waveform waits for bytes. */
          }
        }),
      );
      if (!alive()) return;
      if (loaded.size === 0) {
        setNote(PRO_COPY.libraryUnread);
        return;
      }
      const merged = rowsRef.current.map((row) => {
        const next = loaded.get(row.id);
        if (!next || row.buffer) return row;
        return { ...row, ...next, analysing: true };
      });
      publishRows(merged);
      await enrich(merged.filter((row) => row.buffer), alive);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, kind, loadId]);

  useEffect(() => {
    if (!hydrated || kind === 'demo') return undefined;
    const pending = rowsRef.current.filter((row) => row.buffer && !row.bands && !row.failed && !failedWaves.current.has(row.id));
    if (pending.length === 0) return undefined;
    void enrichRef.current(pending);
    return undefined;
  }, [hydrated, kind]);

  useEffect(() => {
    const retryWaves = () => {
      const pending = rowsRef.current.filter((row) => row.buffer && !row.bands && failedWaves.current.has(row.id));
      if (pending.length === 0) return;
      void (async () => {
        for (const track of pending) {
          if (!track.buffer) continue;
          failedWaves.current.delete(track.id);
          const decoded = await decodeLibraryAudio(track.buffer);
          if (!decoded.audio) {
            failedWaves.current.add(track.id);
            continue;
          }
          const bands = frequencyBands(decoded.audio, WAVE_BARS);
          setRows((current) => current.map((row) => (row.id === track.id ? { ...row, bands, analysing: false } : row)));
        }
      })();
    };
    window.addEventListener('pointerdown', retryWaves);
    return () => window.removeEventListener('pointerdown', retryWaves);
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = window.setTimeout(() => {
      void saveCrate(packCrate(kindRef.current, tokensRef.current, rowsRef.current)).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, kind, tokens, rows]);

  useEffect(() => {
    return () => {
      if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
    };
  }, []);

  function patch(id: string, key: keyof TrackFields, value: string) {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row || row.fields[key] === value) return;
    const view = workspace.updateTrack(id, { [key]: value });
    if (view) rowsRef.current = view;
  }

  function commitTokens(next: LibraryToken[]) {
    workspace.setTokens(next, true);
    tokensRef.current = next;
  }

  function removeRow(id: string) {
    remember();
    const next = rowsRef.current.filter((row) => row.id !== id);
    rowsRef.current = next;
    setRows(next);
    setSelected((current) => {
      if (!current.has(id)) return current;
      const copy = new Set(current);
      copy.delete(id);
      return copy;
    });
    if (next.length === 0) {
      kindRef.current = 'empty';
      setKind('empty');
    }
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const copy = new Set(current);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  function toggleAll() {
    const visible = rows.filter((row) => trackMatchesFilter(visibleLibraryStatus(row), filter));
    const ids = visible.map((row) => row.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((current) => {
      const copy = new Set(current);
      if (allOn) ids.forEach((id) => copy.delete(id));
      else ids.forEach((id) => copy.add(id));
      return copy;
    });
  }

  function mapSelected(update: (row: LibraryTrack) => LibraryTrack) {
    const ids = selectedRef.current;
    if (ids.size === 0) return;
    const edits: { id: string; patch: Partial<TrackFields> }[] = [];
    for (const row of rowsRef.current) {
      if (!ids.has(row.id)) continue;
      const updated = update(row);
      if (JSON.stringify(updated.fields) === JSON.stringify(row.fields)) continue;
      edits.push({ id: row.id, patch: updated.fields });
    }
    const view = workspace.updateTracks(edits);
    if (view) rowsRef.current = view;
  }

  function applyGenre(value: string) {
    const ids = selectedRef.current;
    const useAll = ids.size === 0;
    const edits = rowsRef.current
      .filter((row) => !row.skeleton && (useAll || ids.has(row.id)) && row.fields.genre !== value)
      .map((row) => ({ id: row.id, patch: { genre: value } }));
    const view = workspace.updateTracks(edits);
    if (view) rowsRef.current = view;
  }

  function resetRow(id: string) {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row || row.skeleton || !libraryFieldsDiffer(row.fields, row.cleaned)) return;
    const view = workspace.updateTrack(id, { ...row.cleaned });
    if (view) rowsRef.current = view;
  }

  async function editRow(id: string) {
    const row = rowsRef.current.find((item) => item.id === id);
    if (!row || row.skeleton) return;
    if (!row.buffer) {
      setNote(row.failed ? PRO_COPY.libraryFailed : 'This track is still loading.');
      return;
    }
    try {
      await saveCrate(packCrate(kindRef.current, tokensRef.current, rowsRef.current));
    } catch {
      /* The editor still opens with the copy held in this tab. */
    }
    workspace.openTrack(row.id);
    session?.openLibraryTrack({
      id: row.id,
      sourceName: row.sourceName,
      buffer: row.buffer,
      fields: { ...row.fields },
      original: { ...row.original },
      remixFrame: row.remixFrame,
      fallback: row.fallback,
    });
    navigate('/app');
  }

  function applyBpm() {
    const value = bpmDraft;
    mapSelected((row) => ({ ...row, fields: { ...row.fields, bpm: value } }));
  }

  function armDelete() {
    if (deleteArmed) {
      if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
      setDeleteArmed(false);
      const ids = selectedRef.current;
      if (ids.size === 0) return;
      remember();
      const next = rowsRef.current.filter((row) => !ids.has(row.id));
      rowsRef.current = next;
      setRows(next);
      setSelected(new Set());
      if (next.length === 0) {
        kindRef.current = 'empty';
        setKind('empty');
      }
      return;
    }
    setDeleteArmed(true);
    deleteTimer.current = window.setTimeout(() => setDeleteArmed(false), 3000);
  }

  function loadDemo() {
    const next = workspace.loadDemo();
    kindRef.current = 'demo';
    rowsRef.current = next;
    setFilter('all');
    setSelected(new Set());
    setNote(null);
    setLoadId((value) => value + 1);
  }

  function stopRow(id: string) {
    stops.current.add(id);
    const next = rowsRef.current.map((row) =>
      row.id === id ? { ...row, skeleton: false, scanning: false, analysing: false, failed: true } : row,
    );
    publishRows(next);
    if (!next.some((row) => row.skeleton || row.scanning || row.analysing)) setReading(false);
  }

  function clearCrate() {
    if (rowsRef.current.length === 0 && kindRef.current === 'empty') return;
    setConfirmClear(true);
  }

  function commitClear() {
    setConfirmClear(false);
    if (rowsRef.current.length === 0 && kindRef.current === 'empty') return;
    remember();
    kindRef.current = 'empty';
    rowsRef.current = [];
    setKind('empty');
    setRows([]);
    setSelected(new Set());
    setNote(null);
    void saveCrate(packCrate('empty', tokensRef.current, [])).catch(() => undefined);
  }

  async function downloadZip() {
    if (rows.length === 0) return;
    if (!pro.pro) {
      void askUpgrade(PRO_COPY.libraryExport);
      return;
    }
    const files: { name: string; bytes: Uint8Array }[] = [];
    let skipped = 0;
    for (const row of rows) {
      const name = renderLibraryFilename(tokens, row.fields);
      if (!name || !row.buffer) {
        skipped += 1;
        continue;
      }
      const written = writeTrack(row.buffer, {
        fields: row.fields,
        original: row.original,
        remixFrame: row.remixFrame,
        fallback: row.fallback,
        artwork: 'keep',
      });
      files.push({ name, bytes: written.bytes });
    }
    if (files.length === 0) {
      setNote(skipped > 0 ? PRO_COPY.libraryLoading : 'Add a filename token before downloading.');
      return;
    }
    setZipping(true);
    try {
      const zipped = zipTracks(files);
      const copy = new ArrayBuffer(zipped.byteLength);
      new Uint8Array(copy).set(zipped);
      const url = URL.createObjectURL(new Blob([copy], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tracktidy-library.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNote(skipped > 0 ? 'Some tracks were still loading, so they were left out of the ZIP.' : null);
    } finally {
      setZipping(false);
    }
  }

  const visible = rows.filter((row) => trackMatchesFilter(visibleLibraryStatus(row), filter));
  const counts = {
    all: rows.length,
    cleaned: rows.filter((row) => visibleLibraryStatus(row) === 'cleaned').length,
    review: rows.filter((row) => trackMatchesFilter(visibleLibraryStatus(row), 'review')).length,
  };
  const showTools = rows.length > 0 || undoCount > 0;
  const selectedCount = selected.size;

  return (
    <div className={dragOver ? 'tool lib-page drag-active' : 'tool lib-page'}>
      <SiteHead title={LIBRARY_TITLE} description={LIBRARY_DESCRIPTION} path={LIBRARY_PATH} index={false} />
      {dragOver ? (
        <div className="lib-drop-overlay" role="status">
          <p>{PRO_COPY.libraryRelease}</p>
        </div>
      ) : null}
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="appbar">
        <Link to="/" className="logo-link" aria-label="TrackTidy, home">
          <Logo />
        </Link>
        <p className="appbar-kicker">Crate</p>
        <div className="appbar-actions">
          <ProAccount />
          <Button
            variant="primary"
            title={pro.pro ? PRO_COPY.active : PRO_COPY.freePreviewTip}
            disabled={rows.length === 0 || reading || zipping}
            onClick={() => void downloadZip()}
          >
            {zipping ? 'Preparing…' : PRO_COPY.libraryDownload}
          </Button>
        </div>
      </header>
      <main id="content" className="workspace">
        <section className="lib" aria-label="Crate">
          <div className="lib-intro">
            <p className="kicker kicker-blue" title={pro.pro ? PRO_COPY.active : PRO_COPY.freePreviewTip}>
              {pro.pro ? PRO_COPY.active : PRO_COPY.freePreview}
            </p>
            <h1>{PRO_COPY.libraryTitle}</h1>
            <p className="lede">{PRO_COPY.libraryBody}</p>
          </div>
          {showTools ? (
            <div className="lib-tools">
              <div className="lib-toolbar">
                <div className="lib-filters" role="tablist" aria-label="Filter tracks">
                  {(
                    [
                      ['all', PRO_COPY.libraryAll, counts.all],
                      ['cleaned', PRO_COPY.libraryCleaned, counts.cleaned],
                      ['review', PRO_COPY.libraryReview, counts.review],
                    ] as const
                  ).map(([id, label, count]) => (
                    <button key={id} type="button" className="lib-filter" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                      {label}
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
                <div className="lib-history">
                  <button type="button" className="lib-history-btn" aria-label={PRO_COPY.libraryUndo} disabled={undoCount === 0} onClick={undo}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6.2 4.1 3.2 7.1l3 3" />
                      <path d="M3.6 7.1h6.2a3.1 3.1 0 0 1 0 6.2H8" />
                    </svg>
                  </button>
                  <button type="button" className="lib-history-btn" aria-label={PRO_COPY.libraryRedo} disabled={redoCount === 0} onClick={redo}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M9.8 4.1 12.8 7.1l-3 3" />
                      <path d="M12.4 7.1H6.2a3.1 3.1 0 0 0 0 6.2H8" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="lib-pattern-row">
                <span>{PRO_COPY.libraryPattern}</span>
                <TokenPills
                  tokens={tokens}
                  onToggle={(id) => commitTokens(toggleToken(tokensRef.current, id))}
                  onMove={(from, to) => {
                    if (from === to) return;
                    commitTokens(moveToken(tokensRef.current, from, to));
                  }}
                />
                <p className="lib-pattern">{libraryPatternLabel(tokens)}</p>
                <GenreSelector
                  value={genreDraft}
                  variant="bulk"
                  label={PRO_COPY.librarySetGenre}
                  onChange={(value) => {
                    setGenreDraft(value);
                    applyGenre(value);
                  }}
                />
              </div>
            </div>
          ) : null}
          {rows.length === 0 ? (
            <div
              className={dragOver ? 'drop-well drop-hot' : 'drop-well'}
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                fileRef.current?.click();
              }}
            >
              <p className="drop-title">{dragOver ? PRO_COPY.libraryRelease : PRO_COPY.libraryDrop}</p>
              <p className="drop-copy">{PRO_COPY.libraryBrowse}</p>
            </div>
          ) : null}
          {kind === 'demo' && rows.length > 0 ? <p className="pro-note">{PRO_COPY.libraryDemoNote}</p> : null}
          {reading ? <p className="pro-note">Cleaning tracks.</p> : null}
          {rows.length > 0 ? (
            <CrateLibrary
              rows={visible}
              selected={selected}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              onField={patch}
              onRemove={removeRow}
              onReset={resetRow}
              onEdit={(id) => void editRow(id)}
              onStop={stopRow}
              selectedCount={selectedCount}
              genreDraft={genreDraft}
              bpmDraft={bpmDraft}
              deleteArmed={deleteArmed}
              onGenre={(value) => {
                setGenreDraft(value);
                applyGenre(value);
              }}
              onBpmDraft={setBpmDraft}
              onApplyBpm={applyBpm}
              onClean={() => mapSelected((row) => ({ ...row, fields: applyTextCleanup(row.fields, 'strip') }))}
              onCase={() => mapSelected((row) => ({ ...row, fields: applyTextCleanup(row.fields, 'case') }))}
              onDelete={armDelete}
            />
          ) : null}
          <div className="lib-foot">
            <label className="btn btn-secondary crate-add">
              {reading ? 'Reading…' : PRO_COPY.libraryAdd}
              <input
                ref={fileRef}
                type="file"
                accept=".mp3,audio/mpeg"
                multiple
                disabled={reading}
                onChange={(event) => {
                  const list = event.target.files;
                  if (!list || list.length === 0) return;
                  const files = [...list];
                  event.target.value = '';
                  void addFiles(files);
                }}
              />
            </label>
            <label className="btn btn-secondary crate-add">
              {PRO_COPY.libraryFolder}
              <input
                type="file"
                multiple
                disabled={reading}
                ref={(node) => {
                  node?.setAttribute('webkitdirectory', '');
                  node?.setAttribute('directory', '');
                }}
                onChange={(event) => {
                  const list = event.target.files;
                  if (!list || list.length === 0) return;
                  const files = [...list];
                  event.target.value = '';
                  void addFiles(files);
                }}
              />
            </label>
            <button className="btn btn-secondary" type="button" onClick={loadDemo}>
              {PRO_COPY.libraryLoad}
            </button>
            <button className="btn btn-quiet" type="button" onClick={clearCrate}>
              {PRO_COPY.libraryClear}
            </button>
          </div>
          {note ? <p className="pro-note">{note}</p> : null}
          <p className="hint">{PRO_COPY.libraryStay}</p>
        </section>
      </main>
      {confirmClear ? (
        <div className="pro-layer" role="presentation" onMouseDown={() => setConfirmClear(false)}>
          <div
            className="pro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-crate-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="clear-crate-title">Clear crate</h2>
            <p>Remove all tracks from your crate? This cannot be undone.</p>
            <div className="lib-confirm-actions">
              <button className="btn btn-quiet" type="button" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button className="btn btn-primary lib-danger-btn" type="button" onClick={commitClear}>
                Remove tracks
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SiteFooter />
    </div>
  );
}
