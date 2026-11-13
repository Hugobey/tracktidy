import type { BeforeSendEvent } from '@vercel/analytics/react';
import { isLocalAnalyticsHost } from './analytics.ts';

/** Drops query strings and hashes so a page view is only the path. Local hosts are not sent. */
export function redactAnalyticsUrl(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (isLocalAnalyticsHost(url.hostname)) return null;
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}
