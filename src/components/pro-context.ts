import { createContext, useContext } from 'react';

export type ProContextValue = {
  pro: boolean;
  demo: boolean;
  devDemo: boolean;
  email: string;
  processCount: number;
  nudgeVisible: boolean;
  modalOpen: boolean;
  portalUrl: string;
  checkoutReady: boolean;
  banner: boolean;
  openUpgrade: () => void;
  closeUpgrade: () => void;
  dismissNudge: () => void;
  dismissBanner: () => void;
  activate: (licenseKey: string) => Promise<string | null>;
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
    modalOpen: false,
    portalUrl: 'https://app.lemonsqueezy.com/my-orders',
    checkoutReady: false,
    banner: false,
    openUpgrade: () => undefined,
    closeUpgrade: () => undefined,
    dismissNudge: () => undefined,
    dismissBanner: () => undefined,
    activate: async () => 'Pro is not available on this screen.',
    restore: async () => 'Pro restore is not connected on this build yet.',
    startCheckout: () => 'Checkout is not connected on this build yet.',
    signOut: () => undefined,
    toggleDemo: () => undefined,
  };
}
