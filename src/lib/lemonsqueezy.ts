export const LEMON_ACTIVATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/activate';
export const LEMON_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';
export const LEMON_DEACTIVATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/deactivate';
export const DEFAULT_PORTAL_URL = 'https://app.lemonsqueezy.com/my-orders';

export type LicenseOk = {
  ok: true;
  key: string;
  email: string;
  instanceId: string;
};

export type LicenseNo = {
  ok: false;
  message: string;
};

type LicenseBody = {
  activated?: boolean;
  valid?: boolean;
  error?: string | null;
  license_key?: { status?: string; key?: string };
  instance?: { id?: string } | null;
  meta?: { customer_email?: string };
};

export function lemonCheckoutUrl(base: string | undefined, email: string): string | null {
  if (typeof base !== 'string' || !base.trim()) return null;
  try {
    const url = new URL(base.trim());
    if (url.protocol !== 'https:') return null;
    url.searchParams.set('checkout[email]', email.trim());
    return url.toString();
  } catch {
    return null;
  }
}

export function lemonPortalUrl(raw: string | undefined = import.meta.env.VITE_LEMON_SQUEEZY_PORTAL_URL): string {
  if (typeof raw === 'string' && raw.trim().startsWith('https://')) {
    try {
      return new URL(raw.trim()).toString();
    } catch {
      return DEFAULT_PORTAL_URL;
    }
  }
  return DEFAULT_PORTAL_URL;
}

export function checkoutConfigured(raw: string | undefined = import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL): boolean {
  return lemonCheckoutUrl(raw, 'dj@example.com') !== null;
}

export function readLicensePayload(body: unknown, mode: 'activate' | 'validate'): LicenseOk | LicenseNo {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'The license check returned an unexpected response.' };
  }
  const data = body as LicenseBody;
  if (typeof data.error === 'string' && data.error.trim()) {
    return { ok: false, message: data.error.trim() };
  }
  const passed = mode === 'activate' ? data.activated === true : data.valid === true;
  const status = data.license_key?.status;
  if (!passed || status !== 'active') {
    if (status === 'expired') return { ok: false, message: 'This license key is expired.' };
    if (status === 'disabled') return { ok: false, message: 'This license key is disabled.' };
    return { ok: false, message: 'This license key is not active.' };
  }
  const key = data.license_key?.key?.trim() ?? '';
  const instanceId = data.instance?.id?.trim() ?? '';
  if (!key || (mode === 'activate' && !instanceId)) {
    return { ok: false, message: 'The license check did not return an activation for this browser.' };
  }
  return {
    ok: true,
    key,
    email: data.meta?.customer_email?.trim() ?? '',
    instanceId,
  };
}

async function postLicense(
  url: string,
  fields: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; json: unknown }> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields).toString(),
  });
  const json: unknown = await response.json().catch(() => null);
  return { ok: response.ok, json };
}

export function licenseShouldLock(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes('could not reach') || lower.includes('unexpected')) return false;
  return lower.includes('expired') || lower.includes('disabled') || lower.includes('not active') || lower.includes('invalid');
}

/** Checks a saved activation. Never calls activate, so a refresh does not create another seat. */
export async function validateStoredLicense(
  licenseKey: string,
  instanceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LicenseOk | LicenseNo> {
  const key = licenseKey.trim();
  if (key.length < 8 || !instanceId.trim()) return { ok: false, message: 'Enter the license key from your receipt.' };
  try {
    const checked = await postLicense(LEMON_VALIDATE_URL, { license_key: key, instance_id: instanceId }, fetchImpl);
    const parsed = readLicensePayload(checked.json, 'validate');
    if (parsed.ok) return { ...parsed, instanceId };
    return parsed;
  } catch {
    return { ok: false, message: 'The license check could not reach Lemon Squeezy. Check the connection and try again.' };
  }
}

export async function confirmLicense(
  licenseKey: string,
  instanceName: string,
  instanceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LicenseOk | LicenseNo> {
  const key = licenseKey.trim();
  if (key.length < 8) return { ok: false, message: 'Enter the license key from your receipt.' };
  try {
    if (instanceId) {
      const checked = await postLicense(LEMON_VALIDATE_URL, { license_key: key, instance_id: instanceId }, fetchImpl);
      const parsed = readLicensePayload(checked.json, 'validate');
      if (parsed.ok) return { ...parsed, instanceId };
      const message = parsed.message.toLowerCase();
      if (message.includes('expired') || message.includes('disabled')) return parsed;
    }
    const activated = await postLicense(
      LEMON_ACTIVATE_URL,
      { license_key: key, instance_name: instanceName },
      fetchImpl,
    );
    return readLicensePayload(activated.json, 'activate');
  } catch {
    return { ok: false, message: 'The license check could not reach Lemon Squeezy. Check the connection and try again.' };
  }
}

export async function deactivateLicense(licenseKey: string, instanceId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!licenseKey || !instanceId) return;
  try {
    await postLicense(LEMON_DEACTIVATE_URL, { license_key: licenseKey, instance_id: instanceId }, fetchImpl);
  } catch {
    /* Local sign-out still removes the key from this browser. */
  }
}
