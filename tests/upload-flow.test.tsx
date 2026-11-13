import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConsentProvider } from '../src/components/Consent.tsx';
import LandingPage from '../src/pages/LandingPage.tsx';
import ToolPage from '../src/pages/ToolPage.tsx';
import { TrackSessionProvider } from '../src/session/TrackSession.tsx';

function render(path: string, page: 'home' | 'editor'): string {
  const element = page === 'home' ? <LandingPage /> : <ToolPage />;
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <ConsentProvider>
        <TrackSessionProvider>{element}</TrackSessionProvider>
      </ConsentProvider>
    </MemoryRouter>,
  );
}

describe('upload first landing', () => {
  it('puts the MP3 drop zone in the hero and keeps the before/after preview', () => {
    const html = render('/', 'home');
    expect(html).toContain('Your tracks.');
    expect(html).toContain('Perfectly organized.');
    expect(html).toContain('Clean metadata. Detect BPM. Rename your tracks.');
    expect(html).toContain('Drop an MP3 here');
    expect(html).toContain('type="file"');
    expect(html).toContain('y2mate.com_Nora Voss_Night Circuit');
    expect(html).toContain('Nora Voss - Night Circuit.mp3');
    expect(html).toContain('id="upload"');
    expect(html).not.toContain('role="dialog"');
    expect(html.indexOf('Drop an MP3 here')).toBeLessThan(html.indexOf('Nora Voss - Night Circuit.mp3'));
  });
});

describe('editor without a file', () => {
  it('explains that a refresh clears the track and offers another upload', () => {
    const html = render('/app', 'editor');
    expect(html).toContain('No track in this tab');
    expect(html).toContain('Refreshing this page clears the file.');
    expect(html).toContain('href="/"');
    expect(html).toContain('Drop an MP3 here');
    expect(html).not.toContain('Cleaned result');
  });
});
