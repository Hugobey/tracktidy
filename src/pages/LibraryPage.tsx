import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { Button } from '../components/Button.tsx';
import { Logo } from '../components/Logo.tsx';
import { ProAccount } from '../components/ProAccount.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { usePro } from '../components/pro-context.ts';
import { applyTextCleanup, CRATE_LIMIT } from '../lib/crate.ts';
import { DEFAULT_TEMPLATE, FILENAME_PRESETS, renderFilename } from '../lib/filename.ts';
import { writeTrack } from '../lib/id3.ts';
import { DEMO_LIBRARY, LIBRARY_DESCRIPTION, LIBRARY_PATH, LIBRARY_TITLE } from '../lib/library-demo.ts';
import { readTrack } from '../lib/metadata.ts';
import { maxFileBytes, rejectionMessage } from '../lib/mp3.ts';
import { PRO_COPY } from '../lib/pro.ts';
import type { FallbackPayload, TrackFields } from '../lib/types.ts';
import { zipTracks } from '../lib/crate-zip.ts';

type Row = {
  id: string;
  sourceName: string;
  fields: TrackFields;
  original: TrackFields;
  buffer: ArrayBuffer | null;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
};

const COLUMNS = [
  ['artist', 'Artist'],
  ['title', 'Title'],
  ['bpm', 'BPM'],
  ['key', 'Key'],
  ['genre', 'Genre'],
] as const;

function seedRows(): Row[] {
  return DEMO_LIBRARY.map((track) => ({
    id: track.id,
    sourceName: track.sourceName,
    fields: { ...track.fields },
    original: { ...track.fields },
    buffer: null,
    remixFrame: 'TIT3',
    fallback: null,
  }));
}

function trackCount(count: number): string {
  return count === 1 ? '1 track' : `${count} tracks`;
}

async function rowsFromFiles(files: File[], room: number): Promise<{ rows: Row[]; notes: string[] }> {
  const notes: string[] = [];
  const accepted = files.slice(0, Math.max(0, room));
  if (files.length > accepted.length) {
    notes.push(`The library holds ${CRATE_LIMIT} MP3s in this tab. The rest were not added.`);
  }
  const rows: Row[] = [];
  for (const file of accepted) {
    if (file.size > maxFileBytes()) {
      notes.push(`${file.name} is over 100 MB, so it was not added.`);
      continue;
    }
    try {
      const buffer = await file.arrayBuffer();
      const rejected = rejectionMessage(file.name, new Uint8Array(buffer));
      if (rejected) {
        notes.push(rejected);
        continue;
      }
      const parsed = await readTrack(buffer);
      if (parsed.coverUrl) URL.revokeObjectURL(parsed.coverUrl);
      rows.push({
        id: crypto.randomUUID(),
        sourceName: file.name,
        fields: { ...parsed.fields },
        original: { ...parsed.fields },
        buffer,
        remixFrame: parsed.remixFrame,
        fallback: parsed.fallback,
      });
    } catch {
      notes.push(`${file.name} could not be read.`);
    }
  }
  return { rows, notes };
}

export default function LibraryPage() {
  const pro = usePro();
  const [rows, setRows] = useState<Row[]>(seedRows);
  const [kind, setKind] = useState<'demo' | 'files' | 'empty'>('demo');
  const [loadId, setLoadId] = useState(0);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [genreAll, setGenreAll] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const acceptRef = useRef<(files: File[]) => void>(() => undefined);
  const proRef = useRef(pro.pro);
  const openUpgradeRef = useRef(pro.openUpgrade);

  useEffect(() => {
    if (kind !== 'demo') return undefined;
    let cancelled = false;
    void (async () => {
      const loaded = new Map<string, Pick<Row, 'buffer' | 'remixFrame' | 'fallback'>>();
      await Promise.all(
        DEMO_LIBRARY.map(async (track) => {
          try {
            const response = await fetch(track.href);
            if (!response.ok) return;
            const buffer = await response.arrayBuffer();
            const parsed = await readTrack(buffer);
            if (parsed.coverUrl) URL.revokeObjectURL(parsed.coverUrl);
            loaded.set(track.id, { buffer, remixFrame: parsed.remixFrame, fallback: parsed.fallback });
          } catch {
            /* The row stays visible. Download waits for bytes. */
          }
        }),
      );
      if (cancelled) return;
      if (loaded.size === 0) {
        setNote(PRO_COPY.libraryUnread);
        return;
      }
      setRows((current) =>
        current.map((row) => {
          const next = loaded.get(row.id);
          if (!next || row.buffer) return row;
          return { ...row, ...next };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, loadId]);

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
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      if (!proRef.current) {
        openUpgradeRef.current();
        return;
      }
      acceptRef.current([...event.dataTransfer.files]);
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

  async function addFiles(files: File[]) {
    if (!pro.pro) {
      pro.openUpgrade();
      return;
    }
    const base = kind === 'files' ? rows : [];
    const room = CRATE_LIMIT - base.length;
    if (room <= 0) {
      setNote(`The library holds ${CRATE_LIMIT} MP3s in this tab.`);
      return;
    }
    setReading(true);
    setNote(null);
    try {
      const result = await rowsFromFiles(files, room);
      if (result.rows.length === 0) {
        setNote(result.notes[0] ?? 'No MP3s were added.');
        return;
      }
      setKind('files');
      setRows([...base, ...result.rows]);
      setNote(result.notes.length > 0 ? result.notes.join(' ') : null);
    } finally {
      setReading(false);
    }
  }
  useEffect(() => {
    acceptRef.current = (files) => {
      void addFiles(files);
    };
    proRef.current = pro.pro;
    openUpgradeRef.current = pro.openUpgrade;
  });

  function patch(id: string, key: keyof TrackFields, value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, fields: { ...row.fields, [key]: value } } : row)));
  }

  function cleanup(mode: 'strip' | 'case') {
    if (!pro.pro) {
      pro.openUpgrade();
      return;
    }
    setRows((current) => current.map((row) => ({ ...row, fields: applyTextCleanup(row.fields, mode) })));
  }

  function applyGenre() {
    if (!pro.pro) {
      pro.openUpgrade();
      return;
    }
    setRows((current) => current.map((row) => ({ ...row, fields: { ...row.fields, genre: genreAll } })));
  }

  function loadDemo() {
    setKind('demo');
    setRows(seedRows());
    setLoadId((value) => value + 1);
    setNote(null);
  }

  async function downloadZip() {
    if (!pro.pro) {
      pro.openUpgrade();
      return;
    }
    const files: { name: string; bytes: Uint8Array }[] = [];
    let skipped = 0;
    for (const row of rows) {
      const name = renderFilename(template, row.fields).file;
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

  const lead = rows[0];
  const leadName = lead ? renderFilename(template, lead.fields).file : '';
  const locked = !pro.pro;

  return (
    <div className={dragOver ? 'tool drag-active' : 'tool'}>
      <SiteHead title={LIBRARY_TITLE} description={LIBRARY_DESCRIPTION} path={LIBRARY_PATH} index={false} />
      <Atmosphere />
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="appbar">
        <Link to="/" className="logo-link" aria-label="TrackTidy, home">
          <Logo />
        </Link>
        <p className="appbar-kicker">Library</p>
        <div className="appbar-actions">
          <ProAccount />
          <Button variant="primary" disabled={pro.pro && (rows.length === 0 || reading || zipping)} onClick={() => void downloadZip()}>
            {zipping ? 'Preparing…' : PRO_COPY.downloadZip}
          </Button>
        </div>
      </header>
      <main id="content" className="workspace">
        <section className="library" aria-label="Library">
          <div className="library-intro">
            <p className="kicker kicker-blue">TrackTidy Pro</p>
            <h1>{PRO_COPY.libraryTitle}</h1>
            <p className="lede">{PRO_COPY.libraryBody}</p>
          </div>
          <div className="nameplate nameplate-result" data-testid="library-preview">
            <p className="kicker kicker-blue">Cleaned result</p>
            <p className="library-lead">{leadName || PRO_COPY.libraryEmpty}</p>
            <p>
              {rows.length > 0 ? `${trackCount(rows.length)} share this filename template.` : 'Add MP3s and the new names show up here.'}
            </p>
          </div>
          {rows.length === 0 ? (
            <div className={dragOver ? 'drop-well drop-hot' : 'drop-well'}>
              <p className="drop-title">{dragOver ? 'Release to add them' : PRO_COPY.libraryDrop}</p>
              <p className="drop-copy">{PRO_COPY.libraryBrowse}</p>
            </div>
          ) : null}
          <div className="library-panel">
            <div className="crate-tools">
              <label className="crate-bulk">
                <span>Template</span>
                <input
                  aria-label="Filename template"
                  value={template}
                  spellCheck={false}
                  disabled={locked}
                  onChange={(event) => setTemplate(event.target.value)}
                />
              </label>
              <div className="presets" aria-label="Filename presets">
                {FILENAME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={template === preset.template ? 'preset preset-active' : 'preset'}
                    disabled={locked}
                    onClick={() => setTemplate(preset.template)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="crate-pills">
                <button className="crate-pill" type="button" onClick={() => cleanup('strip')}>
                  {PRO_COPY.strip}
                </button>
                <button className="crate-pill" type="button" onClick={() => cleanup('case')}>
                  {PRO_COPY.titleCase}
                </button>
              </div>
              <label className="crate-bulk">
                <span>Genre for all</span>
                <input
                  aria-label="Genre for all tracks"
                  value={genreAll}
                  disabled={locked}
                  placeholder="House"
                  onChange={(event) => setGenreAll(event.target.value)}
                />
                <button className="btn btn-secondary" type="button" onClick={applyGenre}>
                  Apply
                </button>
              </label>
            </div>
            {locked ? <p className="pro-note">{PRO_COPY.libraryLocked}</p> : null}
            {kind === 'demo' && rows.length > 0 ? <p className="pro-note">{PRO_COPY.libraryDemoNote}</p> : null}
            {rows.length > 0 ? (
              <div className="crate-scroll">
                <table className="crate-grid">
                  <thead>
                    <tr>
                      <th>Filename preview</th>
                      {COLUMNS.map(([, label]) => (
                        <th key={label}>{label}</th>
                      ))}
                      <th>
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const preview = renderFilename(template, row.fields).file || 'Filename needs a token';
                      return (
                        <tr key={row.id}>
                          <td>
                            <span className="crate-file">{preview}</span>
                            <span className="crate-source">{row.sourceName}</span>
                          </td>
                          {COLUMNS.map(([key]) => (
                            <td key={key}>
                              <input
                                aria-label={`${key} for ${row.sourceName}`}
                                value={row.fields[key]}
                                disabled={locked}
                                onChange={(event) => patch(row.id, key, event.target.value)}
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              className="btn btn-quiet"
                              type="button"
                              onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="crate-foot">
              {pro.pro ? (
                <label className="btn btn-secondary crate-add">
                  {reading ? 'Reading…' : PRO_COPY.libraryAdd}
                  <input
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
              ) : (
                <button className="btn btn-secondary" type="button" onClick={pro.openUpgrade}>
                  {PRO_COPY.libraryAdd}
                </button>
              )}
              {pro.pro ? (
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
              ) : (
                <button className="btn btn-secondary" type="button" onClick={pro.openUpgrade}>
                  {PRO_COPY.libraryFolder}
                </button>
              )}
              <button className="btn btn-secondary" type="button" onClick={loadDemo}>
                {PRO_COPY.libraryLoad}
              </button>
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => {
                  setKind('empty');
                  setRows([]);
                  setNote(null);
                }}
              >
                {PRO_COPY.libraryClear}
              </button>
            </div>
            {note ? <p className="pro-note">{note}</p> : null}
            <p className="hint">{PRO_COPY.libraryStay}</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
