import { readFileSync } from 'node:fs';
import { parseBuffer } from 'music-metadata';
import { describe, expect, it } from 'vitest';
import { isMp3 } from '../src/lib/mp3.ts';
import { applyRouteMeta } from '../scripts/prerender-routes.ts';
import { applyTextCleanup, crateTemplate, fieldChanged, stripPromoText, titleCaseText, tokensFromTemplate } from '../src/lib/crate.ts';
import { zipTracks } from '../src/lib/crate-zip.ts';
import {
  LEMON_ACTIVATE_URL,
  LEMON_VALIDATE_URL,
  confirmLicense,
  lemonCheckoutUrl,
  licenseShouldLock,
  readLicensePayload,
  validateStoredLicense,
} from '../src/lib/lemonsqueezy.ts';
import { handleCheckPro } from '../api/check-pro.js';
import { emailHasPaid } from '../api/stripe-paid.js';
import {
  PRO_COPY,
  applyProQuery,
  copyHasDash,
  dismissNudge,
  nudgeVisible,
  readProSnapshot,
  recordCompletedProcess,
} from '../src/lib/pro.ts';
import { stripePaymentUrl } from '../src/lib/stripe.ts';
import { INDEXABLE_ROUTES, sitemapXml } from '../src/lib/site.ts';
import type { TrackFields } from '../src/lib/types.ts';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const fields = {
  artist: 'nora voss',
  title: 'night circuit',
  remix: '',
  album: '',
  genre: 'house',
  bpm: '124',
  key: '8A',
} satisfies TrackFields;

describe('pro copy', () => {
  it('keeps the crate headlines free of em dashes and double hyphens', () => {
    expect(PRO_COPY.nudgeTitle).toBe('Prepping a full crate? Unlock Bulk Visual Tag Editing.');
    expect(PRO_COPY.nudgeBody).toBe(
      'Edit ID3 tags inline across all tracks, strip promo junk in one click, and build custom filename templates.',
    );
    expect(PRO_COPY.nudgeAction).toBe('Unlock Pro Preview');
    expect(PRO_COPY.modalTitle).toBe('Unlock the Crate Grid & Bulk Metadata Editor');
    expect(PRO_COPY.modalBody).toBe('Enter your email to continue to Stripe, or restore a purchase you already made.');
    expect(PRO_COPY.emailPlaceholder).toBe('dj@example.com');
    expect(PRO_COPY.checkout).toBe('Continue to Checkout');
    expect(PRO_COPY.restoreLabel).toBe('Already purchased Pro? Restore with your email');
    expect(PRO_COPY.demo).toBe('Demo Pro');
    expect(PRO_COPY.banner).toBe('Track Tidy Pro unlocked');
    expect(PRO_COPY.library).toBe('Library');
    expect(PRO_COPY.libraryTitle).toBe('Rename many tracks at once.');
    for (const line of Object.values(PRO_COPY)) expect(copyHasDash(line)).toBe(false);
    const sources = [
      'src/lib/pro.ts',
      'src/lib/lemonsqueezy.ts',
      'src/lib/crate.ts',
      'src/components/UpgradeModal.tsx',
      'src/components/ProNudge.tsx',
      'src/components/ProAccount.tsx',
      'src/components/CrateGrid.tsx',
      'src/components/ProProvider.tsx',
      'src/components/ProBanner.tsx',
      'src/lib/stripe.ts',
      'src/lib/library-demo.ts',
      'src/pages/LibraryPage.tsx',
      'src/pages/SuccessPage.tsx',
    ];
    for (const file of sources) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(text, file).not.toContain('\u2014');
      expect(text, file).not.toContain('\u2013');
    }
  });
});

describe('crate editing', () => {
  it('strips promo text and title-cases without changing a key token', () => {
    expect(stripPromoText('Night Circuit [320kbps] (Master) https://dj.example/free')).toBe('Night Circuit');
    expect(stripPromoText('Nora Voss www.promo.test (promo)')).toBe('Nora Voss');
    expect(stripPromoText('Title (free download)')).toBe('Title');
    expect(titleCaseText('the night circuit')).toBe('The Night Circuit');
    expect(titleCaseText('nora and the night')).toBe('Nora and the Night');
    expect(titleCaseText('8A')).toBe('8A');
    expect(titleCaseText('(master)')).toBe('(Master)');
    const cleaned = applyTextCleanup({ ...fields, title: 'night circuit [320kbps]' }, 'strip');
    expect(cleaned.title).toBe('night circuit');
    expect(cleaned.key).toBe('8A');
  });

  it('builds the filename from the selected tokens', () => {
    expect(crateTemplate({ artist: true, title: true, bpm: true, key: true })).toBe('{artist} - {title} ({bpm} BPM) [{key}]');
    expect(crateTemplate({ artist: false, title: true, bpm: false, key: true })).toBe('{title} [{key}]');
    expect(tokensFromTemplate('{Artist} - {TITLE}')).toMatchObject({ artist: true, title: true, bpm: false, key: false });
    expect(fieldChanged({ ...fields, title: ' Night ' }, { ...fields, title: 'Night' }, 'title')).toBe(false);
    expect(fieldChanged({ ...fields, genre: 'Techno' }, fields, 'genre')).toBe(true);
  });

  it('packs a zip without re-encoding the audio bytes', () => {
    const zipped = zipTracks([
      { name: 'a.mp3', bytes: new Uint8Array([1, 2, 3]) },
      { name: 'a.mp3', bytes: new Uint8Array([4]) },
    ]);
    expect(zipped[0]).toBe(0x50);
    expect(zipped[1]).toBe(0x4b);
  });
});

describe('lemon squeezy', () => {
  it('prefills the checkout email and ignores a non-https url', () => {
    const checkout = lemonCheckoutUrl('https://store.lemonsqueezy.com/checkout/buy/example', 'dj@example.com');
    expect(checkout).toBeTruthy();
    expect(new URL(checkout ?? '').searchParams.get('checkout[email]')).toBe('dj@example.com');
    expect(lemonCheckoutUrl('http://store.lemonsqueezy.com/buy/example', 'dj@example.com')).toBeNull();
    const stripe = stripePaymentUrl('dj@example.com', 'https://buy.stripe.com/test_example');
    expect(new URL(stripe ?? '').searchParams.get('prefilled_email')).toBe('dj@example.com');
    expect(stripePaymentUrl('dj@example.com', 'http://buy.stripe.com/test_example')).toBeNull();
  });

  it('reads an active license and names expired or disabled keys', () => {
    const active = readLicensePayload(
      {
        activated: true,
        license_key: { status: 'active', key: 'KEY123456' },
        instance: { id: 'inst_1' },
        meta: { customer_email: 'dj@example.com' },
      },
      'activate',
    );
    expect(active).toMatchObject({ ok: true, key: 'KEY123456', instanceId: 'inst_1', email: 'dj@example.com' });
    const validated = readLicensePayload({ valid: true, license_key: { status: 'active', key: 'KEY123456' } }, 'validate');
    expect(validated.ok).toBe(true);
    expect(readLicensePayload({ valid: false, license_key: { status: 'expired', key: 'KEY123456' } }, 'validate')).toMatchObject({
      ok: false,
      message: 'This license key is expired.',
    });
    expect(licenseShouldLock('This license key is disabled.')).toBe(true);
    expect(licenseShouldLock('The license check could not reach Lemon Squeezy.')).toBe(false);
  });

  it('validates a saved seat and activates only when the visitor asks', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const body =
        url === LEMON_VALIDATE_URL
          ? { valid: false, license_key: { status: 'inactive', key: 'KEY123456' } }
          : { activated: true, license_key: { status: 'active', key: 'KEY123456' }, instance: { id: 'inst_new' } };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const turnedOn = await confirmLicense('KEY123456', 'tt-browser-instance', 'inst_old', fetchImpl);
    expect(turnedOn).toMatchObject({ ok: true, instanceId: 'inst_new' });
    expect(calls).toEqual([LEMON_VALIDATE_URL, LEMON_ACTIVATE_URL]);

    calls.length = 0;
    const expiredFetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ valid: false, license_key: { status: 'expired', key: 'KEY123456' } }), { status: 200 });
    }) as typeof fetch;
    const expired = await confirmLicense('KEY123456', 'tt-browser-instance', 'inst_old', expiredFetch);
    expect(expired).toMatchObject({ ok: false });
    expect(calls).toEqual([LEMON_VALIDATE_URL]);

    calls.length = 0;
    const stored = await validateStoredLicense('KEY123456', 'inst_old', expiredFetch);
    expect(stored.ok).toBe(false);
    expect(calls).toEqual([LEMON_VALIDATE_URL]);
  });
});

describe('pro storage', () => {
  it('counts completed opens and unlocks from the Pro flag', () => {
    const local = memory();
    const session = memory();
    expect(recordCompletedProcess(local)).toBe(1);
    expect(nudgeVisible(readProSnapshot(local, session))).toBe(false);
    expect(recordCompletedProcess(local)).toBe(2);
    expect(nudgeVisible(readProSnapshot(local, session))).toBe(true);
    dismissNudge(session);
    expect(nudgeVisible(readProSnapshot(local, session))).toBe(false);
    expect(readProSnapshot(local, session).pro).toBe(false);
    local.setItem('tt_user_pro', 'true');
    expect(readProSnapshot(local, session).pro).toBe(true);
    applyProQuery('https://www.track-tidy.com/?demo=false', local, session);
    expect(readProSnapshot(local, session).pro).toBe(false);
    expect(session.getItem('tt_library_entry')).toBeNull();
    applyProQuery('https://www.track-tidy.com/?demo=true', local, session);
    expect(local.getItem('tt_user_pro')).toBe('true');
    expect(session.getItem('tt_library_entry')).toBe('1');
    applyProQuery('https://www.track-tidy.com/app?pro_success=true', local, session);
    expect(readProSnapshot(local, session).pro).toBe(true);
    expect(readProSnapshot(local, session).banner).toBe(true);
    expect(session.getItem('tt_crate_open')).toBe('1');
  });
});

describe('stripe restore', () => {
  it('treats a paid charge or checkout session as Pro and ignores a missing secret', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v1/customers')) {
        return new Response(JSON.stringify({ data: [{ id: 'cus_1' }] }), { status: 200 });
      }
      if (url.includes('/v1/charges/search')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      if (url.includes('/v1/charges')) {
        return new Response(JSON.stringify({ data: [{ paid: true, status: 'succeeded', refunded: false }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as typeof fetch;
    expect(await emailHasPaid('dj@example.com', 'sk_test_example', fetchImpl)).toBe(true);

    const unpaid = (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch;
    expect(await emailHasPaid('dj@example.com', 'sk_test_example', unpaid)).toBe(false);

    const sessionPaid = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('customer_details')) {
        return new Response(JSON.stringify({ data: [{ payment_status: 'paid', status: 'complete' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as typeof fetch;
    expect(await emailHasPaid('dj@example.com', 'sk_test_example', sessionPaid)).toBe(true);
    expect(await handleCheckPro('dj@example.com', '')).toMatchObject({ status: 503, body: { pro: false } });
    expect(await handleCheckPro('not-an-email', 'sk_test_example')).toMatchObject({ status: 400 });
  });
});

describe('success page indexing', () => {
  it('prerenders activation as noindex and leaves it out of the sitemap', () => {
    const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const page = applyRouteMeta(
      shell,
      { path: '/success', title: 'TrackTidy Pro activation', description: 'Activate a TrackTidy Pro license on this browser.', index: false },
      'https://www.track-tidy.com',
    );
    expect(page).toContain('name="robots" content="noindex,nofollow"');
    const tool = applyRouteMeta(shell, { path: '/app', title: 'Tool', description: 'Tool' }, 'https://www.track-tidy.com');
    expect(tool).toContain('name="robots" content="index,follow"');
    expect(INDEXABLE_ROUTES.some((route) => route.path === '/success')).toBe(false);
    expect(sitemapXml()).not.toContain('/success');
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
      rewrites: { source: string; destination: string }[];
    };
    expect(vercel.rewrites).toContainEqual({ source: '/success', destination: '/success/index.html' });
    expect(vercel.rewrites).toContainEqual({ source: '/pro', destination: '/pro/index.html' });
    expect(sitemapXml()).not.toContain('/pro');
  });
});

describe('pro library', () => {
  it('ships readable demo MP3s for the local library', async () => {
    const bytes = readFileSync(new URL('../public/demo/night-circuit.mp3', import.meta.url));
    expect(isMp3(new Uint8Array(bytes))).toBe(true);
    const meta = await parseBuffer(bytes, { mimeType: 'audio/mpeg' });
    expect(meta.common.artist).toBe('nora voss');
    expect(meta.common.title).toBe('night circuit');
    expect(meta.common.bpm).toBe(124);
    expect(meta.common.key).toBe('8A');
  });
});
