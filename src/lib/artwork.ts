export type ImageMime = 'image/jpeg' | 'image/png';

export type ArtworkQuery = {
  artist: string;
  title: string;
  album: string;
  remix: string;
};

export type ArtworkHit = {
  releaseId: string;
  releaseTitle: string;
  artist: string;
  thumbUrl: string;
  imageUrl: string;
};

export class ArtworkSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtworkSearchError';
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ArtworkDeps = {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const USER_AGENT = 'TrackTidy/0.1 (support@track-tidy.com)';
const MB_GAP_MS = 1100;
const MAX_RESULTS = 4;
const MAX_RELEASE_CHECKS = 5;
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_EDGE = 800;

type Credit = { name?: string; artist?: { name?: string } };

type ReleaseGroup = {
  'primary-type'?: string;
  'secondary-types'?: string[];
};

type ReleaseRecord = {
  id?: string;
  title?: string;
  status?: string;
  'artist-credit'?: Credit[];
  'release-group'?: ReleaseGroup;
};

type RecordingRecord = {
  id?: string;
  title?: string;
  score?: number;
  'artist-credit'?: Credit[];
  releases?: ReleaseRecord[];
};

const resultCache = new Map<string, ArtworkHit[]>();
const imageCache = new Map<string, Promise<{ bytes: Uint8Array; mime: ImageMime }>>();
let queue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

export function resetArtworkSearchForTests(): void {
  resultCache.clear();
  imageCache.clear();
  queue = Promise.resolve();
  nextRequestAt = 0;
}

export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

export function bytesEqual(left: Uint8Array | null, right: Uint8Array | null): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function escapeLucene(value: string): string {
  return value.replace(/[+\-!(){}[\]^"~*?:\\/]/g, '\\$&');
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function norm(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function same(left: string, right: string): boolean {
  const a = norm(left);
  const b = norm(right);
  return a.length > 0 && a === b;
}

function creditNames(credits: Credit[] | undefined): string[] {
  return (credits ?? [])
    .map((credit) => credit.name || credit.artist?.name || '')
    .map((name) => name.trim())
    .filter(Boolean);
}

function titleMatches(recordingTitle: string, title: string, remix: string): boolean {
  if (same(recordingTitle, title)) return true;
  return remix.trim().length > 0 && same(recordingTitle, `${title} ${remix}`);
}

function artistMatches(credits: Credit[] | undefined, artist: string): boolean {
  const names = creditNames(credits);
  return names.some((name) => same(name, artist)) || same(names.join(' '), artist);
}

function cacheKey(query: ArtworkQuery): string {
  return [query.artist, query.title, query.album, query.remix].map(norm).join('|');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function releaseScore(release: ReleaseRecord, query: ArtworkQuery): number {
  let score = 0;
  if (release.status === 'Official') score += 30;
  if (release.status === 'Bootleg' || release.status === 'Pseudo-Release') score -= 40;
  const primary = release['release-group']?.['primary-type'] ?? '';
  const secondary = release['release-group']?.['secondary-types'] ?? [];
  if (same(release.title ?? '', query.title)) score += 25;
  if (primary === 'Single' && same(release.title ?? '', query.title)) score += 50;
  if (query.album.trim() && same(release.title ?? '', query.album)) score += 50;
  if (secondary.some((type) => type === 'Compilation' || type === 'Soundtrack' || type === 'DJ-mix')) score -= 20;
  const releaseArtist = creditNames(release['artist-credit'])[0] ?? '';
  if (same(releaseArtist, query.artist)) score += 15;
  if (same(releaseArtist, 'Various Artists')) score -= 10;
  return score;
}

function pace<T>(work: () => Promise<T>, deps: ArtworkDeps): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const run = queue.then(async () => {
    const wait = Math.max(0, nextRequestAt - now());
    if (wait > 0) await sleep(wait);
    nextRequestAt = now() + MB_GAP_MS;
    return work();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function musicBrainz(url: string, deps: ArtworkDeps): Promise<unknown> {
  const fetchImpl = deps.fetch ?? fetch;
  return pace(async () => {
    let response: Response;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      // Browsers refuse to send a custom User-Agent. MusicBrainz still accepts the browser's own.
      if (typeof navigator === 'undefined') headers['User-Agent'] = USER_AGENT;
      response = await fetchImpl(url, { headers });
    } catch {
      throw new ArtworkSearchError(
        'Artwork search could not reach MusicBrainz. Check the connection and try again.',
      );
    }
    if (response.status === 503) {
      throw new ArtworkSearchError('MusicBrainz is busy. Wait a moment and try again.');
    }
    if (!response.ok) {
      throw new ArtworkSearchError('MusicBrainz did not return a result. You can upload an image instead.');
    }
    return response.json() as Promise<unknown>;
  }, deps);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asRecordings(payload: unknown): RecordingRecord[] {
  const record = asRecord(payload);
  const list = record?.recordings;
  return Array.isArray(list) ? (list as RecordingRecord[]) : [];
}

function asReleases(payload: unknown): ReleaseRecord[] {
  const record = asRecord(payload);
  const list = record?.releases;
  return Array.isArray(list) ? (list as ReleaseRecord[]) : [];
}

async function coverForRelease(
  releaseId: string,
  fetchImpl: FetchLike,
): Promise<{ thumbUrl: string; imageUrl: string } | null> {
  let response: Response;
  try {
    response = await fetchImpl(`https://coverartarchive.org/release/${releaseId}`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    return null;
  }
  if (response.status === 404 || !response.ok) return null;
  const body = asRecord(await response.json());
  const images = body?.images;
  if (!Array.isArray(images)) return null;
  const front = images.find((image) => asRecord(image)?.front === true) ?? images[0];
  const image = asRecord(front);
  if (!image) return null;
  const thumbs = asRecord(image.thumbnails);
  const full = typeof image.image === 'string' ? image.image : '';
  const thumb = (typeof thumbs?.small === 'string' && thumbs.small) || (typeof thumbs?.['250'] === 'string' && thumbs['250']) || full;
  const large = (typeof thumbs?.large === 'string' && thumbs.large) || (typeof thumbs?.['500'] === 'string' && thumbs['500']) || full;
  if (!thumb || !large) return null;
  return { thumbUrl: thumb, imageUrl: large };
}

export async function searchArtwork(query: ArtworkQuery, deps: ArtworkDeps = {}): Promise<ArtworkHit[]> {
  const artist = query.artist.trim();
  const title = query.title.trim();
  if (!artist || !title) {
    throw new ArtworkSearchError('Add an artist and a title, then search again.');
  }
  const key = cacheKey(query);
  const cached = resultCache.get(key);
  if (cached) return cached;

  const lucene = `recording:"${escapeLucene(title)}" AND artist:"${escapeLucene(artist)}"`;
  const searchUrl = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(lucene)}&fmt=json&limit=5`;
  const found = asRecordings(await musicBrainz(searchUrl, deps)).filter(
    (recording) =>
      typeof recording.id === 'string' &&
      isUuid(recording.id) &&
      titleMatches(recording.title ?? '', title, query.remix) &&
      artistMatches(recording['artist-credit'], artist),
  );
  found.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  const recording = found[0];
  if (!recording?.id) {
    resultCache.set(key, []);
    return [];
  }

  let releases = recording.releases ?? [];
  try {
    const lookup = await musicBrainz(
      `https://musicbrainz.org/ws/2/recording/${recording.id}?inc=releases&fmt=json`,
      deps,
    );
    const lookedUp = asReleases(lookup);
    if (lookedUp.length > 0) releases = lookedUp;
  } catch (error) {
    if (releases.length === 0) throw error;
  }

  const ranked = releases
    .filter((release) => typeof release.id === 'string' && isUuid(release.id))
    .map((release) => ({ release, score: releaseScore(release, query) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RELEASE_CHECKS);

  const fetchImpl = deps.fetch ?? fetch;
  const checked = await Promise.all(
    ranked.map(async (entry) => {
      const art = await coverForRelease(entry.release.id as string, fetchImpl);
      if (!art) return null;
      const hit: ArtworkHit = {
        releaseId: entry.release.id as string,
        releaseTitle: entry.release.title?.trim() || title,
        artist: creditNames(entry.release['artist-credit'])[0] || artist,
        thumbUrl: art.thumbUrl,
        imageUrl: art.imageUrl,
      };
      return { hit, score: entry.score };
    }),
  );

  const hits = checked
    .filter((entry): entry is { hit: ArtworkHit; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.hit);
  resultCache.set(key, hits);
  return hits;
}

async function fetchImage(url: string, fetchImpl: FetchLike): Promise<{ bytes: Uint8Array; mime: ImageMime }> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch {
    throw new ArtworkSearchError('The artwork image could not be downloaded. You can upload an image instead.');
  }
  if (!response.ok) {
    throw new ArtworkSearchError('The artwork image could not be downloaded. You can upload an image instead.');
  }
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES) {
    throw new ArtworkSearchError('This artwork file is too large to embed. Choose another result or upload an image.');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ArtworkSearchError('This artwork file is too large to embed. Choose another result or upload an image.');
  }
  const mime = sniffImage(bytes);
  if (!mime) throw new ArtworkSearchError('The match was not a JPEG or PNG image. You can upload an image instead.');
  return { bytes, mime };
}

export function loadArtwork(url: string, fetchImpl?: FetchLike): Promise<{ bytes: Uint8Array; mime: ImageMime }> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const pending = fetchImage(url, fetchImpl ?? fetch);
  imageCache.set(url, pending);
  pending.catch(() => {
    if (imageCache.get(url) === pending) imageCache.delete(url);
  });
  return pending;
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export async function fitArtwork(bytes: Uint8Array, mime: ImageMime): Promise<{ bytes: Uint8Array; mime: ImageMime }> {
  const sniffed = sniffImage(bytes);
  if (!sniffed) throw new ArtworkSearchError('Use a JPEG or PNG image.');
  const resolved: ImageMime = sniffed === mime ? mime : sniffed;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ArtworkSearchError('This image is too large to embed.');
    }
    return { bytes, mime: resolved };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([copyBuffer(bytes)], { type: resolved }));
  } catch {
    throw new ArtworkSearchError('This image could not be read. Use a JPEG or PNG.');
  }
  try {
    const edge = Math.max(bitmap.width, bitmap.height);
    if (resolved === 'image/jpeg' && edge <= MAX_EDGE && bytes.byteLength <= 500_000) {
      return { bytes, mime: 'image/jpeg' };
    }
    const scale = edge > MAX_EDGE ? MAX_EDGE / edge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { bytes, mime: resolved };
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.9);
    });
    if (!blob) return { bytes, mime: resolved };
    const fitted = new Uint8Array(await blob.arrayBuffer());
    if (sniffImage(fitted) !== 'image/jpeg') throw new ArtworkSearchError('This image could not be prepared.');
    return { bytes: fitted, mime: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}
