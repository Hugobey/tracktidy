import { describe, expect, it } from 'vitest';
import { measurementId, resetAnalyticsForTests, sanitizeEvent } from '../src/lib/analytics.ts';
import { readConsent, writeConsent } from '../src/lib/consent.ts';
import {
  LEGAL_NOTICE_WITHHELD,
  PUBLISHER,
  PUBLISHED_NOTICE,
  UNPUBLISHED_NOTICE,
  legalNoticeIsPublished,
  legalNoticeParagraphs,
} from '../src/legal/publisher.ts';
import { homeJsonLd, siteOrigin } from '../src/lib/site.ts';

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

  it('accepts only a GA4 measurement id', () => {
    expect(measurementId('G-ABC123')).toBe('G-ABC123');
    expect(measurementId(' G-ABC123 ')).toBe('G-ABC123');
    expect(measurementId('')).toBeNull();
    expect(measurementId('UA-123')).toBeNull();
    expect(measurementId('G-ABC<script>')).toBeNull();
    expect(measurementId(undefined)).toBeNull();
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

describe('legal notice gate', () => {
  it('does not publish a notice while required facts are missing', () => {
    expect(legalNoticeIsPublished()).toBe(false);
    expect(legalNoticeParagraphs(UNPUBLISHED_NOTICE)).toBeNull();
    const withheld = LEGAL_NOTICE_WITHHELD.join(' ');
    expect(withheld).not.toContain(PUBLISHER.siren);
    expect(withheld).not.toContain('rue neuve');
    expect(withheld).not.toContain('75011');
  });

  it('includes the supplied registration details once every required fact is present', () => {
    const paragraphs = legalNoticeParagraphs({
      legalName: 'Ada Example',
      phone: '+33 1 00 00 00 00',
      vatNotice: 'VAT position supplied by the publisher.',
      registryNotice: 'Registry position supplied by the publisher.',
      host: { name: 'Example Host', address: '1 Example Street, Paris', phone: '+33 1 11 11 11 11' },
    });
    expect(paragraphs?.join('\n')).toContain(PUBLISHER.siren);
    expect(paragraphs?.join('\n')).toContain(PUBLISHER.siret);
    expect(paragraphs?.join('\n')).toContain(PUBLISHER.address);
    expect(paragraphs?.join('\n')).toContain('Ada Example');
    expect(paragraphs?.join('\n')).toContain('Example Host');
  });

  it('publishes the checked notice without the VAT number VIES rejected', () => {
    const text = legalNoticeParagraphs(PUBLISHED_NOTICE)?.join('\n') ?? '';
    expect(legalNoticeIsPublished(PUBLISHED_NOTICE)).toBe(true);
    expect(text).toContain('Hugo Blanchart');
    expect(text).toContain('+33 7 77 37 25 07');
    expect(text).toContain(PUBLISHER.siren);
    expect(text).toContain(PUBLISHER.siret);
    expect(text).toContain('Vercel Inc.');
    expect(text).toContain('+1 415 398 5463');
    expect(text).toContain('Not registered with the RCS');
    expect(text).not.toContain('FR14891239428');
    expect(text).not.toContain('not published yet');
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
    expect(serialized).not.toContain(PUBLISHER.siren);
    expect(serialized).not.toContain('rue neuve');
    expect(serialized).not.toContain('Hugo Blanchart');
    expect(serialized).not.toContain('+33 7 77 37 25 07');
    expect(siteOrigin('http://track-tidy.com')).toBe('https://track-tidy.com');
    expect(siteOrigin('https://www.track-tidy.com/app')).toBe('https://www.track-tidy.com');
  });
});
