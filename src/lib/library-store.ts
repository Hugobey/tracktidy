import type { LibraryToken } from './library-name.ts';
import type { LibraryTrack } from './library-clean.ts';
import type { FallbackPayload, TrackFields } from './types.ts';

const DB_NAME = 'tracktidy-library';
const STORE = 'crate';

export type StoredTrack = {
  id: string;
  sourceName: string;
  fields: TrackFields;
  cleaned: TrackFields;
  original: TrackFields;
  buffer: ArrayBuffer | null;
  remixFrame: 'TIT3' | 'TPE4';
  fallback: FallbackPayload | null;
};

export type StoredCrate = {
  kind: 'demo' | 'files' | 'empty';
  tokens: LibraryToken[];
  rows: StoredTrack[];
};

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

export function packCrate(kind: StoredCrate['kind'], tokens: LibraryToken[], rows: LibraryTrack[]): StoredCrate {
  return {
    kind,
    tokens: tokens.map((token) => ({ ...token })),
    rows: rows.map((row) => ({
      id: row.id,
      sourceName: row.sourceName,
      fields: { ...row.fields },
      cleaned: { ...row.cleaned },
      original: { ...row.original },
      buffer: row.buffer,
      remixFrame: row.remixFrame,
      fallback: row.fallback,
    })),
  };
}

export function unpackCrate(stored: StoredCrate): { kind: StoredCrate['kind']; tokens: LibraryToken[]; rows: LibraryTrack[] } {
  return {
    kind: stored.kind,
    tokens: stored.tokens.map((token) => ({ ...token })),
    rows: stored.rows.map((row) => ({
      ...row,
      fields: { ...row.fields },
      cleaned: { ...row.cleaned },
      original: { ...row.original },
      bands: null,
      analysing: Boolean(row.buffer),
      coverUrl: null,
      skeleton: false,
      scanning: false,
      failed: false,
      enterDelay: 0,
    })),
  };
}

let saveTail: Promise<void> = Promise.resolve();

async function saveCrateNow(crate: StoredCrate): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(crate, 'session');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function saveCrate(crate: StoredCrate): Promise<void> {
  const run = saveTail.then(() => saveCrateNow(crate));
  saveTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function loadCrate(): Promise<StoredCrate | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await database();
  const stored = await new Promise<StoredCrate | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get('session');
    request.onsuccess = () => resolve((request.result as StoredCrate | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!stored || !Array.isArray(stored.rows) || !Array.isArray(stored.tokens)) return null;
  return stored;
}
