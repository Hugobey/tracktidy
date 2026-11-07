import { useEffect, useRef, useState } from 'react';
import { Atmosphere } from './Atmosphere.tsx';
import { Logo } from './Logo.tsx';

type Props = {
  error?: string | null;
  onClose: () => void;
  onFile: (file: File, extra: boolean) => void;
};

export function UploadOverlay({ error, onClose, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function browse() {
    inputRef.current?.click();
  }

  function take(list: FileList | null) {
    if (!list?.length) return;
    onFile(list[0], list.length > 1);
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <Atmosphere />
      <header className="sheet-bar">
        <Logo />
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="sheet-body">
        <p className="kicker kicker-blue sheet-enter">Drop a track</p>
        <h1 id="upload-title" className="sheet-enter d1">
          Start with one track<span className="dot">.</span>
        </h1>
        <p className="lede sheet-enter d2">
          Clean its metadata, detect the tempo, and rename the file. It stays on this computer.
        </p>
        <button type="button" className="upload-bar sheet-enter d2" onClick={browse}>
          <span className="upload-kicker">MP3</span>
          <span className="upload-pill">
            <span className="upload-glyph" aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M8 2.2v8.2M4.8 5.4 8 2.2l3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 13.2h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            Upload
          </span>
        </button>
        <div
          className={dragOver ? 'drop-well drop-hot sheet-enter d3' : 'drop-well sheet-enter d3'}
          onClick={browse}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            depth.current += 1;
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            depth.current = Math.max(0, depth.current - 1);
            if (depth.current === 0) setDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            depth.current = 0;
            setDragOver(false);
            take(event.dataTransfer.files);
          }}
        >
          <p className="drop-title">{dragOver ? 'Release to read it' : 'Drop an MP3 here'}</p>
          <p className="drop-copy">Browse a file, or drop one track into this window.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={(event) => {
              event.stopPropagation();
              browse();
            }}
          >
            Browse files
          </button>
          {error ? (
            <p className="hint hint-warn" role="alert" data-testid="drop-error">
              {error}
            </p>
          ) : null}
        </div>
        <aside className="privacy-card sheet-enter d4">
          <p className="privacy-title">
            <span className="lock" aria-hidden="true" />
            On this computer.
          </p>
          <p>
            The file is read in this browser and never uploaded. MP3 is the only format this version writes. WAV,
            AIFF, FLAC, and M4A are refused.
          </p>
        </aside>
        <p className="sheet-foot sheet-enter d4">One track at a time · In the browser · No account</p>
      </div>
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept=".mp3,audio/mpeg,audio/mp3"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
