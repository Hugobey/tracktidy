export const CONSENT_KEY = 'tracktidy.consent';

export type ConsentStatus = 'accepted' | 'rejected' | 'unknown';

type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): ConsentStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readConsent(storage: ConsentStorage | null = browserStorage()): ConsentStatus {
  try {
    const value = storage?.getItem(CONSENT_KEY);
    if (value === 'accepted' || value === 'rejected') return value;
  } catch {
    /* Storage can throw in private mode. Treat that as no choice. */
  }
  return 'unknown';
}

export function writeConsent(status: Exclude<ConsentStatus, 'unknown'>, storage: ConsentStorage | null = browserStorage()): void {
  try {
    storage?.setItem(CONSENT_KEY, status);
  } catch {
    /* The choice still applies for this page view. */
  }
}
