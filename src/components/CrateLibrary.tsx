import { GenreSelector } from './GenreSelector.tsx';
import { CrateRow, SelectBox } from './CrateRow.tsx';
import { PRO_COPY } from '../lib/pro.ts';
import type { CrateLibraryRow } from '../types/track.ts';
import type { TrackFields } from '../lib/types.ts';

export function CrateLibrary({
  rows,
  selected,
  onToggleRow,
  onToggleAll,
  onField,
  onRemove,
  onReset,
  onEdit,
  onStop,
  selectedCount,
  genreDraft,
  bpmDraft,
  deleteArmed,
  onGenre,
  onBpmDraft,
  onApplyBpm,
  onClean,
  onCase,
  onDelete,
}: {
  rows: CrateLibraryRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onField: (id: string, key: keyof TrackFields, value: string) => void;
  onRemove: (id: string) => void;
  onReset: (id: string) => void;
  onEdit: (id: string) => void;
  onStop: (id: string) => void;
  selectedCount: number;
  genreDraft: string;
  bpmDraft: string;
  deleteArmed: boolean;
  onGenre: (value: string) => void;
  onBpmDraft: (value: string) => void;
  onApplyBpm: () => void;
  onClean: () => void;
  onCase: () => void;
  onDelete: () => void;
}) {
  const ids = rows.map((row) => row.id);
  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));
  const partial = ids.some((id) => selected.has(id));
  return (
    <>
      {rows.length === 0 ? (
        <p className="lib-empty">{PRO_COPY.libraryFilterEmpty}</p>
      ) : (
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
            {rows.map((row) => (
              <CrateRow
                key={row.id}
                row={row}
                selected={selected.has(row.id)}
                onToggle={() => onToggleRow(row.id)}
                onField={(key, value) => onField(row.id, key, value)}
                onRemove={() => onRemove(row.id)}
                onReset={() => onReset(row.id)}
                onEdit={() => onEdit(row.id)}
                onStop={() => onStop(row.id)}
              />
            ))}
          </div>
        </div>
      )}
      {selectedCount > 0 ? (
        <div className="lib-selectbar" role="toolbar" aria-label="Selected tracks">
          <span className="lib-select-count">{selectedCount}</span>
          <button className="crate-pill" type="button" onClick={onClean}>
            {PRO_COPY.libraryClean}
          </button>
          <button className="crate-pill" type="button" onClick={onCase}>
            {PRO_COPY.libraryCase}
          </button>
          <GenreSelector value={genreDraft} variant="bulk" label={PRO_COPY.librarySetGenre} onChange={onGenre} />
          <label className="lib-bar-field">
            <span className="sr-only">{PRO_COPY.librarySetBpm}</span>
            <input
              className="lib-edit lib-bar-input"
              aria-label={PRO_COPY.librarySetBpm}
              placeholder={PRO_COPY.librarySetBpm}
              value={bpmDraft}
              onChange={(event) => onBpmDraft(event.target.value)}
              onBlur={() => {
                if (bpmDraft.trim()) onApplyBpm();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onApplyBpm();
                }
              }}
            />
          </label>
          <button className={deleteArmed ? 'crate-pill lib-danger' : 'crate-pill'} type="button" onClick={onDelete}>
            {deleteArmed
              ? `Delete ${selectedCount} selected ${selectedCount === 1 ? 'track' : 'tracks'}?`
              : PRO_COPY.libraryDelete}
          </button>
        </div>
      ) : null}
    </>
  );
}
