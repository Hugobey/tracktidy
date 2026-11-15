export const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

/** A project key is public in the browser. An empty or invalid value leaves PostHog off. */
export function posthogKey(raw: string | undefined = import.meta.env.VITE_POSTHOG_KEY): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (!/^phc_[A-Za-z0-9]{10,}$/.test(key)) return null;
  return key;
}

export function posthogHost(raw: string | undefined = import.meta.env.VITE_POSTHOG_HOST): string {
  if (typeof raw !== 'string' || raw.trim() === '') return DEFAULT_POSTHOG_HOST;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') return DEFAULT_POSTHOG_HOST;
    return url.origin;
  } catch {
    return DEFAULT_POSTHOG_HOST;
  }
}

/** Drops a query string and hash so a page view is only the path. */
export function stripUrlQuery(value: string): string {
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    const withoutHash = value.split('#')[0] ?? value;
    return withoutHash.split('?')[0] ?? value;
  }
}
