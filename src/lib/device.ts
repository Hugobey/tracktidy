/** First-party marker. It is not a secret. A browser that stores it is left out of analytics. */
export const DEVICE_KEY = 'tracktidy.device';
export const DEVICE_QUERY = 'tt-device';
export const OWNER_VALUE = 'owner';

const MAX_AGE = 60 * 60 * 24 * 365 * 10;

type DeviceFlag = 'owner' | 'clear';

let ownerForTests: boolean | null = null;

/** Test hook. Production reads local storage and the first-party cookie. */
export function setOwnerDeviceForTests(value: boolean | null): void {
  ownerForTests = value;
}

export function deviceFlag(search: string): DeviceFlag | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const flag = params.get(DEVICE_QUERY);
  if (flag === 'owner' || flag === 'clear') return flag;
  return null;
}

export function readOwnerMarker(stored: string | null, cookieHeader: string | null): boolean {
  if (stored === OWNER_VALUE) return true;
  if (!cookieHeader) return false;
  return cookieHeader.split(';').some((part) => {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) return false;
    if (trimmed.slice(0, eq) !== DEVICE_KEY) return false;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw) === OWNER_VALUE;
    } catch {
      return raw === OWNER_VALUE;
    }
  });
}

export function ownerCookie(secure: boolean): string {
  const secureAttr = secure ? '; Secure' : '';
  return `${DEVICE_KEY}=${OWNER_VALUE}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secureAttr}`;
}

export function expiredOwnerCookie(domain?: string): string {
  const domainAttr = domain ? `; Domain=${domain}` : '';
  return `${DEVICE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${domainAttr}`;
}

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function cookieHeader(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    return document.cookie;
  } catch {
    return null;
  }
}

function writeCookie(value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = value;
}

export function isOwnerDevice(): boolean {
  if (ownerForTests !== null) return ownerForTests;
  try {
    return readOwnerMarker(browserStorage()?.getItem(DEVICE_KEY) ?? null, cookieHeader());
  } catch {
    return false;
  }
}

export function rememberOwnerDevice(): void {
  try {
    browserStorage()?.setItem(DEVICE_KEY, OWNER_VALUE);
  } catch {
    /* Private mode can reject storage. The cookie still marks the browser. */
  }
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  writeCookie(ownerCookie(secure));
}

export function forgetOwnerDevice(): void {
  try {
    browserStorage()?.removeItem(DEVICE_KEY);
  } catch {
    /* The cookie clear below still runs. */
  }
  writeCookie(expiredOwnerCookie());
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  writeCookie(expiredOwnerCookie(host));
  writeCookie(expiredOwnerCookie(`.${host}`));
  const parts = host.split('.');
  if (parts.length >= 2) writeCookie(expiredOwnerCookie(`.${parts.slice(-2).join('.')}`));
}

/** Reads `tt-device` once, then drops it from the address bar. Syncs the two stores. */
export function applyDeviceQuery(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const flag = deviceFlag(url.search);
  if (flag === 'owner') rememberOwnerDevice();
  else if (flag === 'clear') forgetOwnerDevice();
  else if (isOwnerDevice()) rememberOwnerDevice();
  if (!flag) return;
  url.searchParams.delete(DEVICE_QUERY);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}
