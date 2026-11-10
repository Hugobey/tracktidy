import type { BeforeSendEvent } from '@vercel/analytics/react';

/** Drops query strings and hashes so a page view is only the path. */
export function redactAnalyticsUrl(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}
