import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ArtworkSearchError,
  escapeLucene,
  resetArtworkSearchForTests,
  searchArtwork,
  sniffImage,
} from '../src/lib/artwork.ts';

const jpeg = new Uint8Array(readFileSync(new URL('./fixtures/pixel.jpg', import.meta.url)));
const RELEASE = '11111111-2222-4333-8444-555555555555';
const RECORDING = '01234567-89ab-4cde-8f01-23456789abcd';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('artwork search', () => {
  it('asks for an artist and a title before calling the network', async () => {
    resetArtworkSearchForTests();
    let calls = 0;
    const fetchImpl = () => {
      calls += 1;
      return Promise.resolve(jsonResponse({}));
    };
    await expect(searchArtwork({ artist: ' ', title: 'Night', album: '', remix: '' }, { fetch: fetchImpl })).rejects.toBeInstanceOf(
      ArtworkSearchError,
    );
    expect(calls).toBe(0);
  });

  it('keeps an exact artist and title, skips a coverless release, and caches', async () => {
    resetArtworkSearchForTests();
    const urls: string[] = [];
    const sleeps: number[] = [];
    const fetchImpl = (input: string) => {
      urls.push(input);
      if (input.includes('ws/2/recording?')) {
        return Promise.resolve(
          jsonResponse({
            recordings: [
              {
                id: RECORDING,
                title: 'Blue Monday 88',
                score: 100,
                'artist-credit': [{ name: 'New Order' }],
                releases: [],
              },
              {
                id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
                title: 'Blue Monday',
                score: 90,
                'artist-credit': [{ name: 'New Order' }],
                releases: [],
              },
            ],
          }),
        );
      }
      if (input.includes('/recording/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')) {
        return Promise.resolve(
          jsonResponse({
            releases: [
              {
                id: '99999999-9999-4999-8999-999999999999',
                title: 'Substance',
                status: 'Official',
                'artist-credit': [{ name: 'New Order' }],
                'release-group': { 'primary-type': 'Album', 'secondary-types': ['Compilation'] },
              },
              {
                id: RELEASE,
                title: 'Blue Monday',
                status: 'Official',
                'artist-credit': [{ name: 'New Order' }],
                'release-group': { 'primary-type': 'Single', 'secondary-types': [] },
              },
            ],
          }),
        );
      }
      if (input.endsWith('99999999-9999-4999-8999-999999999999')) return Promise.resolve(new Response('', { status: 404 }));
      if (input.endsWith(RELEASE)) {
        return Promise.resolve(
          jsonResponse({
            images: [
              {
                front: true,
                image: 'https://archive.example/full.jpg',
                thumbnails: { small: 'https://archive.example/small.jpg', large: 'https://archive.example/large.jpg' },
              },
            ],
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 500 }));
    };

    const query = { artist: 'New Order', title: 'Blue Monday', album: 'Blue Monday', remix: '' };
    const hits = await searchArtwork(query, {
      fetch: fetchImpl,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      now: () => 0,
    });
    expect(hits).toEqual([
      {
        releaseId: RELEASE,
        releaseTitle: 'Blue Monday',
        artist: 'New Order',
        thumbUrl: 'https://archive.example/small.jpg',
        imageUrl: 'https://archive.example/large.jpg',
      },
    ]);
    expect(urls.some((url) => url.includes('Blue%20Monday%2088'))).toBe(false);
    expect(urls.filter((url) => url.includes('musicbrainz.org'))).toHaveLength(2);
    expect(sleeps).toEqual([1100]);
    const again = await searchArtwork(query, { fetch: fetchImpl, sleep: async () => undefined, now: () => 0 });
    expect(again).toEqual(hits);
    expect(urls.filter((url) => url.includes('musicbrainz.org'))).toHaveLength(2);
  });

  it('escapes Lucene punctuation in the artist and title', () => {
    expect(escapeLucene('AC/DC')).toBe('AC\\/DC');
    expect(escapeLucene('Say "Hello"')).toBe('Say \\"Hello\\"');
  });

  it('recognizes JPEG and PNG bytes and rejects other files', () => {
    expect(sniffImage(jpeg)).toBe('image/jpeg');
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });
});
