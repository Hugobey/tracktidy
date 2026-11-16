import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  checkoutConfigured,
  confirmLicense,
  deactivateLicense,
  lemonCheckoutUrl,
  lemonPortalUrl,
  licenseShouldLock,
  validateStoredLicense,
} from '../lib/lemonsqueezy.ts';
import {
  clearProLicense,
  dismissNudge as storeDismiss,
  instanceName,
  nudgeVisible,
  onProChange,
  readProSnapshot,
  saveEmail,
  saveProLicense,
  setDemoPro,
} from '../lib/pro.ts';
import { ProContext, type ProContextValue } from './pro-context.ts';
import { UpgradeModal } from './UpgradeModal.tsx';

export function ProProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => onProChange(() => setRevision((value) => value + 1)), []);

  useEffect(() => {
    const current = readProSnapshot();
    if (!current.licenseKey || !current.instanceId || current.demo) return undefined;
    let cancelled = false;
    void validateStoredLicense(current.licenseKey, current.instanceId).then((result) => {
      if (cancelled || result.ok) return;
      if (!licenseShouldLock(result.message)) return;
      clearProLicense();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ProContextValue>(() => {
    const current = readProSnapshot();
    const open = modalOpen;
    void revision;
    return {
      pro: current.pro,
      demo: current.demo,
      devDemo: import.meta.env.DEV,
      email: current.email,
      processCount: current.processCount,
      nudgeVisible: nudgeVisible(current),
      modalOpen: open,
      portalUrl: lemonPortalUrl(),
      checkoutReady: checkoutConfigured(),
      openUpgrade: () => setModalOpen(true),
      closeUpgrade: () => setModalOpen(false),
      dismissNudge: () => storeDismiss(),
      activate: async (licenseKey: string) => {
        const result = await confirmLicense(licenseKey, instanceName(), current.instanceId);
        if (!result.ok) return result.message;
        saveProLicense({
          key: result.key,
          email: result.email || current.email,
          instanceId: result.instanceId || current.instanceId,
        });
        return null;
      },
      startCheckout: (email: string) => {
        const url = lemonCheckoutUrl(import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL, email);
        if (!url) return 'Checkout is not connected on this build yet.';
        saveEmail(email);
        window.location.assign(url);
        return null;
      },
      signOut: () => {
        const leaving = readProSnapshot();
        if (leaving.licenseKey && leaving.instanceId) void deactivateLicense(leaving.licenseKey, leaving.instanceId);
        clearProLicense();
        setModalOpen(false);
      },
      toggleDemo: () => setDemoPro(!current.demo),
    };
  }, [modalOpen, revision]);

  return (
    <ProContext.Provider value={value}>
      {children}
      <UpgradeModal />
    </ProContext.Provider>
  );
}
