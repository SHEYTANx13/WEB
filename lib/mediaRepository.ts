/*
 * lib/mediaRepository.ts — Media data layer (v4.0.0).
 *
 * THE canonical media data layer: the CI sync step
 * (scripts/sync-media-manifest.mjs) normalises the external
 * manifest contract — Parsaetak/Contents/Projects/library.json —
 * into data/media.json and merges the optional Music source.
 *
 * Data flow (Media Data Pipeline):
 *   source manifest (synced + validated at build time)
 *   → runtime normalization (lib/media/normalize.ts, one pass)
 *   → derived MediaItem list (derived ONCE at module scope)
 *   → UI / player
 *
 * The build-time validation (scripts/validate-media-manifest.mjs)
 * is the authoritative gate. The runtime check below is defense in
 * depth: one malformed optional record is filtered out instead of
 * crashing the whole catalogue.
 *
 * Memory policy: the manifest is immutable build content. Deriving it
 * synchronously at module scope gives exactly one normalization pass
 * per process with no promise machinery and no cache retention
 * question — the derived list is the only copy that will ever exist.
 */

import mediaManifestJson from "@/data/media.json";

import {
  type MediaItem,
  type MediaManifest,
  type MusicItem,
  normalizeManifestItems,
  normalizeMediaItem
} from "@/lib/media/normalize";

const MEDIA_MANIFEST =
  mediaManifestJson as unknown as MediaManifest;

/*
 * Normalization + indexing happens exactly once, at module scope.
 * Every consumer across every scene mount reads the same derived
 * array — concurrent callers cannot race separate derivations because
 * there is only one.
 */
const MEDIA_ITEMS: MediaItem[] =
  normalizeManifestItems(MEDIA_MANIFEST);

/**
 * The raw manifest (version, updated, items) — for status surfaces.
 */
export async function loadMediaManifest(): Promise<MediaManifest> {
  return MEDIA_MANIFEST;
}

/**
 * All resolved media items, manifest order (books first, then any
 * music/video/art as published by the Contents sources).
 */
export async function listMedia(): Promise<MediaItem[]> {
  return MEDIA_ITEMS;
}

/**
 * Synchronous access for hooks that must not suspend
 * (the manifest is module content — no fetch is involved).
 */
export function getMediaItems(): MediaItem[] {
  return MEDIA_ITEMS;
}

/**
 * Music items only (the player's catalog source). May be empty —
 * the documented state until a Music source publishes tracks.
 */
export function getMusicItems(): MusicItem[] {
  return MEDIA_ITEMS.filter(
    (item): item is MusicItem => item.category === "music"
  );
}

/**
 * Load the manifest lazily from its JSON module (kept async on
 * purpose: callers stay shape-stable if the data layer ever streams).
 */
export async function listMusic(): Promise<MusicItem[]> {
  return getMusicItems();
}

export {
  getActionLabel,
  getCatalogLabel,
  getDirectAudioKind,
  getDownloadLabel,
  getMediaFilterForItem,
  getPreviewGlyph,
  isValidDirectMediaUrl,
  MIME_BY_AUDIO_KIND,
  MEDIA_FILTERS,
  normalizeMediaItem
} from "@/lib/media/normalize";

export type {
  ArtItem,
  BookItem,
  ContentsSource,
  DirectSource,
  MediaCategory,
  MediaFilter,
  MediaItem,
  MediaKind,
  MediaManifest,
  MediaSource,
  MusicItem,
  VideoItem
} from "@/lib/media/normalize";
