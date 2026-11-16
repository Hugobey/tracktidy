import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/syne/600.css';
import '@fontsource/syne/700.css';
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';
import './styles/guides.css';
import App from './App.tsx';
import { disableAnalytics } from './lib/analytics.ts';
import { applyDeviceQuery, isOwnerDevice } from './lib/device.ts';
import { applyProQuery } from './lib/pro.ts';
import { stopPostHog } from './lib/posthog-client.ts';

applyDeviceQuery();
applyProQuery();
if (isOwnerDevice()) {
  disableAnalytics();
  stopPostHog();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
