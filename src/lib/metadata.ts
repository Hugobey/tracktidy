import { parseBlob } from 'music-metadata';
import { sniffImage, type ImageMime } from './artwork.ts';
import { formatBpm } from './format.ts';
import { inspectTag, pictureTypeFromLabel } from './id3.ts';
import type { FallbackPayload, TagPlan, TechnicalInfo, TrackFields } from './types.ts';

export type ReadTrack = {
  fields: TrackFields;
  remixFrame: 'TIT3' | 'TPE4';
  technical: TechnicalInfo;
  kept: string[];
  coverUrl: string | null;
  /** JPEG or PNG cover bytes. Other image types stay in the file until the user replaces them. */
  cover: { data: Uint8Array; mime: ImageMime } | null;
  plan: TagPlan;
  fallback: FallbackPayload | null;
};

function clean(value: string | undefined | null): string {
  return value?.split('\0').join('').trim() ?? '';
}

function copyBytes(data: Uint8Array): Uint8Array {
  const copy = new ArrayBuffer(data.byteLength);
  const view = new Uint8Array(copy);
  view.set(data);
  return view;
}

function arrayBufferOf(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  return copy;
}

export async function readTrack(buffer: ArrayBuffer): Promise<ReadTrack> {
  const plan = inspectTag(buffer);
  const metadata = await parseBlob(new Blob([buffer], { type: 'audio/mpeg' }), {
    duration: true,
    skipPostHeaders: true,
  });
  const common = metadata.common;
  const subtitle = clean(common.subtitle?.find((value) => clean(value)));
  const remixer = clean(common.remixer?.filter((value) => clean(value)).join(', '));
  const fields: TrackFields = {
    artist: clean(common.artist),
    title: clean(common.title),
    remix: subtitle || remixer,
    album: clean(common.album),
    genre: common.genre?.map((value) => clean(value)).filter(Boolean).join(', ') ?? '',
    bpm: formatBpm(common.bpm),
    key: clean(common.key),
  };

  const pictures = common.picture ?? [];
  let coverUrl: string | null = null;
  let cover: { data: Uint8Array; mime: ImageMime } | null = null;
  const coverPicture = pictures.find((picture) => picture.type === 'Cover (front)') ?? pictures[0];
  if (coverPicture) {
    const named = coverPicture.format?.toLowerCase() ?? '';
    const mime =
      named === 'image/jpeg' || named === 'image/jpg'
        ? 'image/jpeg'
        : named === 'image/png'
          ? 'image/png'
          : sniffImage(coverPicture.data);
    coverUrl = URL.createObjectURL(
      new Blob([arrayBufferOf(coverPicture.data)], { type: mime || coverPicture.format || 'image/jpeg' }),
    );
    if (mime) cover = { data: copyBytes(coverPicture.data), mime };
  }

  const year = common.year ?? null;
  const track =
    common.track.no !== null
      ? common.track.of
        ? `${common.track.no}/${common.track.of}`
        : String(common.track.no)
      : '';
  const albumArtist = clean(common.albumartist);
  const comment = clean(common.comment?.find((entry) => clean(entry.text))?.text);
  const composer = common.composer?.map((value) => clean(value)).filter(Boolean).join(', ') ?? '';

  const kept: string[] = [];
  if (year) kept.push(`year ${year}`);
  if (track) kept.push(`track ${track}`);
  if (albumArtist && albumArtist !== fields.artist) kept.push('album artist');
  if (comment) kept.push('comment');
  if (composer) kept.push('composer');
  if (pictures.length > 0) kept.push(pictures.length === 1 ? 'artwork' : `${pictures.length} images`);

  const fallback: FallbackPayload | null = plan.canPatch
    ? null
    : {
        year,
        track,
        albumArtist,
        comment,
        composer,
        pictures: pictures.slice(0, 4).map((picture, index) => ({
          data: copyBytes(picture.data),
          type: pictureTypeFromLabel(picture.type, index),
          description: clean(picture.description) || 'cover',
        })),
      };

  return {
    fields,
    remixFrame: remixer && !subtitle ? 'TPE4' : 'TIT3',
    technical: {
      duration: metadata.format.duration ?? null,
      bitrate: metadata.format.bitrate ?? null,
      sampleRate: metadata.format.sampleRate ?? null,
      channels: metadata.format.numberOfChannels ?? null,
    },
    kept,
    coverUrl,
    cover,
    plan,
    fallback,
  };
}
