import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { GENRE_OPTIONS, genreSlug, genreTagCss, joinGenreTags, parseGenreTags } from '../constants/genres.ts';

type Variant = 'cell' | 'field' | 'bulk';

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  variant?: Variant;
  emptyLabel?: string;
};

const STYLE_ID = 'genre-tag-colors';

function ensureGenreStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const node = document.createElement('style');
  node.id = STYLE_ID;
  node.textContent = genreTagCss();
  document.head.appendChild(node);
}

function GenreChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span className="genre-tag" data-tone={genreSlug(label)}>
      <span className="genre-tag-label">{label}</span>
      {onRemove ? (
        <button type="button" className="genre-x" aria-label={`Remove ${label}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  );
}

export function GenreSelector({ value, onChange, label, variant = 'cell', emptyLabel = 'Add genre' }: Props) {
  const tags = parseGenreTags(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const [librarySurface, setLibrarySurface] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const limit = variant === 'field' ? 3 : 2;
  const visible = tags.slice(0, limit);
  const extra = tags.slice(limit);

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const known = GENRE_OPTIONS.filter((genre) => !needle || genre.label.toLowerCase().includes(needle));
    const exact = GENRE_OPTIONS.some((genre) => genre.label.toLowerCase() === needle);
    const custom = needle && !exact ? query.trim().replace(/\s+/g, ' ') : '';
    return { known, custom };
  }, [query]);

  const rows = options.custom ? options.known.length + 1 : options.known.length;

  useEffect(() => {
    ensureGenreStyles();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const node = anchorRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const width = Math.max(rect.width, variant === 'bulk' ? 240 : 260);
      const menuHeight = 320;
      const below = window.innerHeight - rect.bottom;
      const top = below < menuHeight && rect.top > menuHeight ? rect.top - menuHeight - 6 : rect.bottom + 6;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setBox({ top, left, width });
    };
    setLibrarySurface(Boolean(anchorRef.current?.closest('.lib-page')));
    place();
    searchRef.current?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, variant]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.genre-menu')) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, [open]);

  function commit(next: string[]) {
    onChange(joinGenreTags(next));
  }

  function toggleLabel(labelText: string) {
    const key = labelText.toLowerCase();
    const exists = tags.some((tag) => tag.toLowerCase() === key);
    commit(exists ? tags.filter((tag) => tag.toLowerCase() !== key) : [...tags, labelText]);
  }

  function onMenuKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (rows === 0 ? 0 : (index + 1) % rows));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (rows === 0 ? 0 : (index - 1 + rows) % rows));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (options.custom && active === options.known.length) {
        toggleLabel(options.custom);
        setQuery('');
        return;
      }
      const genre = options.known[active];
      if (genre) toggleLabel(genre.label);
    }
  }

  const menu =
    open && box && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={librarySurface ? 'genre-menu genre-menu-library' : 'genre-menu'}
            role="listbox"
            id={listId}
            aria-label={label}
            aria-multiselectable="true"
            style={{ top: box.top, left: box.left, width: box.width }}
            onKeyDown={onMenuKey}
          >
            <input
              ref={searchRef}
              className="genre-search"
              value={query}
              placeholder="Search genres"
              aria-label={`Search ${label}`}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onMenuKey}
            />
            <div className="genre-options">
              {options.known.map((genre, index) => {
                const selected = tags.some((tag) => tag.toLowerCase() === genre.label.toLowerCase());
                return (
                  <button
                    key={genre.slug}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={index === active ? 'genre-option genre-option-active' : 'genre-option'}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => toggleLabel(genre.label)}
                  >
                    <GenreChip label={genre.label} />
                    {selected ? <span className="genre-check">On</span> : null}
                  </button>
                );
              })}
              {options.custom ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={active === options.known.length ? 'genre-option genre-option-active' : 'genre-option'}
                  onMouseEnter={() => setActive(options.known.length)}
                  onClick={() => {
                    toggleLabel(options.custom);
                    setQuery('');
                  }}
                >
                  {`+ Add custom genre "${options.custom}"`}
                </button>
              ) : null}
              {options.known.length === 0 && !options.custom ? <p className="genre-empty">No matching genres</p> : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`genre-select genre-select-${variant}`} ref={anchorRef}>
      {variant === 'bulk' && tags.length === 0 ? (
        <button
          type="button"
          className="crate-pill genre-bulk"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((valueOpen) => !valueOpen)}
        >
          {label}
        </button>
      ) : (
        <div className="genre-face">
          {visible.map((tag) => (
            <GenreChip
              key={tag}
              label={tag}
              onRemove={() => toggleLabel(tag)}
            />
          ))}
          {extra.length > 0 ? (
            <span className="genre-more" tabIndex={0}>
              {`+${extra.length}`}
              <span className="genre-more-pop" role="tooltip">
                {extra.map((tag) => (
                  <GenreChip key={tag} label={tag} />
                ))}
              </span>
            </span>
          ) : null}
          <button
            type="button"
            className={tags.length === 0 ? 'genre-open genre-open-empty' : 'genre-open'}
            aria-label={label}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((valueOpen) => !valueOpen)}
          >
            {tags.length === 0 ? emptyLabel : 'Edit'}
          </button>
        </div>
      )}
      {menu}
    </div>
  );
}
