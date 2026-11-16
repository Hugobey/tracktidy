import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConsentProvider } from '../src/components/Consent.tsx';
import LibraryPage from '../src/pages/LibraryPage.tsx';

describe('pro library page', () => {
  it('lists demo tracks with cleaned filenames before any personal files are added', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/pro']}>
        <ConsentProvider>
          <LibraryPage />
        </ConsentProvider>
      </MemoryRouter>,
    );
    expect(html).toContain('Rename many tracks at once.');
    expect(html).toContain('Library');
    expect(html).toContain('Demo Pro');
    expect(html).toContain('01_nora_voss_night_circuit_MASTER.mp3');
    expect(html).toContain('nora voss - night circuit (124 BPM) [8A].mp3');
    expect(html).toContain('kian blake - harbour line (free download).mp3');
    expect(html).toContain('Load demo tracks');
    expect(html).toContain('disabled');
  });
});
