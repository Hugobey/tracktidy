import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GenreSelector } from './GenreSelector.tsx';
import { libraryFieldsDiffer, visibleLibraryStatus, type LibraryMark, type LibraryTrack, type WaveBand } from '../lib/library-clean.ts';
import { LIBRARY_TOKEN_LABEL, renderLibraryFilename, type LibraryToken, type LibraryTokenId } from '../lib/library-name.ts';
import { PRO_COPY } from '../lib/pro.ts';
import type { TrackFields } from '../lib/types.ts';

const MARK_LABEL: Record<LibraryMark, string> = {
  cleaned: PRO_COPY.libraryCleaned,
  review: PRO_COPY.libraryReview,
  edited: PRO_COPY.libraryEdited,
  pending: PRO_COPY.libraryChecking,
};

const WAVE_W = 148;
const WAVE_H = 28;

function StatusMark({ status, analysing, failed }: { status: LibraryMark; analysing: boolean; failed?: boolean }) {
  if (failed) {
    return (
      <span className="lib-mark lib-mark-failed" role="img" aria-label={PRO_COPY.libraryFailed} title={PRO_COPY.libraryFailed}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (analysing) {
    return (
      <span className="lib-mark lib-mark-pending" role="img" aria-label={PRO_COPY.libraryChecking} title={PRO_COPY.libraryChecking}>
        <svg className="lib-spin" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="20 12" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`lib-mark lib-mark-${status} lib-mark-pop`} role="img" aria-label={MARK_LABEL[status]} title={MARK_LABEL[status]}>
      {status === 'cleaned' ? (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8.4 6.4 11.3 12.5 4.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="lib-dot" />
      )}
    </span>
  );
}

function TextCell({
  value,
  empty,
  label,
  className,
  onSave,
}: {
  value: string;
  empty: string;
  label: string;
  className: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const skip = useRef(false);
  if (!editing) {
    return (
      <button
        type="button"
        className={value.trim() ? `lib-cell ${className}` : `lib-cell lib-cell-empty ${className}`}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value.trim() || empty}
      </button>
    );
  }
  return (
    <input
      className="lib-edit"
      aria-label={label}
      value={draft}
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (skip.current) {
          skip.current = false;
          setEditing(false);
          return;
        }
        onSave(draft);
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          skip.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function SelectBox({
  checked,
  partial,
  label,
  onChange,
}: {
  checked: boolean;
  partial?: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(partial) && !checked;
  }, [checked, partial]);
  return <input ref={ref} className="lib-check" type="checkbox" aria-label={label} checked={checked} onChange={onChange} />;
}

function FrequencyWave({ bands }: { bands: WaveBand[] | null }) {
  const ready = Boolean(bands && bands.length > 0);
  const bars = bands && bands.length > 0 ? bands : Array.from({ length: 48 }, () => ({ low: 0.08, mid: 0.05, high: 0.03 }));
  const gap = 1.15;
  const barWidth = (WAVE_W - gap * (bars.length - 1)) / bars.length;
  return (
    <span className={ready ? 'lib-wave' : 'lib-wave lib-wave-wait'} aria-hidden="true">
      <svg viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} width={WAVE_W} height={WAVE_H}>
        {bars.map((band, index) => {
          const sum = band.low + band.mid + band.high;
          const total = Math.max(2, (ready ? sum : 0.22) * (WAVE_H - 2));
          const share = sum > 0 ? sum : 1;
          const lowH = (band.low / share) * total;
          const midH = (band.mid / share) * total;
          const highH = (band.high / share) * total;
          const x = index * (barWidth + gap);
          const y = (WAVE_H - total) / 2;
          return (
            <g key={index}>
              <rect className="lib-wave-low" x={x} y={y} width={barWidth} height={Math.max(lowH, 0.8)} rx="0.5" />
              <rect className="lib-wave-mid" x={x} y={y + lowH} width={barWidth} height={Math.max(midH, 0.6)} rx="0.5" />
              <rect className="lib-wave-high" x={x} y={y + lowH + midH} width={barWidth} height={Math.max(highH, 0.5)} rx="0.5" />
            </g>
          );
        })}
      </svg>
    </span>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function CoverThumb({ url }: { url: string | null }) {
  if (url) return <img className="lib-cover" src={url} alt="" width={36} height={36} />;
  return (
    <span className="lib-cover lib-cover-empty" aria-hidden="true">
      <Icon>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.2" />
        <path d="M12 4.2v2.2" />
      </Icon>
    </span>
  );
}

function RemoveControl({ onRemove }: { onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);
  if (!confirming) {
    return (
      <button
        className="lib-action"
        type="button"
        aria-label="Remove track"
        onClick={() => {
          setConfirming(true);
          timer.current = window.setTimeout(() => setConfirming(false), 3000);
        }}
      >
        <Icon>
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </Icon>
      </button>
    );
  }
  return (
    <button
      className="lib-action lib-action-confirm"
      type="button"
      onClick={() => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        onRemove();
      }}
    >
      {PRO_COPY.libraryConfirm}
    </button>
  );
}

function rowClass(row: LibraryTrack): string {
  const names = ['lib-row', row.skeleton ? 'lib-row-skeleton lib-row-enter' : 'lib-row-live'];
  if (row.failed) names.push('lib-row-failed');
  if (row.scanning) names.push('lib-row-scan');
  return names.join(' ');
}

function StopControl({ onStop }: { onStop: () => void }) {
  return (
    <button className="lib-action lib-action-stop" type="button" aria-label={PRO_COPY.libraryStop} onClick={onStop}>
      <Icon>
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
      </Icon>
    </button>
  );
}

function SkeletonRow({
  row,
  selected,
  onToggleRow,
  onStop,
}: {
  row: LibraryTrack;
  selected: boolean;
  onToggleRow: () => void;
  onStop: () => void;
}) {
  return (
    <div
      className={rowClass(row)}
      role="row"
      data-track={row.id}
      data-scanning={row.scanning ? 'true' : 'false'}
      style={{ animationDelay: `${row.enterDelay}ms` }}
    >
      <span role="cell">
        <SelectBox checked={selected} label={`Select ${row.sourceName}`} onChange={onToggleRow} />
      </span>
      <span role="cell" className="lib-status">
        <StatusMark status="pending" analysing failed={row.failed} />
        {row.scanning ? <span className="sr-only">{`Reading ${row.sourceName}`}</span> : null}
      </span>
      <span role="cell" className="lib-track">
        <span className="lib-skel lib-skel-cover" />
        <span className="lib-skel lib-skel-title" />
        <span className="lib-skel lib-skel-artist" />
        <span className="lib-source">{row.sourceName}</span>
      </span>
      <span role="cell">
        <span className="lib-skel lib-skel-wave" />
      </span>
      <span role="cell">
        <span className="lib-skel lib-skel-chip" />
      </span>
      <span role="cell">
        <span className="lib-skel lib-skel-chip" />
      </span>
      <span role="cell">
        <span className="lib-skel lib-skel-chip lib-skel-wide" />
      </span>
      <span role="cell">
        <span className="lib-skel lib-skel-file" />
        <span className="lib-skel lib-skel-file lib-skel-file-short" />
      </span>
      <span role="cell" className="lib-actions">
        <StopControl onStop={onStop} />
      </span>
    </div>
  );
}

export function TokenPills({
  tokens,
  onToggle,
  onMove,
}: {
  tokens: LibraryToken[];
  onToggle: (id: LibraryTokenId) => void;
  onMove: (from: LibraryTokenId, to: LibraryTokenId) => void;
}) {
  const dragId = useRef<LibraryTokenId | null>(null);
  const dragged = useRef(false);
  return (
    <div className="crate-pills" aria-label="Filename tokens">
      {tokens.map((token) => (
        <button
          key={token.id}
          type="button"
          className="crate-pill"
          draggable
          aria-pressed={token.on}
          onClick={() => {
            if (dragged.current) {
              dragged.current = false;
              return;
            }
            onToggle(token.id);
          }}
          onDragStart={() => {
            dragged.current = true;
            dragId.current = token.id;
          }}
          onDragEnd={() => {
            window.setTimeout(() => {
              dragged.current = false;
            }, 0);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            const from = dragId.current;
            dragId.current = null;
            if (from) onMove(from, token.id);
          }}
        >
          {LIBRARY_TOKEN_LABEL[token.id]}
        </button>
      ))}
    </div>
  );
}

export function LibraryArray({
  rows,
  tokens,
  selected,
  onToggleRow,
  onToggleAll,
  onField,
  onRemove,
  onReset,
  onEdit,
  onStop,
}: {
  rows: LibraryTrack[];
  tokens: LibraryToken[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onField: (id: string, key: keyof TrackFields, value: string) => void;
  onRemove: (id: string) => void;
  onReset: (id: string) => void;
  onEdit: (id: string) => void;
  onStop: (id: string) => void;
}) {
  const ids = rows.map((row) => row.id);
  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));
  const partial = ids.some((id) => selected.has(id));
  if (rows.length === 0) return <p className="lib-empty">{PRO_COPY.libraryFilterEmpty}</p>;
  return (
    <div className="lib-scroll">
      <div className="lib-table" role="table" aria-label="Crate">
        <div className="lib-head" role="row">
          <span role="columnheader">
            <SelectBox checked={allChecked} partial={partial} label={PRO_COPY.librarySelect} onChange={onToggleAll} />
          </span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Track</span>
          <span role="columnheader">{PRO_COPY.libraryWave}</span>
          <span role="columnheader">BPM</span>
          <span role="columnheader">Key</span>
          <span role="columnheader">Genre</span>
          <span role="columnheader">{PRO_COPY.libraryOutput}</span>
          <span role="columnheader">
            <span className="sr-only">Actions</span>
          </span>
        </div>
        {rows.map((row) => {
          if (row.skeleton) {
            return (
              <SkeletonRow
                key={row.id}
                row={row}
                selected={selected.has(row.id)}
                onToggleRow={() => onToggleRow(row.id)}
                onStop={() => onStop(row.id)}
              />
            );
          }
          const status = visibleLibraryStatus(row);
          const output = renderLibraryFilename(tokens, row.fields) || 'Filename needs a token';
          const dirty = libraryFieldsDiffer(row.fields, row.cleaned);
          return (
            <div
              className={rowClass(row)}
              role="row"
              key={row.id}
              data-track={row.id}
              data-scanning={row.scanning ? 'true' : 'false'}
              data-failed={row.failed ? 'true' : 'false'}
              title={row.failed ? PRO_COPY.libraryFailed : undefined}
            >
              <span role="cell" className="lib-morph">
                <SelectBox checked={selected.has(row.id)} label={`Select ${row.fields.title || row.sourceName}`} onChange={() => onToggleRow(row.id)} />
              </span>
              <span role="cell" className="lib-status">
                <StatusMark
                  key={row.failed ? 'failed' : row.analysing ? 'busy' : status}
                  status={status}
                  analysing={row.analysing}
                  failed={row.failed}
                />
                {row.scanning ? <span className="sr-only">{`Reading ${row.sourceName}`}</span> : null}
              </span>
              <span role="cell" className="lib-track lib-morph">
                <CoverThumb url={row.coverUrl} />
                <TextCell
                  value={row.fields.title}
                  empty="Add title"
                  label={`Title for ${row.sourceName}`}
                  className="lib-title"
                  onSave={(value) => onField(row.id, 'title', value)}
                />
                <TextCell
                  value={row.fields.artist}
                  empty="Add artist"
                  label={`Artist for ${row.sourceName}`}
                  className="lib-artist"
                  onSave={(value) => onField(row.id, 'artist', value)}
                />
                <span className="lib-source">{row.sourceName}</span>
              </span>
              <span role="cell" className="lib-morph">
                <FrequencyWave bands={row.bands} />
              </span>
              <span role="cell" className="lib-morph">
                <TextCell
                  value={row.fields.bpm}
                  empty="Add"
                  label={`BPM for ${row.sourceName}`}
                  className="lib-bpm"
                  onSave={(value) => onField(row.id, 'bpm', value)}
                />
              </span>
              <span role="cell" className="lib-morph">
                <TextCell
                  value={row.fields.key}
                  empty="Add"
                  label={`Key for ${row.sourceName}`}
                  className="lib-key"
                  onSave={(value) => onField(row.id, 'key', value)}
                />
              </span>
              <span role="cell" className="lib-genre-cell lib-morph">
                <GenreSelector
                  value={row.fields.genre}
                  label={`Genre for ${row.sourceName}`}
                  variant="cell"
                  emptyLabel={PRO_COPY.libraryAddGenre}
                  onChange={(value) => onField(row.id, 'genre', value)}
                />
              </span>
              <span role="cell" className="lib-output lib-morph" title={output}>
                {output}
              </span>
              <span role="cell" className="lib-actions lib-morph">
                {row.scanning || row.analysing ? <StopControl onStop={() => onStop(row.id)} /> : null}
                {dirty ? (
                  <button className="lib-action lib-action-reset" type="button" aria-label="Reset track" onClick={() => onReset(row.id)}>
                    <Icon>
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </Icon>
                  </button>
                ) : null}
                <button className="lib-action" type="button" aria-label="Edit full details" onClick={() => onEdit(row.id)}>
                  <Icon>
                    <path d="M21 4h-7" />
                    <path d="M10 4H3" />
                    <path d="M21 12h-9" />
                    <path d="M8 12H3" />
                    <path d="M21 20h-5" />
                    <path d="M12 20H3" />
                    <path d="M14 2v4" />
                    <path d="M8 10v4" />
                    <path d="M16 18v4" />
                  </Icon>
                </button>
                <RemoveControl onRemove={() => onRemove(row.id)} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
