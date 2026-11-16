export const PROCESS_COUNT_KEY = 'tt_process_count';
export const PRO_FLAG_KEY = 'tt_user_pro';
export const LICENSE_KEY = 'tt_license_key';
export const EMAIL_KEY = 'tt_user_email';
export const INSTANCE_ID_KEY = 'tt_license_instance';
export const INSTANCE_NAME_KEY = 'tt_license_instance_name';
export const NUDGE_LATER_KEY = 'tt_nudge_later';
export const DEMO_KEY = 'tt_demo_pro';

export const PRO_TRY_LIMIT = 2;

const CHANGE = 'tracktidy-pro';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const PRO_COPY = {
  nudgeTitle: 'Prepping a full crate? Unlock Bulk Visual Tag Editing.',
  nudgeBody:
    'Edit ID3 tags inline across all tracks, strip promo junk in one click, and build custom filename templates.',
  nudgeAction: 'Unlock Pro Preview',
  nudgeLater: 'Maybe later',
  modalTitle: 'Unlock the Crate Grid & Bulk Metadata Editor',
  modalBody: 'Enter your email to activate Pro via Lemon Squeezy, or enter an existing license key.',
  emailPlaceholder: 'dj@example.com',
  checkout: 'Continue to Checkout',
  licenseLabel: 'Already have a license key? Activate here',
  licenseAction: 'Activate',
  upgrade: 'Upgrade to Pro',
  active: 'Pro Active',
  billing: 'Manage billing',
  signOut: 'Sign out of this browser',
  demo: 'Demo Pro Mode',
  crate: 'Crate view',
  hideCrate: 'Hide crate',
  strip: 'Strip URLs & Promo Tags',
  titleCase: 'Title Case All',
  downloadZip: 'Download ZIP',
} as const;

export function copyHasDash(value: string): boolean {
  return value.includes('\u2014') || value.includes('\u2013') || value.includes('--');
}

function browserStore(kind: 'local' | 'session'): Store | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readCount(storage: Store | null): number {
  const raw = storage?.getItem(PROCESS_COUNT_KEY);
  const count = raw ? Number(raw) : 0;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function notifyProChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGE));
}

export function onProChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(CHANGE, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGE, listener);
    window.removeEventListener('storage', listener);
  };
}

export function recordCompletedProcess(storage: Store | null = browserStore('local')): number {
  const next = readCount(storage) + 1;
  try {
    storage?.setItem(PROCESS_COUNT_KEY, String(next));
  } catch {
    /* The count is only a local nudge. The edit still stands. */
  }
  if (storage === browserStore('local')) notifyProChange();
  return next;
}

export type ProSnapshot = {
  pro: boolean;
  demo: boolean;
  email: string;
  licenseKey: string;
  instanceId: string;
  processCount: number;
  nudgeLater: boolean;
};

export function readProSnapshot(
  local: Store | null = browserStore('local'),
  session: Store | null = browserStore('session'),
): ProSnapshot {
  const licenseKey = local?.getItem(LICENSE_KEY)?.trim() ?? '';
  const flagged = local?.getItem(PRO_FLAG_KEY) === 'true' && licenseKey.length > 0;
  const demo = session?.getItem(DEMO_KEY) === '1';
  return {
    pro: flagged || demo,
    demo,
    email: local?.getItem(EMAIL_KEY)?.trim() ?? '',
    licenseKey,
    instanceId: local?.getItem(INSTANCE_ID_KEY)?.trim() ?? '',
    processCount: readCount(local),
    nudgeLater: session?.getItem(NUDGE_LATER_KEY) === '1',
  };
}

export function isProUser(): boolean {
  return readProSnapshot().pro;
}

export function saveProLicense(input: { key: string; email: string; instanceId: string }, storage: Store | null = browserStore('local')): void {
  try {
    storage?.setItem(PRO_FLAG_KEY, 'true');
    storage?.setItem(LICENSE_KEY, input.key);
    storage?.setItem(INSTANCE_ID_KEY, input.instanceId);
    if (input.email) storage?.setItem(EMAIL_KEY, input.email);
  } catch {
    /* Private mode can reject storage. This page still unlocks until reload. */
  }
  if (storage === browserStore('local')) notifyProChange();
}

export function saveEmail(email: string, storage: Store | null = browserStore('local')): void {
  try {
    storage?.setItem(EMAIL_KEY, email);
  } catch {
    /* The checkout redirect still carries the address. */
  }
}

export function instanceName(storage: Store | null = browserStore('local')): string {
  const existing = storage?.getItem(INSTANCE_NAME_KEY)?.trim() ?? '';
  if (/^tt-[a-z0-9-]{12,}$/.test(existing)) return existing;
  const name = `tt-${crypto.randomUUID()}`;
  try {
    storage?.setItem(INSTANCE_NAME_KEY, name);
  } catch {
    /* A new name is used for this attempt only. */
  }
  return name;
}

export function clearProLicense(storage: Store | null = browserStore('local'), session: Store | null = browserStore('session')): void {
  try {
    storage?.removeItem(PRO_FLAG_KEY);
    storage?.removeItem(LICENSE_KEY);
    storage?.removeItem(INSTANCE_ID_KEY);
    storage?.removeItem(EMAIL_KEY);
    session?.removeItem(DEMO_KEY);
  } catch {
    /* The in-memory screen still closes Pro for this click. */
  }
  if (storage === browserStore('local')) notifyProChange();
}

export function dismissNudge(session: Store | null = browserStore('session')): void {
  try {
    session?.setItem(NUDGE_LATER_KEY, '1');
  } catch {
    /* The card can still close for this render. */
  }
  notifyProChange();
}

export function setDemoPro(on: boolean, session: Store | null = browserStore('session')): void {
  try {
    if (on) session?.setItem(DEMO_KEY, '1');
    else session?.removeItem(DEMO_KEY);
  } catch {
    /* Demo mode is only a local testing switch. */
  }
  notifyProChange();
}

export function nudgeVisible(snapshot: ProSnapshot = readProSnapshot()): boolean {
  return !snapshot.pro && !snapshot.nudgeLater && snapshot.processCount >= PRO_TRY_LIMIT;
}
