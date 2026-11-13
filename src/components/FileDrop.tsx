import { useRef } from 'react';
import { ErrorBanner } from './ErrorBanner.tsx';

type Props = {
  hot: boolean;
  error: string | null;
  onFile: (file: File, extra: boolean) => void;
};

export function FileDrop({ hot, error, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function browse() {
    inputRef.current?.click();
  }

  function take(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    onFile(file, (list?.length ?? 0) > 1);
  }

  return (
    <div className="hero-drop" id="upload">
      <div
        className={hot ? 'drop-well drop-hot' : error ? 'drop-well drop-error' : 'drop-well'}
        onClick={browse}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            browse();
          }
        }}
        role="button"
        tabIndex={0}
        data-testid="hero-upload"
        aria-label="Upload an MP3"
      >
        <p className="drop-title">{hot ? 'Release to read it' : 'Drop an MP3 here'}</p>
        <p className="drop-copy">Or press to browse. One track, in this browser.</p>
      </div>
      {error ? (
        <ErrorBanner title="Could not import" testId="drop-error">
          {error}
        </ErrorBanner>
      ) : null}
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept=".mp3,.wav,.aif,.aiff,.flac,.m4a,.mp4,.aac,.ogg,.opus,audio/*"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
