import { DEFAULT_LIBRARY_TOKENS } from './library-name.ts';
import { loadCrate, saveCrate } from './library-store.ts';
import type { FallbackPayload, TrackFields } from './types.ts';

export type LibraryEditorTrack = {
  id: string;
  sourceName: string;
  buffer: ArrayBuffer;
  fields: TrackFields;
  original: TrackFields;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
};

const pending = new Map<string, TrackFields>();

export function stashEditorFields(name: string, fields: TrackFields): void {
  pending.set(name, { ...fields });
}

export function takeEditorFields(name: string): TrackFields | null {
  const found = pending.get(name);
  if (!found) return null;
  pending.delete(name);
  return { ...found };
}

async function writeRows(match: (row: { id: string; sourceName: string }) => boolean, fields: TrackFields): Promise<void> {
  const stored = await loadCrate();
  if (!stored) return;
  let hit = false;
  const rows = stored.rows.map((row) => {
    if (!match(row)) return row;
    hit = true;
    return { ...row, fields: { ...fields } };
  });
  if (!hit) return;
  await saveCrate({ ...stored, rows });
}

export function writeCrateFields(id: string, fields: TrackFields): Promise<void> {
  return writeRows((row) => row.id === id, fields);
}

export function writeCrateFieldsBySource(sourceName: string, fields: TrackFields): Promise<void> {
  return writeRows((row) => row.sourceName === sourceName, fields);
}

/** Keep a track the editor has opened, including for a free crate. Demo rows are replaced by this file. Returns the stored row id. */
export async function upsertAnalyzedTrack(input: LibraryEditorTrack): Promise<string> {
  const stored = await loadCrate();
  const row = {
    id: input.id,
    sourceName: input.sourceName,
    fields: { ...input.fields },
    cleaned: { ...input.fields },
    original: { ...input.original },
    buffer: input.buffer,
    remixFrame: input.remixFrame,
    fallback: input.fallback,
  };
  if (!stored || stored.kind !== 'files') {
    await saveCrate({
      kind: 'files',
      tokens: stored && stored.tokens.length > 0 ? stored.tokens.map((token) => ({ ...token })) : DEFAULT_LIBRARY_TOKENS.map((token) => ({ ...token })),
      rows: [row],
    });
    return row.id;
  }
  const index = stored.rows.findIndex((item) => item.id === input.id || item.sourceName === input.sourceName);
  if (index >= 0) {
    const keptId = stored.rows[index].id;
    const rows = stored.rows.map((item, itemIndex) =>
      itemIndex === index ? { ...item, fields: { ...input.fields }, buffer: input.buffer, sourceName: input.sourceName } : item,
    );
    await saveCrate({ ...stored, kind: 'files', rows });
    return keptId;
  }
  await saveCrate({ ...stored, kind: 'files', rows: [...stored.rows, row] });
  return row.id;
}
