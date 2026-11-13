import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArtworkPanel } from '../components/ArtworkPanel.tsx';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { FileDrop } from '../components/FileDrop.tsx';
import { Logo } from '../components/Logo.tsx';
import { MetadataEditor } from '../components/MetadataEditor.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { Waveform } from '../components/Waveform.tsx';
import { useConsent } from '../components/consent-context.ts';
import { trackEvent } from '../lib/analytics.ts';
import { routeMeta } from '../lib/site.ts';
import type { FilenamePreview } from '../lib/filename.ts';
import type { TrackFields } from '../lib/types.ts';
import { originalMeta, updatedMeta, useTrackSession } from '../session/session-context.ts';

const tool = routeMeta('/app');

export default function ToolPage() {
  const session = useTrackSession();
  const { status } = useConsent();
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const acceptRef = useRef(session.acceptFiles);
  useEffect(() => {
    acceptRef.current = session.acceptFiles;
  });

  useEffect(() => {
    trackEvent('tool_opened');
  }, [status]);

  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragOver(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      acceptRef.current(event.dataTransfer.files);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const { track, preview } = session;
  const editing = session.phase === 'edit' && track && preview;

  return (
    <div className={dragOver ? 'tool drag-active' : 'tool'}>
      <SiteHead title={tool.title} description={tool.description} path={tool.path} />
      <Atmosphere />
      <a className="skip" href="#content">
        Skip to content
      </a>
      {editing ? (
        <header className="appbar">
          <Link to="/" className="logo-link" aria-label="TrackTidy, home">
            <Logo />
          </Link>
          <p className="appbar-kicker">Edited result</p>
          <div className="appbar-actions">
            <Button variant="secondary" onClick={session.requestClose}>
              New track
            </Button>
            <Button variant="primary" disabled={!preview.file || session.exporting} onClick={session.onDownload}>
              {session.exporting ? 'Preparing…' : 'Download'}
            </Button>
          </div>
        </header>
      ) : null}

      {session.exportNote ? (
        session.exportError ? (
          <ErrorBanner title="Could not prepare the file" testId="export-status" className="page-error">
            {session.exportNote}
          </ErrorBanner>
        ) : (
          <p className="status-strip" role="status" data-testid="export-status">
            {session.exportNote}
          </p>
        )
      ) : null}

      {session.phase === 'edit' && session.analysisProblem ? (
        <ErrorBanner title="Could not finish analysis" testId="analysis-error" className="page-error">
          {session.analysisProblem}
        </ErrorBanner>
      ) : null}

      <main id="content" className="workspace">
        {editing ? (
          <section className="studio stage-in">
            <ResultCompare name={track.name} fileFields={track.fileFields} fields={track.fields} preview={preview} />
            <div className="file-col">
              <div className="file-heading">
                <div>
                  <p className="kicker">File</p>
                  <p className="tech-line">{session.tech}</p>
                </div>
              </div>
              <ArtworkPanel
                previewUrl={track.coverUrl}
                source={track.coverFrom}
                artist={track.fields.artist}
                title={track.fields.title}
                album={track.fields.album}
                remix={track.fields.remix}
                busy={session.artworkBusy}
                note={session.artworkNote}
                onApply={session.applyArtwork}
                onRemove={session.removeArtwork}
                onInteract={session.lockArtwork}
              />
              {track.peaks ? (
                <Waveform peaks={track.peaks} scanning={session.scanning} label={`Waveform of ${track.name}`} />
              ) : track.waveformError ? (
                <p className="hint hint-danger">{track.waveformError}</p>
              ) : null}
              {session.extraNote ? <p className="hint">{session.extraNote}</p> : null}
              {session.exportNotice ? <p className="hint">{session.exportNotice}</p> : null}
              {session.keptOnExport.length > 0 ? <p className="hint">Also kept on export: {session.keptOnExport.join(', ')}.</p> : null}
              <p className="hint">The audio stays in this browser and is not uploaded.</p>
            </div>
            <div className="edit-col">
              <MetadataEditor
                fields={track.fields}
                fileFields={track.fileFields}
                bpm={track.analysis.bpm}
                keyEstimate={track.analysis.key}
                bpmError={track.analysis.bpmError}
                keyError={track.analysis.keyError}
                bpmPending={track.analysis.bpmPending}
                keyPending={track.analysis.keyPending}
                template={session.template}
                preview={preview}
                onField={session.updateField}
                onTemplate={session.updateTemplate}
                onDetectBpm={session.rerunBpm}
                onEstimateKey={session.rerunKey}
              />
            </div>
          </section>
        ) : (
          <section className="sheet-body editor-empty">
            <p className="kicker kicker-blue">No track in this tab</p>
            <h1>Upload an MP3 to edit it.</h1>
            <p className="lede">
              Refreshing this page clears the file. TrackTidy reads it in the browser and does not keep a copy.
            </p>
            <FileDrop hot={dragOver} error={session.importError} onFile={session.openFile} />
            <p className="editor-home">
              <Link to="/">Back to the homepage</Link>
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ResultCompare({
  name,
  fileFields,
  fields,
  preview,
}: {
  name: string;
  fileFields: TrackFields;
  fields: TrackFields;
  preview: FilenamePreview;
}) {
  const source = originalMeta(fileFields);
  const updates = updatedMeta(fields, fileFields);
  return (
    <div className="result-band">
      <div className="nameplate nameplate-result" data-testid="filename-preview" aria-live="polite">
        <p className="kicker kicker-blue">Cleaned result</p>
        <h1>{preview.file || 'The name is empty. Add a field that has a value.'}</h1>
        {updates.length > 0 ? (
          <ul className="result-changes">
            {updates.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                {item.value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="result-same">The tags match the file. The name above is what the download will use.</p>
        )}
      </div>
      <div className="original-block">
        <p className="kicker">Original</p>
        <p className="original-file">{name}</p>
        {source ? <p className="original-meta">{source}</p> : <p className="original-meta">No text tags were stored in the file.</p>}
      </div>
    </div>
  );
}
