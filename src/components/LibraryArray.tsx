import { useRef } from 'react';
import { LIBRARY_TOKEN_LABEL, type LibraryToken, type LibraryTokenId } from '../lib/library-name.ts';

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
