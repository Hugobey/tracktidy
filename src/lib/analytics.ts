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

/** Stream installed in the published GTM container. An explicit G- ID overrides it. */
export const PUBLISHED_MEASUREMENT_ID = 'G-1DQDF61KJW';

/** Loopback names only. A public visit still reaches analytics from the visitor’s connection. */
export function isLocalAnalyticsHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' || host.endsWith('.localhost');
}

function onLocalPage(): boolean {
  return typeof window !== 'undefined' && isLocalAnalyticsHost(window.location.hostname);
}

export function measurementId(raw: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return PUBLISHED_MEASUREMENT_ID;
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

let lastEventKey = '';
let lastEventAt = 0;
let lastPage = '';
let lastPageAt = 0;
let hitSeq = 0;
let sessionId = '';

/** GA4 collect query. The installed container does not forward gtag events. */
export function buildCollectQuery(
  id: string,
  name: string,
  params: Record<string, string>,
  page: { location: string; title: string },
  ids: { cid: string; sid: string; seq: number },
): string {
  const query = new URLSearchParams({
    v: '2',
    tid: id,
    cid: ids.cid,
    sid: ids.sid,
    sct: '1',
    seg: '1',
    _s: String(ids.seq),
    en: name,
    dl: page.location,
    dt: page.title,
  });
  for (const [key, value] of Object.entries(params)) query.set(`ep.${key}`, value);
  return query.toString();
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const row = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : null;
}

function clientId(): string {
  const parts = readCookie('_ga')?.split('.') ?? [];
  if (parts.length >= 4 && parts[2] && parts[3]) return `${parts[2]}.${parts[3]}`;
  const cid = `${Math.floor(1_000_000_000 + Math.random() * 9_000_000_000)}.${Math.floor(Date.now() / 1000)}`;
  document.cookie = `_ga=GA1.1.${cid}; path=/; max-age=63072000; SameSite=Lax`;
  return cid;
}

function sendCollect(name: string, params: Record<string, string>, page: { location: string; title: string }): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || onLocalPage()) return;
  const id = measurementId();
  if (!id) return;
  if (!sessionId) sessionId = String(Math.floor(Date.now() / 1000));
  hitSeq += 1;
  const query = buildCollectQuery(id, name, params, page, { cid: clientId(), sid: sessionId, seq: hitSeq });
  void fetch(`https://www.google-analytics.com/g/collect?${query}`, {
    method: 'POST',
    mode: 'no-cors',
    keepalive: true,
  }).catch(() => undefined);
}

export function enableAnalytics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const id = measurementId();
  if (!id) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false;
  clientId();
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
  clearAnalyticsCookies(id);
}

export function trackPageView(pathname: string): void {
  if (onLocalPage()) return;
  if (readConsent() !== 'accepted') return;
  if (!measurementId()) return;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const now = Date.now();
  if (path === lastPage && now - lastPageAt < 400) return;
  lastPage = path;
  lastPageAt = now;
  enableAnalytics();
  if (typeof window === 'undefined') return;
  sendCollect('page_view', { page_path: path }, {
    location: `${window.location.origin}${path}`,
    title: typeof document === 'undefined' ? '' : document.title,
  });
}

export function trackEvent(name: AnalyticsEvent, params?: Record<string, string>): void {
  const safe = sanitizeEvent(name, params);
  if (!safe) return;
  if (onLocalPage()) return;
  if (readConsent() !== 'accepted') return;
  if (!measurementId()) return;
  const key = `${name}:${JSON.stringify(safe)}`;
  const now = Date.now();
  if (key === lastEventKey && now - lastEventAt < 400) return;
  lastEventKey = key;
  lastEventAt = now;
  enableAnalytics();
  sendCollect(name, safe, {
    location: typeof window === 'undefined' ? '' : window.location.href.split('#')[0].split('?')[0] ?? '',
    title: typeof document === 'undefined' ? '' : document.title,
  });
}

/** Test hook so page-view dedupe does not leak between cases. */
export function resetAnalyticsForTests(): void {
  lastEventKey = '';
  lastEventAt = 0;
  lastPage = '';
  lastPageAt = 0;
  hitSeq = 0;
  sessionId = '';
}

export function analyticsConfigured(): boolean {
  return measurementId() !== null && siteOrigin().startsWith('https://');
}
