import { readConsent } from './consent.ts';
import { isOwnerDevice } from './device.ts';
import { isLocalAnalyticsHost } from './analytics.ts';
import { posthogKey } from './posthog-config.ts';

/** PostHog sets a cookie, so it waits for Accept. Loopback and the publisher device never send. */
export function posthogCaptureAllowed(): boolean {
  if (!posthogKey()) return false;
  if (isOwnerDevice()) return false;
  if (typeof window !== 'undefined' && isLocalAnalyticsHost(window.location.hostname)) return false;
  return readConsent() === 'accepted';
}
