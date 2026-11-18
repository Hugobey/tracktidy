import { readFileSync } from 'node:fs';
import { parseBuffer } from 'music-metadata';
import { describe, expect, it } from 'vitest';
import { isMp3 } from '../src/lib/mp3.ts';
import { applyRouteMeta } from '../scripts/prerender-routes.ts';
import { applyTextCleanup, crateTemplate, fieldChanged, stripPromoText, titleCaseText, tokensFromTemplate } from '../src/lib/crate.ts';
import { autoCleanFields, FREE_LIBRARY_LIMIT, genreFamily, libraryRoom, libraryStatus, trackMatchesFilter, visibleLibraryStatus } from '../src/lib/library-clean.ts';
import { DEFAULT_LIBRARY_TOKENS, renderLibraryFilename } from '../src/lib/library-name.ts';
import { zipTracks } from '../src/lib/crate-zip.ts';
import { handleCheckPro } from '../api/check-pro.js';
import { emailHasPaid } from '../api/stripe-paid.js';
import {
  PRO_COPY,
  applyProQuery,
  checkoutReturnPath,
  claimCheckoutReturn,
  copyHasDash,
  dismissCheckoutToast,
  dismissNudge,
  isCheckoutSessionId,
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
    expect(PRO_COPY.nudgeAction).toBe('Try Crate Library');
    expect(PRO_COPY.modalTitle).toBe('Upgrade to Track Tidy Pro');
    expect(PRO_COPY.modalBody).toBe('One payment unlocks Track Tidy Pro on this browser.');
    expect(PRO_COPY.price).toBe('$19');
    expect(PRO_COPY.active).toBe('Track Tidy Pro');
    expect(PRO_COPY.freePreview).toBe('Free Preview');
    expect(PRO_COPY.checkoutToast).toBe('Payment confirmed. Track Tidy Pro Lifetime is unlocked.');
    expect(PRO_COPY.perkBatch).toBe('Unlimited batch playlist cleaning and crate size');
    expect(PRO_COPY.perkGrid).toBe('Full Crate Library spreadsheet with inline editing and multi-genre tags');
    expect(PRO_COPY.perkNames).toBe('Custom filename templates with live full-filename previews');
    expect(PRO_COPY.perkZip).toBe('One-click bulk ZIP export with embedded cover art and cleaned ID3 tags');
    expect(PRO_COPY.emailPlaceholder).toBe('dj@example.com');
    expect(PRO_COPY.checkout).toBe('Continue to Checkout');
    expect(PRO_COPY.restoreLabel).toBe('Already upgraded? Restore with your email');
    expect(PRO_COPY.banner).toBe('Track Tidy Pro unlocked');
    expect(PRO_COPY.library).toBe('Library');
    expect(PRO_COPY.libraryTitle).toBe('Your crate.');
    expect(PRO_COPY.libraryLimit).toBe('Free Preview holds 5 tracks. Track Tidy Pro unlocks the full crate.');
    expect(PRO_COPY.libraryExport).toBe(
      'Your crate is prepped and ready. Unlock Track Tidy Pro to export your cleaned playlist as a ZIP',
    );
    expect(PRO_COPY.libraryBrowse).toBe('Or press to browse. Free Preview holds 5 tracks in this browser.');
    expect(PRO_COPY.crateNudge).toBe('Prepping a whole set? Drop your entire folder to auto-clean tags at once.');
    expect(PRO_COPY.libraryDownload).toBe('Download Crate ZIP');
    expect(PRO_COPY.libraryConfirm).toBe('Confirm?');
    for (const line of Object.values(PRO_COPY)) expect(copyHasDash(line)).toBe(false);
    const sources = [
      'src/lib/pro.ts',
      'src/lib/crate.ts',
      'src/constants/genres.ts',
      'src/lib/library-link.ts',
      'src/components/UpgradeModal.tsx',
      'src/components/GenreSelector.tsx',
      'src/components/ProNudge.tsx',
      'src/components/ProAccount.tsx',
      'src/components/CrateGrid.tsx',
      'src/components/ProProvider.tsx',
      'src/components/ProBanner.tsx',
      'src/components/LibraryArray.tsx',
      'src/lib/stripe.ts',
      'src/lib/library-demo.ts',
      'src/lib/library-clean.ts',
      'src/lib/library-files.ts',
      'src/lib/library-name.ts',
      'src/lib/library-store.ts',
      'src/components/CrateNudge.tsx',
      'src/pages/LibraryPage.tsx',
      'src/pages/SuccessPage.tsx',
      'src/styles/library.css',
    ];
    for (const file of sources) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(text, file).not.toContain('\u2014');
      expect(text, file).not.toContain('\u2013');
    }
  });
});

describe('crate editing', () => {
  it('auto cleans playlist tags and marks incomplete rows for review', () => {
    const cleaned = autoCleanFields({
      ...fields,
      artist: 'nora voss',
      title: 'night circuit [320kbps] (Master)',
      genre: 'house',
    });
    expect(cleaned.artist).toBe('Nora Voss');
    expect(cleaned.title).toBe('Night Circuit');
    expect(cleaned.bpm).toBe('124');
    expect(cleaned.key).toBe('8A');
    expect(libraryStatus(cleaned, cleaned)).toBe('cleaned');
    const missing = { ...cleaned, key: '' };
    expect(libraryStatus(missing, { ...cleaned, key: '' })).toBe('review');
    expect(visibleLibraryStatus({ fields: missing, cleaned: missing, analysing: true })).toBe('pending');
    expect(libraryStatus({ ...cleaned, genre: 'Techno' }, cleaned)).toBe('edited');
    expect(autoCleanFields({ ...fields, title: 'harbour line (free download)' }).title).toBe('Harbour Line');
    expect(trackMatchesFilter('edited', 'all')).toBe(true);
    expect(trackMatchesFilter('edited', 'cleaned')).toBe(false);
    expect(trackMatchesFilter('pending', 'review')).toBe(true);
    expect(genreFamily('Deep House')).toBe('house');
    expect(genreFamily('Drum & Bass')).toBe('dnb');
    expect(genreFamily('Hip-Hop')).toBe('hiphop');
    expect(genreFamily('Techno')).toBe('techno');
    expect(genreFamily('')).toBe('empty');
    expect(FREE_LIBRARY_LIMIT).toBe(5);
    expect(libraryRoom(4, false)).toBe(1);
    expect(libraryRoom(5, false)).toBe(0);
    expect(libraryRoom(5, true)).toBe(45);
    expect(renderLibraryFilename(DEFAULT_LIBRARY_TOKENS, cleaned)).toBe('Nora Voss - Night Circuit [124 BPM] [8A].mp3');
    expect(
      renderLibraryFilename(
        DEFAULT_LIBRARY_TOKENS.map((token) => ({ ...token, on: token.id === 'artist' || token.id === 'title' || token.id === 'bpm' })),
        { ...cleaned, artist: 'Artist', title: 'Title', bpm: '126' },
      ),
    ).toBe('Artist - Title [126 BPM].mp3');
  });

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

describe('stripe checkout', () => {
  it('prefills the checkout email and ignores a non-https url', () => {
    const stripe = stripePaymentUrl('dj@example.com', 'https://buy.stripe.com/test_example');
    expect(new URL(stripe ?? '').searchParams.get('prefilled_email')).toBe('dj@example.com');
    expect(stripePaymentUrl('dj@example.com', 'http://buy.stripe.com/test_example')).toBeNull();
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
    expect(readProSnapshot(local, session).pro).toBe(true);
    expect(session.getItem('tt_library_entry')).toBeNull();
    local.removeItem('tt_user_pro');
    applyProQuery('https://www.track-tidy.com/?demo=true', local, session);
    expect(local.getItem('tt_user_pro')).toBeNull();
    expect(session.getItem('tt_library_entry')).toBeNull();
    applyProQuery('https://www.track-tidy.com/app?pro_success=true', local, session);
    expect(readProSnapshot(local, session).pro).toBe(true);
    expect(readProSnapshot(local, session).banner).toBe(true);
    expect(session.getItem('tt_crate_open')).toBe('1');
  });

  it('unlocks a checkout return once and keeps the toast armed for a strict remount', () => {
    dismissCheckoutToast();
    const local = memory();
    const session = memory();
    const sessionId = 'cs_test_a1B2c3D4e5';
    expect(isCheckoutSessionId(sessionId)).toBe(true);
    expect(isCheckoutSessionId('not-a-session')).toBe(false);
    expect(checkoutReturnPath(sessionId)).toBe(`/pro?upgrade=success&session_id=${sessionId}`);
    const first = claimCheckoutReturn(
      `https://www.track-tidy.com/pro?upgrade=success&session_id=${sessionId}`,
      local,
      session,
    );
    expect(first.unlocked).toBe(true);
    expect(first.toast).toBe(true);
    expect(first.href).toBe('/pro');
    expect(local.getItem('tt_user_pro')).toBe('true');
    expect(session.getItem('tt_checkout_toast')).toBe(sessionId);
    const remount = claimCheckoutReturn('https://www.track-tidy.com/pro', local, session);
    expect(remount.unlocked).toBe(false);
    expect(remount.toast).toBe(true);
    dismissCheckoutToast();
    const again = claimCheckoutReturn(
      `https://www.track-tidy.com/pro?upgrade=success&session_id=${sessionId}&keep=1`,
      local,
      session,
    );
    expect(again.toast).toBe(false);
    expect(again.href).toBe('/pro?keep=1');
    expect(readProSnapshot(local, session).pro).toBe(true);
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
      { path: '/success', title: 'TrackTidy Pro', description: 'Restore Track Tidy Pro Lifetime on this browser with your Stripe email.', index: false },
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
