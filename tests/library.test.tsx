import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConsentProvider } from '../src/components/Consent.tsx';
import { WorkspaceProvider } from '../src/context/WorkspaceContext.tsx';
import LibraryPage from '../src/pages/LibraryPage.tsx';

describe('pro library page', () => {
  it('lists demo tracks with cleaned filenames before any personal files are added', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/pro']}>
        <ConsentProvider>
          <WorkspaceProvider>
            <LibraryPage />
          </WorkspaceProvider>
        </ConsentProvider>
      </MemoryRouter>,
    );
    expect(html).toContain('Your crate.');
    expect(html).toContain('Library');
    expect(html).toContain('Demo Pro');
    expect(html).toContain('All Tracks');
    expect(html).toContain('Cleaned');
    expect(html).toContain('Needs Review');
    expect(html).toContain('01_nora_voss_night_circuit_MASTER.mp3');
    expect(html).toContain('Nora Voss - Night Circuit [124 BPM] [8A].mp3');
    expect(html).not.toContain('Nora Voss - Night Circuit (124 BPM) [8A].mp3');
    expect(html).toContain('kian blake - harbour line (free download).mp3');
    expect(html).toContain('Harbour Line');
    expect(html).toContain('Load demo tracks');
    expect(html).toContain('Download Crate ZIP');
    expect(html).toContain('Undo');
    expect(html).toContain('Redo');
    expect(html).toContain('Select all tracks');
    expect(html).toContain('<svg');
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('class="lib-edit"');
    expect(html).not.toContain('>Remove<');
  });
});
