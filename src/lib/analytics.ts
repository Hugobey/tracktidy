import { readConsent } from './consent.ts';
import { siteOrigin } from './site.ts';

export const ANALYTICS_EVENTS = [
  'tool_opened',
  'file_upload_started',
  'file_upload_completed',
  'metadata_analysis_completed',
  'metadata_edit_completed',
  'filename_generated',
  'file_downloaded',
  'processing_failed',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const FIELDS = new Set(['artist', 'title', 'remix', 'album', 'genre', 'bpm', 'key']);
const STAGES = new Set(['size', 'read', 'type', 'tags', 'decode', 'export']);
const YES_NO = new Set(['yes', 'no']);

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

export function measurementId(raw: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  if (!/^G-[A-Za-z0-9]+$/.test(id)) return null;
  return id;
}

/** Keeps only allow-listed parameters. File names, tag values, and free text are dropped. */
export function sanitizeEvent(name: string, params?: Record<string, string>): Record<string, string> | null {
  if (!ANALYTICS_EVENTS.includes(name as AnalyticsEvent)) return null;
  if (name === 'metadata_edit_completed') {
    const field = params?.field ?? '';
    if (!FIELDS.has(field)) return null;
    return { field };
  }
  if (name === 'metadata_analysis_completed') {
    const safe: Record<string, string> = {};
    if (params?.bpm_tag && YES_NO.has(params.bpm_tag)) safe.bpm_tag = params.bpm_tag;
    if (params?.key_tag && YES_NO.has(params.key_tag)) safe.key_tag = params.key_tag;
    return safe;
  }
  if (name === 'processing_failed') {
    const stage = params?.stage ?? '';
    if (!STAGES.has(stage)) return null;
    return { stage };
  }
  return {};
}

let startedFor: string | null = null;
let lastEventKey = '';
let lastEventAt = 0;
let lastPage = '';
let lastPageAt = 0;

function gtag(...args: unknown[]) {
  window.dataLayer?.push(args);
}

export function enableAnalytics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const id = measurementId();
  if (!id) return;
  const disabled = `ga-disable-${id}`;
  (window as unknown as Record<string, unknown>)[disabled] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  if (startedFor === id) {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    return;
  }
  startedFor = id;
  gtag('js', new Date());
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('config', id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  script.dataset.purpose = 'analytics';
  document.head.appendChild(script);
}

export function clearAnalyticsCookies(id = measurementId()): void {
  if (!id || typeof document === 'undefined' || typeof window === 'undefined') return;
  const names = ['_ga', '_gid', '_gat', `_ga_${id.slice(2)}`];
  const host = window.location.hostname;
  const domains = ['', host, `.${host}`];
  const parts = host.split('.');
  if (parts.length >= 2) domains.push(`.${parts.slice(-2).join('.')}`);
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
  for (const name of names) {
    for (const domain of domains) {
      const domainAttr = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; expires=${expires}; max-age=0; path=/${domainAttr}`;
    }
  }
}

export function disableAnalytics(): void {
  if (typeof window === 'undefined') return;
  const id = measurementId();
  if (!id) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
  if (startedFor === id && window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
  clearAnalyticsCookies(id);
}

export function trackPageView(pathname: string): void {
  if (readConsent() !== 'accepted') return;
  if (!measurementId()) return;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const now = Date.now();
  if (path === lastPage && now - lastPageAt < 400) return;
  lastPage = path;
  lastPageAt = now;
  enableAnalytics();
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: typeof document === 'undefined' ? '' : document.title,
  });
}

export function trackEvent(name: AnalyticsEvent, params?: Record<string, string>): void {
  const safe = sanitizeEvent(name, params);
  if (!safe) return;
  const key = `${name}:${JSON.stringify(safe)}`;
  const now = Date.now();
  if (key === lastEventKey && now - lastEventAt < 400) return;
  lastEventKey = key;
  lastEventAt = now;
  if (readConsent() !== 'accepted') return;
  if (!measurementId()) return;
  enableAnalytics();
  window.gtag?.('event', name, safe);
}

/** Test hook so page-view dedupe does not leak between cases. */
export function resetAnalyticsForTests(): void {
  startedFor = null;
  lastEventKey = '';
  lastEventAt = 0;
  lastPage = '';
  lastPageAt = 0;
}

export function analyticsConfigured(): boolean {
  return measurementId() !== null && siteOrigin().startsWith('https://');
}
