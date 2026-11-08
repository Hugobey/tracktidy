import { createContext, useContext } from 'react';
import type { ConsentStatus } from '../lib/consent.ts';

export type ConsentContextValue = {
  status: ConsentStatus;
  panelOpen: boolean;
  accept: () => void;
  reject: () => void;
  openSettings: () => void;
  closeSettings: () => void;
};

export const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used inside ConsentProvider');
  return value;
}
