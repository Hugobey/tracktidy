import { posthogKey } from './posthog-config.ts';

type LogAttributes = Record<string, string | number | boolean>;

type CaptureClient = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
  opt_out_capturing: () => void;
  opt_in_capturing: () => void;
  logger: {
    info: (message: string, attributes?: LogAttributes) => void;
  };
};

type Identity = { distinctId: string; properties: Record<string, unknown> };

const queue: { name: string; properties: Record<string, string> }[] = [];
let pendingIdentity: Identity | null = null;
let client: CaptureClient | null = null;

export function bindPostHogClient(next: CaptureClient | null): void {
  client = next;
  if (!client) return;
  if (pendingIdentity) client.identify(pendingIdentity.distinctId, pendingIdentity.properties);
  const pending = queue.splice(0, queue.length);
  for (const item of pending) client.capture(item.name, item.properties);
}

export function identifyPostHogUser(distinctId: string, properties: Record<string, unknown>): void {
  if (!posthogKey()) return;
  pendingIdentity = { distinctId, properties };
  client?.identify(distinctId, properties);
}

export function resetPostHogIdentity(): void {
  pendingIdentity = null;
  client?.reset();
}

export function captureProductEvent(name: string, properties: Record<string, string>): void {
  if (!posthogKey()) return;
  if (!client) {
    queue.push({ name, properties });
    if (queue.length > 20) queue.shift();
    return;
  }
  client.capture(name, properties);
}

/** Sends only purpose-written application diagnostics through PostHog Logs. */
export const posthogLogger = {
  info(message: string, attributes?: LogAttributes): void {
    if (!posthogKey()) return;
    client?.logger.info(message, attributes);
  },
};

function clearPostHogStorage(): void {
  if (typeof document !== 'undefined') {
    const names = document.cookie
      .split(';')
      .map((part) => part.trim().split('=')[0] ?? '')
      .filter((name) => name.startsWith('ph_'));
    for (const name of names) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }
  try {
    if (typeof localStorage === 'undefined') return;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('ph_')) localStorage.removeItem(key);
    }
  } catch {
    /* Private mode can reject storage. The in-memory opt-out still applies. */
  }
}

export function stopPostHog(): void {
  queue.length = 0;
  pendingIdentity = null;
  client?.opt_out_capturing();
  clearPostHogStorage();
}

/** Test hook. Drops a client and any events waiting for it. */
export function resetPostHogForTests(): void {
  queue.length = 0;
  pendingIdentity = null;
  client = null;
}
