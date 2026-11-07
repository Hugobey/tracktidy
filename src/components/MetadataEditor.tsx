import { useState } from 'react';
import { FILENAME_PRESETS, bpmToken, type FilenamePreview } from '../lib/filename.ts';
import { parseKey, sameKey } from '../lib/key.ts';
import type { TrackFields } from '../lib/types.ts';

export type BpmAnalysis = { value: string; detail: string } | null;
export type KeyAnalysis = { value: string; camelot: string; low: boolean; detail: string } | null;

type Props = {
  fields: TrackFields;
  fileFields: TrackFields;
  bpm: BpmAnalysis;
  keyEstimate: KeyAnalysis;
  bpmError: string | null;
  keyError: string | null;
  bpmPending: boolean;
  keyPending: boolean;
  template: string;
  preview: FilenamePreview;
  onField: (key: keyof TrackFields, value: string) => void;
  onTemplate: (value: string) => void;
  onDetectBpm: () => void;
  onEstimateKey: () => void;
};

type Badge = { id: string; label: string };

function badgeFor(
  key: keyof TrackFields,
  value: string,
  fileValue: string,
  bpm: BpmAnalysis,
  keyEstimate: KeyAnalysis,
): Badge {
  if (!value.trim()) return { id: 'missing', label: 'Missing' };
  const current = key === 'bpm' ? bpmToken(value) || value.trim() : value.trim();
  const original = key === 'bpm' ? bpmToken(fileValue) || fileValue.trim() : fileValue.trim();
  if (original && current === original) return { id: 'file', label: 'From file' };
  if (key === 'bpm' && bpm && bpmToken(value) === bpm.value) return { id: 'detected', label: 'Detected' };
  if (key === 'key' && keyEstimate && sameKey(value, keyEstimate.value)) {
    return keyEstimate.low
      ? { id: 'low', label: 'Low confidence' }
      : { id: 'estimated', label: 'Estimated' };
  }
  return { id: 'edited', label: 'Edited' };
}

export function MetadataEditor({
  fields,
  fileFields,
  bpm,
  keyEstimate,
  bpmError,
  keyError,
  bpmPending,
  keyPending,
  template,
  preview,
  onField,
  onTemplate,
  onDetectBpm,
  onEstimateKey,
}: Props) {
  const [keyNote, setKeyNote] = useState('');
  const parsedKey = parseKey(fields.key);
  const notation = /^(?:[1-9]|1[0-2])[AB]$/i.test(fields.key.trim()) ? 'camelot' : parsedKey ? 'musical' : null;
  const bpmSuggestion = bpm && fields.bpm.trim() && bpmToken(fields.bpm) !== bpm.value ? bpm : null;
  const keySuggestion =
    keyEstimate && fields.key.trim() && !sameKey(fields.key, keyEstimate.value) ? keyEstimate : null;

  function setNotation(target: 'musical' | 'camelot') {
    if (!parsedKey) {
      setKeyNote('This key can’t be converted. Use a note such as F#m, or a Camelot code such as 11A.');
      return;
    }
    setKeyNote('');
    onField('key', target === 'camelot' ? parsedKey.camelot : parsedKey.musical);
  }

  function scaleBpm(factor: number) {
    const value = Number(fields.bpm);
    if (!Number.isFinite(value) || value <= 0) return;
    const next = Math.round(value * factor);
    if (next < 1 || next > 999) return;
    onField('bpm', String(next));
  }

  const bpmHint = bpmError
    ? bpmError
    : bpm && bpmToken(fields.bpm) === bpm.value
      ? bpm.detail
      : '';
  const keyHint = [
    parsedKey && notation === 'musical' ? `Camelot ${parsedKey.camelot}` : '',
    parsedKey && notation === 'camelot' ? parsedKey.musical : '',
    keyNote,
    keyError && !fields.key.trim() ? keyError : '',
    keyEstimate && sameKey(fields.key, keyEstimate.value) ? keyEstimate.detail : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="editor">
      <div className="editor-head">
        <p className="kicker">Metadata</p>
        <h2>Clean this track</h2>
      </div>
      <div className="fields">
        <TextField
          id="artist"
          label="Artist"
          value={fields.artist}
          badge={badgeFor('artist', fields.artist, fileFields.artist, bpm, keyEstimate)}
          onChange={(value) => onField('artist', value)}
        />
        <TextField
          id="title"
          label="Title"
          value={fields.title}
          badge={badgeFor('title', fields.title, fileFields.title, bpm, keyEstimate)}
          onChange={(value) => onField('title', value)}
        />
        <TextField
          id="remix"
          label="Remix"
          value={fields.remix}
          badge={badgeFor('remix', fields.remix, fileFields.remix, bpm, keyEstimate)}
          onChange={(value) => onField('remix', value)}
        />
        <TextField
          id="album"
          label="Album"
          value={fields.album}
          badge={badgeFor('album', fields.album, fileFields.album, bpm, keyEstimate)}
          onChange={(value) => onField('album', value)}
        />
        <TextField
          id="genre"
          label="Genre"
          value={fields.genre}
          badge={badgeFor('genre', fields.genre, fileFields.genre, bpm, keyEstimate)}
          onChange={(value) => onField('genre', value)}
        />
        <div className="meta-row">
          <label className="meta-label" htmlFor="bpm">
            BPM
          </label>
          <input
            id="bpm"
            data-testid="bpm"
            inputMode="decimal"
            value={fields.bpm}
            aria-invalid={Boolean(fields.bpm.trim()) && !bpmToken(fields.bpm)}
            onChange={(event) => onField('bpm', event.target.value)}
          />
          <BadgeView badge={badgeFor('bpm', fields.bpm, fileFields.bpm, bpm, keyEstimate)} />
          <div className="field-extra">
            <div className="seg">
              <button type="button" onClick={() => scaleBpm(0.5)}>
                ÷2
              </button>
              <button type="button" onClick={() => scaleBpm(2)}>
                ×2
              </button>
              <button type="button" onClick={onDetectBpm} disabled={bpmPending}>
                {bpmPending ? 'Detecting' : 'Detect'}
              </button>
            </div>
          </div>
          {bpmHint ? <p className="hint">{bpmHint}</p> : null}
          {bpmSuggestion ? (
            <p className="hint">
              Audio reads {bpmSuggestion.value}.{' '}
              <button type="button" className="text-button" onClick={() => onField('bpm', bpmSuggestion.value)}>
                Use {bpmSuggestion.value}
              </button>
            </p>
          ) : null}
        </div>
        <div className="meta-row">
          <label className="meta-label" htmlFor="key">
            Key
          </label>
          <input
            id="key"
            data-testid="key"
            value={fields.key}
            onChange={(event) => {
              setKeyNote('');
              onField('key', event.target.value);
            }}
          />
          <BadgeView badge={badgeFor('key', fields.key, fileFields.key, bpm, keyEstimate)} />
          <div className="field-extra">
            <div className="seg">
              <button type="button" aria-pressed={notation === 'musical'} onClick={() => setNotation('musical')}>
                Musical
              </button>
              <button type="button" aria-pressed={notation === 'camelot'} onClick={() => setNotation('camelot')}>
                Camelot
              </button>
              <button type="button" onClick={onEstimateKey} disabled={keyPending}>
                {keyPending ? 'Estimating' : 'Estimate'}
              </button>
            </div>
          </div>
          {keyHint ? <p className="hint">{keyHint}</p> : null}
          {keySuggestion ? (
            <p className="hint">
              Estimate {keySuggestion.value}
              {keySuggestion.low ? ', low confidence' : ''}.{' '}
              <button type="button" className="text-button" onClick={() => onField('key', keySuggestion.value)}>
                Use {keySuggestion.value}
              </button>
            </p>
          ) : null}
        </div>
      </div>

      <div className="filename">
        <div className="editor-head">
          <p className="kicker">Filename</p>
          <h2>Name the file</h2>
        </div>
        <div className="meta-row">
          <label className="meta-label" htmlFor="template">
            Template
          </label>
          <input
            id="template"
            data-testid="template"
            className="template"
            value={template}
            spellCheck={false}
            onChange={(event) => onTemplate(event.target.value)}
          />
          <span className="badge-spacer" aria-hidden="true" />
          <div className="field-extra">
            <div className="presets">
              {FILENAME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={template === preset.template ? 'preset preset-active' : 'preset'}
                  onClick={() => onTemplate(preset.template)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="token-help">{'{artist} {title} {remix} {album} {genre} {bpm} {key}'}</p>
            <div className="nameplate" data-testid="filename-preview" aria-live="polite">
              <p className="kicker">Preview</p>
              <p>{preview.file || 'The name is empty. Add a field that has a value.'}</p>
            </div>
            {preview.missing.length > 0 && preview.file ? (
              <p className="hint">Left out of the name because they’re empty: {preview.missing.join(', ')}.</p>
            ) : null}
            {preview.invalidBpm ? <p className="hint hint-warn">BPM isn’t a number, so it was left out of the name.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  badge,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  badge: Badge;
  onChange: (value: string) => void;
}) {
  return (
    <div className="meta-row">
      <label className="meta-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} data-testid={id} value={value} onChange={(event) => onChange(event.target.value)} />
      <BadgeView badge={badge} />
    </div>
  );
}

function BadgeView({ badge }: { badge: Badge }) {
  return <span className={`badge badge-${badge.id}`}>{badge.label}</span>;
}
