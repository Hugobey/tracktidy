import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearProLicense,
  dismissNudge as storeDismiss,
  dismissProBanner,
  LIBRARY_ENTRY_KEY,
  nudgeVisible,
  onProChange,
  readProSnapshot,
  saveEmail,
  setProEnabled,
} from '../lib/pro.ts';
import { stripeCheckoutConfigured, stripePaymentUrl } from '../lib/stripe.ts';
import { trackEvent } from '../lib/analytics.ts';
import { identifyPostHogUser, resetPostHogIdentity } from '../lib/posthog-client.ts';
import { ProContext, type ProContextValue } from './pro-context.ts';
import { ProBanner } from './ProBanner.tsx';
import { UpgradeModal } from './UpgradeModal.tsx';

export function ProProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [upgradeNote, setUpgradeNote] = useState<string | null>(null);

  useEffect(() => onProChange(() => setRevision((value) => value + 1)), []);

  useEffect(() => {
    let openLibrary = false;
    try {
      openLibrary = sessionStorage.getItem(LIBRARY_ENTRY_KEY) === '1';
      if (openLibrary) sessionStorage.removeItem(LIBRARY_ENTRY_KEY);
    } catch {
      return;
    }
    if (openLibrary && window.location.pathname !== '/pro') navigate('/pro', { replace: true });
  }, [navigate]);

  useEffect(() => {
    const current = readProSnapshot();
    if (!current.pro || current.demo || !current.instanceId) return;
    identifyPostHogUser(`license_instance:${current.instanceId}`, {
      ...(current.email ? { email: current.email } : {}),
      plan: 'pro',
    });
  }, [revision]);

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
      nudgeLater: current.nudgeLater,
      modalOpen: open,
      checkoutReady: stripeCheckoutConfigured(),
      banner: current.banner,
      upgradeNote,
      openUpgrade: (message?: string) => {
        trackEvent('upgrade_modal_opened');
        setUpgradeNote(message?.trim() ? message : null);
        setModalOpen(true);
      },
      closeUpgrade: () => {
        setModalOpen(false);
        setUpgradeNote(null);
      },
      dismissNudge: () => storeDismiss(),
      dismissBanner: () => dismissProBanner(),
      restore: async (email: string) => {
        saveEmail(email);
        try {
          const response = await fetch(`/api/check-pro?email=${encodeURIComponent(email)}`);
          const body: unknown = await response.json().catch(() => null);
          const data = body && typeof body === 'object' ? (body as { pro?: boolean; error?: string }) : {};
          if (data.pro === true) {
            setProEnabled(true);
            trackEvent('pro_restored');
            return null;
          }
          if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
          return 'No paid Pro purchase was found for that email.';
        } catch {
          return 'Stripe could not be reached. Try again.';
        }
      },
      startCheckout: (email: string) => {
        const url = stripePaymentUrl(email);
        if (!url) return 'Checkout is not connected on this build yet.';
        saveEmail(email);
        trackEvent('pro_checkout_started');
        window.location.assign(url);
        return null;
      },
      signOut: () => {
        trackEvent('pro_signed_out');
        clearProLicense();
        resetPostHogIdentity();
        setModalOpen(false);
        setUpgradeNote(null);
      },
      toggleDemo: () => {
        const next = !readProSnapshot().pro;
        setProEnabled(next);
        if (next) navigate('/pro');
      },
    };
  }, [modalOpen, navigate, revision, upgradeNote]);

  return (
    <ProContext.Provider value={value}>
      {children}
      <ProBanner />
      <UpgradeModal />
    </ProContext.Provider>
  );
}
