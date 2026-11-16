const reportedMissingVariables = new Set<string>();

function reportMissingPostHogVariable(name: string): void {
  if (!import.meta.env.DEV || reportedMissingVariables.has(name)) return;
  reportedMissingVariables.add(name);
  console.error(
    new Error(
      `${name} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${name} is configured`,
    ),
  );
}

export function posthogKey(raw: string | undefined = import.meta.env.VITE_POSTHOG_KEY): string | null {
  const key = raw?.trim();
  if (!key) {
    reportMissingPostHogVariable('VITE_POSTHOG_KEY');
    return null;
  }
  return key;
}

export function posthogHost(raw: string | undefined = import.meta.env.VITE_POSTHOG_HOST): string | null {
  const host = raw?.trim();
  if (!host) {
    reportMissingPostHogVariable('VITE_POSTHOG_HOST');
    return null;
  }
  return host;
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
