import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext.tsx';
import { ArtworkPanel } from '../components/ArtworkPanel.tsx';
import { Atmosphere } from '../components/Atmosphere.tsx';
import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { FileDrop } from '../components/FileDrop.tsx';
import { CrateNudge } from '../components/CrateNudge.tsx';
import { Logo } from '../components/Logo.tsx';
import { MetadataEditor } from '../components/MetadataEditor.tsx';
import { ProAccount } from '../components/ProAccount.tsx';
import { ProNudge } from '../components/ProNudge.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHead } from '../components/SiteHead.tsx';
import { Waveform } from '../components/Waveform.tsx';
import { useConsent } from '../components/consent-context.ts';
import { trackEvent } from '../lib/analytics.ts';
import { CRATE_MULTI_FLAG, PRO_COPY } from '../lib/pro.ts';
import { routeMeta } from '../lib/site.ts';
import { renderFilename, type FilenamePreview } from '../lib/filename.ts';
import type { TrackFields } from '../lib/types.ts';
import { fieldsFromMetadata } from '../types/track.ts';
import { originalMeta, updatedMeta, useTrackSession } from '../session/session-context.ts';

const tool = routeMeta('/app');

export default function ToolPage() {
  const session = useTrackSession();
  const workspace = useWorkspace();
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
  const active = workspace.tracks.find((item) => item.id === workspace.activeTrackId) ?? null;
  const crateDetail = workspace.viewMode === 'single' && workspace.tracks.length > 1 && Boolean(active);
  const sessionReady = Boolean(crateDetail && active && session.editorTrackId === active.id && track);
  const fields = crateDetail && active ? fieldsFromMetadata(active.currentMetadata) : track?.fields;
  const fileFields = crateDetail && active ? fieldsFromMetadata(active.originalMetadata) : track?.fileFields;
  const coverUrl = crateDetail && active ? active.coverUrl : track?.coverUrl ?? null;
  const peaks = crateDetail && active ? active.waveformPeaks ?? (sessionReady ? track?.peaks ?? null : null) : track?.peaks ?? null;
  const displayName = crateDetail && active ? active.sourceName : track?.name ?? '';
  const playable = workspace.tracks.filter((item) => item.buffer);
  const playIndex = active ? playable.findIndex((item) => item.id === active.id) : -1;

  function showTrack(id: string) {
    const target = workspace.tracks.find((item) => item.id === id);
    if (!target?.buffer) return;
    workspace.openTrack(id);
    session.openLibraryTrack({
      id: target.id,
      sourceName: target.sourceName,
      buffer: target.buffer,
      fields: fieldsFromMetadata(target.currentMetadata),
      original: fieldsFromMetadata(target.originalMetadata),
      remixFrame: target.remixFrame,
      fallback: target.fallback,
    });
  }

  return (
    <div className={dragOver ? 'tool drag-active' : 'tool'}>
      <SiteHead title={tool.title} description={tool.description} path={tool.path} />
      <Atmosphere />
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="appbar">
        <Link to="/" className="logo-link" aria-label="TrackTidy, home">
          <Logo />
        </Link>
        {editing ? <p className="appbar-kicker">Edited result</p> : null}
        <div className="appbar-actions">
          <ProAccount />
          {editing ? (
            <>
              {crateDetail ? null : session.fromLibrary ? (
                <Button variant="secondary" onClick={session.returnToLibrary}>
                  Back to Crate Library
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={session.openCrate}>
                    {PRO_COPY.crate}
                  </Button>
                  <Button variant="secondary" onClick={session.requestClose}>
                    New track
                  </Button>
                </>
              )}
              <Button variant="primary" disabled={!preview.file || session.exporting || (crateDetail && !sessionReady)} onClick={session.onDownload}>
                {session.exporting ? 'Preparing…' : 'Download'}
              </Button>
            </>
          ) : null}
        </div>
      </header>

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

      {session.phase === 'edit' && session.analysisProblem && (!crateDetail || sessionReady) ? (
        <ErrorBanner title="Could not finish analysis" testId="analysis-error" className="page-error">
          {session.analysisProblem}
        </ErrorBanner>
      ) : null}

      {crateDetail && active && editing ? (
        <div className="crate-return">
          <Button variant="secondary" onClick={session.returnToLibrary}>
            Back to Crate Library
          </Button>
          <p className="crate-return-title">{active.currentMetadata.title.trim() || active.sourceName}</p>
          <div className="crate-return-actions">
            <Button variant="secondary" disabled={playIndex <= 0} onClick={() => showTrack(playable[playIndex - 1].id)}>
              Prev
            </Button>
            <Button
              variant="secondary"
              disabled={playIndex < 0 || playIndex >= playable.length - 1}
              onClick={() => showTrack(playable[playIndex + 1].id)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <main id="content" className="workspace">
        {editing && fields && fileFields ? (
          <section className="studio stage-in" key={crateDetail && active ? active.id : 'editor'}>
            <ResultCompare name={displayName} fileFields={fileFields} fields={fields} preview={crateDetail && active ? renderFilename(session.template, fields) : preview} />
            <div className="file-col">
              <div className="file-heading">
                <div>
                  <p className="kicker">File</p>
                  <p className="tech-line">{crateDetail && !sessionReady ? displayName : session.tech}</p>
                </div>
              </div>
              <ArtworkPanel
                previewUrl={coverUrl}
                source={crateDetail && !sessionReady ? (coverUrl ? 'file' : null) : track.coverFrom}
                artist={fields.artist}
                title={fields.title}
                album={fields.album}
                remix={fields.remix}
                busy={session.artworkBusy}
                note={session.artworkNote}
                onApply={session.applyArtwork}
                onRemove={session.removeArtwork}
                onInteract={session.lockArtwork}
              />
              {peaks ? (
                <Waveform peaks={peaks} scanning={session.scanning} label={`Waveform of ${displayName}`} />
              ) : track.waveformError ? (
                <p className="hint hint-danger">{track.waveformError}</p>
              ) : null}
              {session.extraNote === CRATE_MULTI_FLAG ? (
                <CrateNudge onOpen={session.openCrate} />
              ) : session.extraNote ? (
                <p className="hint">{session.extraNote}</p>
              ) : null}
              {session.exportNotice ? <p className="hint">{session.exportNotice}</p> : null}
              {session.keptOnExport.length > 0 ? <p className="hint">Also kept on export: {session.keptOnExport.join(', ')}.</p> : null}
              <p className="hint">The audio stays in this browser and is not uploaded.</p>
            </div>
            <div className="edit-col">
              <MetadataEditor
                fields={fields}
                fileFields={fileFields}
                bpm={crateDetail && !sessionReady ? null : track.analysis.bpm}
                keyEstimate={crateDetail && !sessionReady ? null : track.analysis.key}
                bpmError={crateDetail && !sessionReady ? null : track.analysis.bpmError}
                keyError={crateDetail && !sessionReady ? null : track.analysis.keyError}
                bpmPending={crateDetail && !sessionReady ? false : track.analysis.bpmPending}
                keyPending={crateDetail && !sessionReady ? false : track.analysis.keyPending}
                template={session.template}
                preview={crateDetail && active ? renderFilename(session.template, fields) : preview}
                onField={(key, value) => {
                  if (crateDetail && active) {
                    if (sessionReady) session.updateField(key, value);
                    else {
                      const nextFields = { ...fields, [key]: value };
                      workspace.updateTrack(active.id, {
                        [key]: value,
                        filename: renderFilename(session.template, nextFields).file,
                      });
                    }
                    return;
                  }
                  session.updateField(key, value);
                }}
                onTemplate={session.updateTemplate}
                onDetectBpm={session.rerunBpm}
                onEstimateKey={session.rerunKey}
              />
            </div>
            <ProNudge onTry={session.openCrate} />
          </section>
        ) : !track ? (
          <div className="upload-center">
            <section className="sheet-body editor-empty">
              <p className="kicker kicker-blue">No track in this tab</p>
              <h1>Upload an MP3 to edit it.</h1>
              <p className="lede">
                Refreshing this page clears the editor. Analyzed tracks stay in your crate library.
              </p>
              <FileDrop hot={dragOver} error={session.importError} onFile={session.openFile} />
              {session.extraNote === CRATE_MULTI_FLAG ? <CrateNudge onOpen={session.openCrate} /> : null}
              <p className="editor-home">
                <Link to="/">Back to the homepage</Link>
              </p>
            </section>
          </div>
        ) : null}
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
