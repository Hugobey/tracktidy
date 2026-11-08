import { useRef, useState } from 'react';
import {
  fitArtwork,
  loadArtwork,
  searchArtwork,
  sniffImage,
  type ArtworkHit,
  type ImageMime,
} from '../lib/artwork.ts';

type Staged = {
  bytes: Uint8Array;
  mime: ImageMime;
  url: string;
  label: string;
  source: 'upload' | 'search';
};

type Props = {
  previewUrl: string | null;
  source: 'file' | 'search' | 'upload' | null;
  artist: string;
  title: string;
  album: string;
  remix: string;
  busy: boolean;
  note: string | null;
  onApply: (data: Uint8Array, mime: ImageMime, source: 'search' | 'upload') => void;
  onRemove: () => void;
  onInteract: () => void;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function ArtworkPanel({
  previewUrl,
  source,
  artist,
  title,
  album,
  remix,
  busy,
  note,
  onApply,
  onRemove,
  onInteract,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<ArtworkHit[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryKey = `${artist}\n${title}\n${album}\n${remix}`;
  const [querySeen, setQuerySeen] = useState(queryKey);
  if (querySeen !== queryKey) {
    setQuerySeen(queryKey);
    setHits([]);
    setError(null);
    setConfirming(false);
    setStaged((current) => {
      if (current?.source !== 'search') return current;
      URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function replaceStaged(next: Staged | null) {
    setStaged((current) => {
      if (current && current !== next) URL.revokeObjectURL(current.url);
      return next;
    });
    setConfirming(false);
  }

  function stage(bytes: Uint8Array, mime: ImageMime, label: string, source: Staged['source']) {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    replaceStaged({
      bytes: new Uint8Array(copy),
      mime,
      url: URL.createObjectURL(new Blob([copy], { type: mime })),
      label,
      source,
    });
  }

  async function find() {
    onInteract();
    setSearching(true);
    setError(null);
    setHits([]);
    replaceStaged(null);
    try {
      const found = await searchArtwork({ artist, title, album, remix });
      setHits(found);
      if (found.length === 0) {
        setError('No reliable artwork match was found for this artist and title. You can upload an image instead.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Artwork search failed. You can upload an image instead.');
    } finally {
      setSearching(false);
    }
  }

  async function choose(hit: ArtworkHit) {
    setLoadingId(hit.releaseId);
    setError(null);
    try {
      const loaded = await loadArtwork(hit.imageUrl);
      const fitted = await fitArtwork(loaded.bytes, loaded.mime);
      stage(fitted.bytes, fitted.mime, hit.releaseTitle, 'search');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That cover could not be prepared.');
    } finally {
      setLoadingId(null);
    }
  }

  async function upload(file: File | undefined) {
    onInteract();
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('This image is too large. Choose a JPEG or PNG under 8 MB.');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) {
      setError('Use a JPEG or PNG image.');
      return;
    }
    try {
      const fitted = await fitArtwork(bytes, mime);
      stage(fitted.bytes, fitted.mime, file.name, 'upload');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This image could not be prepared.');
    }
  }

  function apply() {
    if (!staged) return;
    if (previewUrl && !confirming) {
      setConfirming(true);
      return;
    }
    onApply(staged.bytes, staged.mime, staged.source);
    replaceStaged(null);
    setHits([]);
  }

  const canSearch = artist.trim().length > 0 && title.trim().length > 0;
  const searchingNow = searching || busy;
  const status = previewUrl
    ? source === 'search'
      ? 'Found from the artist and title.'
      : source === 'upload'
        ? 'Uploaded for this download.'
        : 'Embedded in this MP3.'
    : searchingNow
      ? 'Looking for artwork…'
      : 'No artwork in this MP3.';

  return (
    <div className="artwork" data-testid="artwork-panel">
      <p className="kicker">Artwork</p>
      <div className="artwork-row">
        {previewUrl ? (
          <img src={previewUrl} alt="Track artwork" className="cover" data-testid="artwork-current" />
        ) : (
          <div className="cover cover-empty" data-testid="artwork-empty">
            {searchingNow ? '…' : 'None'}
          </div>
        )}
        <p className="hint artwork-status">{status}</p>
      </div>
      <div className="artwork-actions">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          data-testid="artwork-find"
          disabled={!canSearch || searchingNow}
          onClick={() => void find()}
        >
          {searchingNow ? 'Searching…' : 'Find artwork'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          data-testid="artwork-upload"
          onClick={() => {
            onInteract();
            inputRef.current?.click();
          }}
        >
          Upload image
        </button>
        {previewUrl ? (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            data-testid="artwork-remove"
            onClick={() => {
              onInteract();
              onRemove();
              replaceStaged(null);
              setHits([]);
              setError(null);
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="hint">
        {previewUrl
          ? 'Remove this cover, or replace it with a search result or an upload.'
          : 'Search from the artist and title, or upload an image.'}
      </p>
      {!canSearch ? <p className="hint">Add an artist and a title before searching.</p> : null}
      {error || note ? (
        <p className="hint hint-danger" role="alert" data-testid="artwork-error">
          {error || note}
        </p>
      ) : null}
      {hits.length > 0 ? (
        <div className="artwork-results" data-testid="artwork-results">
          {hits.map((hit) => (
            <button
              key={hit.releaseId}
              type="button"
              className="artwork-hit"
              data-testid="artwork-result"
              disabled={loadingId !== null}
              onClick={() => void choose(hit)}
            >
              <img src={hit.thumbUrl} alt="" />
              <span>
                <strong>{hit.releaseTitle}</strong>
                <em>{loadingId === hit.releaseId ? 'Loading…' : hit.artist}</em>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {staged ? (
        <div className="artwork-stage" data-testid="artwork-preview">
          <img src={staged.url} alt={`Preview of ${staged.label}`} />
          <div>
            <p className="hint">{confirming ? 'Replace the artwork already in this file?' : staged.label}</p>
            <div className="artwork-actions">
              <button type="button" className="btn btn-primary btn-small" data-testid="artwork-apply" onClick={apply}>
                {previewUrl ? 'Replace artwork' : 'Use this artwork'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                data-testid="artwork-cancel"
                onClick={() => replaceStaged(null)}
              >
                {confirming ? 'Keep current' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <input
        ref={inputRef}
        className="file-input"
        data-testid="artwork-file"
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void upload(file);
        }}
      />
    </div>
  );
}
