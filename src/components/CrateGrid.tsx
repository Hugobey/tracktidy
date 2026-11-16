import { useCallback, useEffect, useRef, useState } from 'react';
import { applyTextCleanup, CRATE_LIMIT, crateTemplate, fieldChanged, tokensFromTemplate, type CrateToken } from '../lib/crate.ts';
import { onCrateFiles, takeCrateFiles } from '../lib/crate-files.ts';
import { zipTracks } from '../lib/crate-zip.ts';
import { renderFilename } from '../lib/filename.ts';
import { writeTrack, type ArtworkWrite } from '../lib/id3.ts';
import { readTrack } from '../lib/metadata.ts';
import { maxFileBytes, rejectionMessage } from '../lib/mp3.ts';
import { PRO_COPY } from '../lib/pro.ts';
import type { FallbackPayload, TrackFields } from '../lib/types.ts';
import { usePro } from './pro-context.ts';

export type CrateLead = {
  name: string;
  buffer: ArrayBuffer;
  original: TrackFields;
  fields: TrackFields;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
  artwork: 'keep' | 'remove' | ArtworkWrite;
};

type ExtraRow = {
  id: string;
  sourceName: string;
  buffer: ArrayBuffer;
  original: TrackFields;
  fields: TrackFields;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
};

type Props = {
  lead: CrateLead;
  template: string;
  onLeadField: (key: keyof TrackFields, value: string) => void;
  onTemplate: (value: string) => void;
};

const COLUMNS = [
  ['title', 'Title'],
  ['artist', 'Artist'],
  ['bpm', 'BPM'],
  ['key', 'Key'],
  ['genre', 'Genre'],
] as const;

const TOKEN_LABEL: Record<CrateToken, string> = {
  artist: 'Artist',
  title: 'Title',
  bpm: 'BPM',
  key: 'Key',
};

async function rowsFromFiles(files: File[], room: number, report: (message: string) => void): Promise<ExtraRow[]> {
  const accepted = files.slice(0, Math.max(0, room));
  if (files.length > accepted.length) {
    report(`The crate holds ${CRATE_LIMIT} extra MP3s in this tab. The rest were not added.`);
  }
  const next: ExtraRow[] = [];
  for (const file of accepted) {
    if (file.size > maxFileBytes()) {
      report(`${file.name} is over 100 MB, so it was not added.`);
      continue;
    }
    try {
      const buffer = await file.arrayBuffer();
      const rejected = rejectionMessage(file.name, new Uint8Array(buffer));
      if (rejected) {
        report(rejected);
        continue;
      }
      const parsed = await readTrack(buffer);
      if (parsed.coverUrl) URL.revokeObjectURL(parsed.coverUrl);
      next.push({
        id: crypto.randomUUID(),
        sourceName: file.name,
        buffer,
        original: parsed.fields,
        fields: { ...parsed.fields },
        remixFrame: parsed.remixFrame,
        fallback: parsed.fallback,
      });
    } catch {
      report(`${file.name} could not be read.`);
    }
  }
  return next;
}

export function CrateGrid({ lead, template, onLeadField, onTemplate }: Props) {
  const pro = usePro();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [bulkField, setBulkField] = useState<'genre' | 'album'>('genre');
  const [bulkValue, setBulkValue] = useState('');
  const [zipping, setZipping] = useState(false);
  const countRef = useRef(0);
  const addRef = useRef<(files: File[]) => Promise<void>>(async () => undefined);
  const tokens = tokensFromTemplate(template);

  const commitRows = useCallback((update: (current: ExtraRow[]) => ExtraRow[]) => {
    setRows((current) => {
      const next = update(current).slice(0, CRATE_LIMIT);
      countRef.current = next.length;
      return next;
    });
  }, []);
  const unlocked = pro.pro;

  useEffect(() => {
    let cancelled = false;
    async function addFiles(files: File[]) {
      if (!unlocked || cancelled || files.length === 0) return;
      const next = await rowsFromFiles(files, CRATE_LIMIT - countRef.current, setNote);
      if (cancelled || next.length === 0) return;
      commitRows((current) => [...current, ...next]);
      setOpen(true);
    }
    addRef.current = addFiles;
    void addFiles(takeCrateFiles());
    const stop = onCrateFiles(() => {
      void addFiles(takeCrateFiles());
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [commitRows, unlocked]);

  function toggleToken(token: CrateToken) {
    onTemplate(crateTemplate({ ...tokens, [token]: !tokens[token] }));
  }

  function applyBulk() {
    onLeadField(bulkField, bulkValue);
    commitRows((current) => current.map((row) => ({ ...row, fields: { ...row.fields, [bulkField]: bulkValue } })));
  }

  function cleanup(mode: 'strip' | 'case') {
    const nextLead = applyTextCleanup(lead.fields, mode);
    for (const key of ['artist', 'title', 'album', 'genre'] as const) onLeadField(key, nextLead[key]);
    commitRows((current) => current.map((row) => ({ ...row, fields: applyTextCleanup(row.fields, mode) })));
  }

  async function downloadZip() {
    const files: { name: string; bytes: Uint8Array }[] = [];
    const leadName = renderFilename(template, lead.fields).file;
    if (leadName) {
      const written = writeTrack(lead.buffer, {
        fields: lead.fields,
        original: lead.original,
        remixFrame: lead.remixFrame,
        fallback: lead.fallback,
        artwork: lead.artwork,
      });
      files.push({ name: leadName, bytes: written.bytes });
    }
    for (const row of rows) {
      const name = renderFilename(template, row.fields).file;
      if (!name) continue;
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
      setNote('Add a filename token before downloading.');
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
      link.download = 'tracktidy-crate.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setZipping(false);
    }
  }

  return (
    <section className="crate-band" aria-label="Crate view">
      <div className="crate-bar">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            if (!unlocked) {
              pro.openUpgrade();
              return;
            }
            setOpen((value) => !value);
          }}
        >
          {open && unlocked ? PRO_COPY.hideCrate : PRO_COPY.crate}
        </button>
        <p>Edit tags across the open track and any extra MP3s, then download one ZIP.</p>
      </div>
      {open && unlocked ? (
        <div className="crate-panel">
          <div className="crate-tools">
            <label className="crate-bulk">
              <span>Set for all tracks</span>
              <select value={bulkField} onChange={(event) => setBulkField(event.target.value as 'genre' | 'album')}>
                <option value="genre">Genre</option>
                <option value="album">Album</option>
              </select>
              <input
                value={bulkValue}
                placeholder={bulkField === 'genre' ? 'House' : 'Album name'}
                onChange={(event) => setBulkValue(event.target.value)}
              />
              <button className="btn btn-secondary" type="button" onClick={applyBulk}>
                Apply
              </button>
            </label>
            <div className="crate-pills">
              <button className="crate-pill" type="button" onClick={() => cleanup('strip')}>
                {PRO_COPY.strip}
              </button>
              <button className="crate-pill" type="button" onClick={() => cleanup('case')}>
                {PRO_COPY.titleCase}
              </button>
            </div>
            <div className="crate-pills" aria-label="Filename tokens">
              {(['artist', 'title', 'bpm', 'key'] as const).map((token) => (
                <button
                  key={token}
                  className="crate-pill"
                  type="button"
                  aria-pressed={tokens[token]}
                  onClick={() => toggleToken(token)}
                >
                  {TOKEN_LABEL[token]}
                </button>
              ))}
            </div>
          </div>
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
                <CrateRowView
                  sourceName={lead.name}
                  preview={renderFilename(template, lead.fields).file || 'Filename needs a token'}
                  fields={lead.fields}
                  original={lead.original}
                  template={template}
                  onField={onLeadField}
                />
                {rows.map((row) => (
                  <CrateRowView
                    key={row.id}
                    sourceName={row.sourceName}
                    preview={renderFilename(template, row.fields).file || 'Filename needs a token'}
                    fields={row.fields}
                    original={row.original}
                    template={template}
                    onField={(key, value) =>
                      commitRows((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, fields: { ...item.fields, [key]: value } } : item,
                        ),
                      )
                    }
                    onRemove={() => commitRows((current) => current.filter((item) => item.id !== row.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="crate-foot">
            <label className="btn btn-secondary crate-add">
              Add MP3s
              <input
                type="file"
                accept=".mp3,audio/mpeg"
                multiple
                onChange={(event) => {
                  const list = event.target.files;
                  if (!list || list.length === 0) return;
                  const files = [...list];
                  event.target.value = '';
                  void addRef.current(files);
                }}
              />
            </label>
            <button className="btn btn-primary" type="button" disabled={zipping} onClick={() => void downloadZip()}>
              {zipping ? 'Preparing…' : PRO_COPY.downloadZip}
            </button>
          </div>
          {note ? <p className="pro-note">{note}</p> : null}
          <p className="hint">Files stay in this browser. Nothing is uploaded.</p>
        </div>
      ) : null}
    </section>
  );
}

function CrateRowView({
  sourceName,
  preview,
  fields,
  original,
  template,
  onField,
  onRemove,
}: {
  sourceName: string;
  preview: string;
  fields: TrackFields;
  original: TrackFields;
  template: string;
  onField: (key: keyof TrackFields, value: string) => void;
  onRemove?: () => void;
}) {
  const nameChanged = preview !== (renderFilename(template, original).file || 'Filename needs a token');
  return (
    <tr>
      <td className={nameChanged ? 'crate-dirty' : undefined}>
        <span className="crate-file">{preview}</span>
        <span className="crate-source">{sourceName}</span>
      </td>
      {COLUMNS.map(([key]) => (
        <td key={key} className={fieldChanged(fields, original, key) ? 'crate-dirty' : undefined}>
          <input aria-label={`${key} for ${sourceName}`} value={fields[key]} onChange={(event) => onField(key, event.target.value)} />
        </td>
      ))}
      <td>
        {onRemove ? (
          <button className="btn btn-quiet" type="button" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </td>
    </tr>
  );
}
