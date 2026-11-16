/** A project key is public in the browser. An empty or unconfigured value leaves PostHog off. */
export function posthogKey(raw: string | undefined = import.meta.env.VITE_POSTHOG_KEY): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  return key && key !== 'phc_your_project_token' ? key : null;
}

export function posthogHost(raw: string | undefined = import.meta.env.VITE_POSTHOG_HOST): string | null {
  if (typeof raw !== 'string') return null;
  const host = raw.trim();
  return host && host !== 'https://your-posthog-host' ? host : null;
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
