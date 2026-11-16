export const PROCESS_COUNT_KEY = 'tt_process_count';
export const PRO_FLAG_KEY = 'tt_user_pro';
export const LICENSE_KEY = 'tt_license_key';
export const EMAIL_KEY = 'tt_user_email';
export const INSTANCE_ID_KEY = 'tt_license_instance';
export const INSTANCE_NAME_KEY = 'tt_license_instance_name';
export const NUDGE_LATER_KEY = 'tt_nudge_later';
export const DEMO_KEY = 'tt_demo_pro';
export const CRATE_OPEN_KEY = 'tt_crate_open';
export const BANNER_KEY = 'tt_pro_banner';
export const LIBRARY_ENTRY_KEY = 'tt_library_entry';

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
  modalBody: 'Enter your email to continue to Stripe, or restore a purchase you already made.',
  emailPlaceholder: 'dj@example.com',
  checkout: 'Continue to Checkout',
  restoreLabel: 'Already purchased Pro? Restore with your email',
  restoreAction: 'Restore Pro',
  upgrade: 'Upgrade to Pro',
  active: 'Pro Active',
  billing: 'Manage billing',
  signOut: 'Sign out of this browser',
  demo: 'Demo Pro',
  banner: 'Track Tidy Pro unlocked',
  library: 'Library',
  libraryTitle: 'Rename many tracks at once.',
  libraryBody: 'Same editor as one track, for a whole list. Clean the names, then download one ZIP.',
  libraryDemoNote: 'Demo tracks are standing in so you can try the list. Drop your own MP3s to replace them.',
  libraryLocked: 'Demo Pro unlocks editing on this browser.',
  libraryEmpty: 'No tracks in this library yet.',
  libraryDrop: 'Drop MP3s here',
  libraryBrowse: 'Or press to browse. Up to 24 tracks, in this browser.',
  libraryAdd: 'Add MP3s',
  libraryFolder: 'Add a folder',
  libraryLoad: 'Load demo tracks',
  libraryClear: 'Clear library',
  libraryStay: 'Files stay in this browser. Nothing is uploaded.',
  libraryLoading: 'Tracks are still loading.',
  libraryUnread: 'Demo tracks could not be read. Add your own MP3s instead.',
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
  banner: boolean;
};

export function readProSnapshot(
  local: Store | null = browserStore('local'),
  session: Store | null = browserStore('session'),
): ProSnapshot {
  const licenseKey = local?.getItem(LICENSE_KEY)?.trim() ?? '';
  const flagged = local?.getItem(PRO_FLAG_KEY) === 'true';
  return {
    pro: flagged,
    demo: session?.getItem(DEMO_KEY) === '1',
    email: local?.getItem(EMAIL_KEY)?.trim() ?? '',
    licenseKey,
    instanceId: local?.getItem(INSTANCE_ID_KEY)?.trim() ?? '',
    processCount: readCount(local),
    nudgeLater: session?.getItem(NUDGE_LATER_KEY) === '1',
    banner: session?.getItem(BANNER_KEY) === '1',
  };
}

export function setProEnabled(on: boolean, storage: Store | null = browserStore('local')): void {
  try {
    if (on) storage?.setItem(PRO_FLAG_KEY, 'true');
    else storage?.removeItem(PRO_FLAG_KEY);
  } catch {
    /* Private mode can reject storage. This page still updates until reload. */
  }
  if (storage === browserStore('local')) notifyProChange();
}

export function dismissProBanner(session: Store | null = browserStore('session')): void {
  try {
    session?.removeItem(BANNER_KEY);
  } catch {
    /* The banner can still close for this render. */
  }
  notifyProChange();
}

/** Applies `demo` and `pro_success` once, then removes them from the address bar. */
export function applyProQuery(
  href = typeof window === 'undefined' ? '' : window.location.href,
  local: Store | null = browserStore('local'),
  session: Store | null = browserStore('session'),
): void {
  if (!href) return;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  const demo = url.searchParams.get('demo');
  const success = url.searchParams.get('pro_success');
  if (demo !== 'true' && demo !== 'false' && success !== 'true') return;
  if (demo === 'true') setProEnabled(true, local);
  else if (demo === 'false') setProEnabled(false, local);
  if (success === 'true') {
    setProEnabled(true, local);
    try {
      session?.setItem(CRATE_OPEN_KEY, '1');
      session?.setItem(BANNER_KEY, '1');
    } catch {
      /* The unlock still applies when storage accepts the flag. */
    }
    notifyProChange();
  }
  if (demo === 'true' || success === 'true') {
    try {
      session?.setItem(LIBRARY_ENTRY_KEY, '1');
    } catch {
      /* The library link still opens the list. */
    }
  }
  url.searchParams.delete('demo');
  url.searchParams.delete('pro_success');
  if ((demo === 'true' || success === 'true') && typeof window !== 'undefined' && href === window.location.href) {
    url.pathname = '/pro';
  }
  if (typeof window !== 'undefined' && href === window.location.href) {
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
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
