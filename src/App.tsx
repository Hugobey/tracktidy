import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ConsentBanner } from './components/ConsentBanner.tsx';
import { ConsentProvider } from './components/Consent.tsx';
import { VercelAnalytics } from './components/VercelAnalytics.tsx';
import LandingPage from './pages/LandingPage.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';
import ToolPage from './pages/ToolPage.tsx';
import { TrackSessionProvider } from './session/TrackSession.tsx';
const LegalNoticePage = lazy(() => import('./pages/LegalNoticePage.tsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.tsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.tsx'));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage.tsx'));
const GuidesIndexPage = lazy(() => import('./pages/GuidesIndexPage.tsx'));
const GuidePage = lazy(() => import('./pages/GuidePage.tsx'));

function PageFallback({ label }: { label: string }) {
  return (
    <main className="processing">
      <p className="kicker">TrackTidy</p>
      <h1>{label}</h1>
    </main>
  );
}

function lazyPage(node: ReactNode, label: string) {
  return <Suspense fallback={<PageFallback label={label} />}>{node}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ConsentProvider>
        <TrackSessionProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<ToolPage />} />
            <Route path="/legal-notice" element={lazyPage(<LegalNoticePage />, 'Opening the page')} />
            <Route path="/privacy-policy" element={lazyPage(<PrivacyPage />, 'Opening the page')} />
            <Route path="/terms-of-use" element={lazyPage(<TermsPage />, 'Opening the page')} />
            <Route path="/cookie-policy" element={lazyPage(<CookiePolicyPage />, 'Opening the page')} />
            <Route path="/guides" element={lazyPage(<GuidesIndexPage />, 'Opening guides')} />
            <Route path="/guides/:slug" element={lazyPage(<GuidePage />, 'Opening the guide')} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <VercelAnalytics />
          <ConsentBanner />
        </TrackSessionProvider>
      </ConsentProvider>
    </BrowserRouter>
  );
}
