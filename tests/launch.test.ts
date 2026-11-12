import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blogSitemapEntries } from '../scripts/blog-files.ts';
import { applyRouteMeta } from '../scripts/prerender-routes.ts';
import { redactAnalyticsUrl } from '../src/lib/vercel-analytics.ts';
import {
  buildCollectQuery,
  measurementId,
  PUBLISHED_MEASUREMENT_ID,
  resetAnalyticsForTests,
  sanitizeEvent,
} from '../src/lib/analytics.ts';
import { readConsent, writeConsent } from '../src/lib/consent.ts';
import {
  LEGAL_NOTICE_WITHHELD,
  PUBLISHER,
  PUBLISHED_NOTICE,
  UNPUBLISHED_NOTICE,
  legalNoticeIsPublished,
  legalNoticeParagraphs,
} from '../src/legal/publisher.ts';
import { DEFAULT_ORIGIN, homeJsonLd, robotsTxt, routeMeta, siteOrigin, sitemapXml, SITEMAP_LASTMOD } from '../src/lib/site.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('analytics parameters', () => {
  it('drops filenames, tag values, and unknown events', () => {
    expect(sanitizeEvent('file_downloaded', { filename: 'nora.mp3', artist: 'Nora Voss' })).toEqual({});
    expect(sanitizeEvent('metadata_edit_completed', { field: 'artist', value: 'Nora Voss' })).toEqual({
      field: 'artist',
    });
    expect(sanitizeEvent('metadata_edit_completed', { field: 'filename' })).toBeNull();
    expect(
      sanitizeEvent('metadata_analysis_completed', { bpm_tag: 'yes', key_tag: 'no', bpm: '120', title: 'Night' }),
    ).toEqual({ bpm_tag: 'yes', key_tag: 'no' });
    expect(sanitizeEvent('processing_failed', { stage: 'type', message: 'nora.mp3 is not an mp3' })).toEqual({
      stage: 'type',
    });
    expect(sanitizeEvent('processing_failed', { stage: 'network' })).toBeNull();
    expect(sanitizeEvent('page_view', { page_path: '/app' })).toBeNull();
  });

  it('sends Vercel page views as a path only', () => {
    const event = { type: 'pageview' as const, url: 'https://www.track-tidy.com/app?file=nora.mp3#cover' };
    expect(redactAnalyticsUrl(event)).toEqual({
      type: 'pageview',
      url: 'https://www.track-tidy.com/app',
    });
    expect(redactAnalyticsUrl({ type: 'pageview', url: 'not a url' })).toEqual({
      type: 'pageview',
      url: 'not a url',
    });
  });

  it('accepts only a GA4 measurement id', () => {
    expect(measurementId('G-ABC123')).toBe('G-ABC123');
    expect(measurementId(' G-ABC123 ')).toBe('G-ABC123');
    expect(measurementId('')).toBe(PUBLISHED_MEASUREMENT_ID);
    expect(measurementId(undefined)).toBe(PUBLISHED_MEASUREMENT_ID);
    expect(measurementId('UA-123')).toBeNull();
    expect(measurementId('G-ABC<script>')).toBeNull();
  });

  it('builds a collect hit without filenames or tag values', () => {
    const query = buildCollectQuery(
      PUBLISHED_MEASUREMENT_ID,
      'metadata_edit_completed',
      { field: 'artist' },
      { location: 'https://www.track-tidy.com/app', title: 'TrackTidy' },
      { cid: '123.456', sid: '789', seq: 2 },
    );
    const params = new URLSearchParams(query);
    expect(params.get('tid')).toBe(PUBLISHED_MEASUREMENT_ID);
    expect(params.get('en')).toBe('metadata_edit_completed');
    expect(params.get('dl')).toBe('https://www.track-tidy.com/app');
    expect(params.get('ep.field')).toBe('artist');
    expect(query).not.toContain('nora');
    expect(query).not.toContain('.mp3');
  });
});

describe('consent storage', () => {
  it('remembers accept and reject and ignores other values', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    expect(readConsent(storage)).toBe('unknown');
    writeConsent('rejected', storage);
    expect(readConsent(storage)).toBe('rejected');
    writeConsent('accepted', storage);
    expect(readConsent(storage)).toBe('accepted');
    memory.set('tracktidy.consent', 'maybe');
    expect(readConsent(storage)).toBe('unknown');
    resetAnalyticsForTests();
  });
});

const PRIVATE_MARKERS = [
  'Hugo Blanchart',
  '891239428',
  '89123942800040',
  'rue neuve',
  '75011',
  '+33 7 77 37 25 07',
  'FR14891239428',
];

describe('legal notice gate', () => {
  it('does not publish a notice while the host is missing', () => {
    expect(legalNoticeIsPublished()).toBe(false);
    expect(legalNoticeParagraphs(UNPUBLISHED_NOTICE)).toBeNull();
    const withheld = LEGAL_NOTICE_WITHHELD.join(' ');
    for (const marker of PRIVATE_MARKERS) expect(withheld).not.toContain(marker);
  });

  it('names the host and the contact emails, and leaves the publisher’s identity out', () => {
    const paragraphs = legalNoticeParagraphs({
      vatNotice: 'VAT position supplied by the publisher.',
      registryNotice: 'Registry position supplied by the publisher.',
      host: { name: 'Example Host', address: '1 Example Street, Paris', phone: '+33 1 11 11 11 11' },
    });
    const text = paragraphs?.join('\n') ?? '';
    expect(text).toContain('Example Host');
    expect(text).toContain(PUBLISHER.hello);
    expect(text).not.toContain('Ada Example');
    for (const marker of PRIVATE_MARKERS) expect(text).not.toContain(marker);
  });

  it('publishes the checked notice without personal identifiers or a VAT number', () => {
    const text = legalNoticeParagraphs(PUBLISHED_NOTICE)?.join('\n') ?? '';
    expect(legalNoticeIsPublished(PUBLISHED_NOTICE)).toBe(true);
    expect(text).toContain(PUBLISHER.hello);
    expect(text).toContain(PUBLISHER.support);
    expect(text).toContain(PUBLISHER.privacy);
    expect(text).toContain('Vercel Inc.');
    expect(text).toContain('+1 415 398 5463');
    expect(text).toContain('not registered with the RCS');
    expect(text).toContain('No intra-EU VAT number is displayed.');
    expect(text).not.toContain('not published yet');
    for (const marker of PRIVATE_MARKERS) expect(text).not.toContain(marker);
  });
});

describe('structured data', () => {
  it('does not invent ratings, prices, or the publisher’s private registration details', () => {
    const serialized = JSON.stringify(homeJsonLd('https://track-tidy.com'));
    expect(serialized).toContain('SoftwareApplication');
    expect(serialized).toContain('hello@track-tidy.com');
    expect(serialized).not.toContain('aggregateRating');
    expect(serialized).not.toContain('review');
    expect(serialized).not.toContain('price');
    for (const marker of PRIVATE_MARKERS) expect(serialized).not.toContain(marker);
    expect(siteOrigin('http://track-tidy.com')).toBe(DEFAULT_ORIGIN);
    expect(siteOrigin('https://www.track-tidy.com/app')).toBe(DEFAULT_ORIGIN);
    expect(readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')).toBe(
      sitemapXml(DEFAULT_ORIGIN, SITEMAP_LASTMOD, blogSitemapEntries(root)),
    );
    expect(readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8')).toBe(robotsTxt());
    const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const tool = applyRouteMeta(shell, routeMeta('/app'), DEFAULT_ORIGIN);
    expect(tool).toContain('<title>MP3 metadata editor — TrackTidy</title>');
    expect(tool).toContain('href="https://www.track-tidy.com/app"');
    expect(tool).toContain('content="https://www.track-tidy.com/app"');
    expect(tool).not.toContain('<title>TrackTidy — DJ file renamer and MP3 metadata editor</title>');
  });
});
