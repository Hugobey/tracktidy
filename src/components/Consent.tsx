import { useMemo, useState, type ReactNode } from 'react';
import { disableAnalytics, enableAnalytics } from '../lib/analytics.ts';
import { readConsent, writeConsent, type ConsentStatus } from '../lib/consent.ts';
import { ConsentContext, type ConsentContextValue } from './consent-context.ts';

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus>(() => readConsent());
  const [panelOpen, setPanelOpen] = useState(() => readConsent() === 'unknown');

  const value = useMemo<ConsentContextValue>(
    () => ({
      status,
      panelOpen,
      accept: () => {
        writeConsent('accepted');
        enableAnalytics();
        setStatus('accepted');
        setPanelOpen(false);
      },
      reject: () => {
        writeConsent('rejected');
        disableAnalytics();
        setStatus('rejected');
        setPanelOpen(false);
      },
      openSettings: () => setPanelOpen(true),
      closeSettings: () => {
        if (readConsent() === 'unknown') return;
        setPanelOpen(false);
      },
    }),
    [panelOpen, status],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
