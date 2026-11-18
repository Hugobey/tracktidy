import { createContext, useContext } from 'react';

export type ProContextValue = {
  pro: boolean;
  demo: boolean;
  devDemo: boolean;
  email: string;
  processCount: number;
  nudgeVisible: boolean;
  nudgeLater: boolean;
  modalOpen: boolean;
  checkoutReady: boolean;
  banner: boolean;
  upgradeNote: string | null;
  openUpgrade: (message?: string) => void;
  closeUpgrade: () => void;
  dismissNudge: () => void;
  dismissBanner: () => void;
  restore: (email: string) => Promise<string | null>;
  startCheckout: (email: string) => string | null;
  signOut: () => void;
  toggleDemo: () => void;
};

export const ProContext = createContext<ProContextValue | null>(null);

export function usePro(): ProContextValue {
  const value = useContext(ProContext);
  if (value) return value;
  return {
    pro: false,
    demo: false,
    devDemo: import.meta.env.DEV,
    email: '',
    processCount: 0,
    nudgeVisible: false,
    nudgeLater: false,
    modalOpen: false,
    checkoutReady: false,
    banner: false,
    upgradeNote: null,
    openUpgrade: () => undefined,
    closeUpgrade: () => undefined,
    dismissNudge: () => undefined,
    dismissBanner: () => undefined,
    restore: async () => 'Pro restore is not connected on this build yet.',
    startCheckout: () => 'Checkout is not connected on this build yet.',
    signOut: () => undefined,
    toggleDemo: () => undefined,
  };
}
