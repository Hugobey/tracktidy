import { createContext, useContext } from 'react';

export type ProContextValue = {
  pro: boolean;
  email: string;
  processCount: number;
  nudgeVisible: boolean;
  nudgeLater: boolean;
  modalOpen: boolean;
  checkoutReady: boolean;
  banner: boolean;
  checkoutToast: boolean;
  upgradeNote: string | null;
  openUpgrade: (message?: string) => void;
  closeUpgrade: () => void;
  dismissNudge: () => void;
  dismissBanner: () => void;
  dismissCheckoutToast: () => void;
  restore: (email: string) => Promise<string | null>;
  startCheckout: (email: string) => string | null;
  signOut: () => void;
};

export const ProContext = createContext<ProContextValue | null>(null);

export function usePro(): ProContextValue {
  const value = useContext(ProContext);
  if (value) return value;
  return {
    pro: false,
    email: '',
    processCount: 0,
    nudgeVisible: false,
    nudgeLater: false,
    modalOpen: false,
    checkoutReady: false,
    banner: false,
    checkoutToast: false,
    upgradeNote: null,
    openUpgrade: () => undefined,
    closeUpgrade: () => undefined,
    dismissNudge: () => undefined,
    dismissBanner: () => undefined,
    dismissCheckoutToast: () => undefined,
    restore: async () => 'Pro restore is not connected on this build yet.',
    startCheckout: () => 'Checkout is not connected on this build yet.',
    signOut: () => undefined,
  };
}
