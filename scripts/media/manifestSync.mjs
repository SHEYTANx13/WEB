/*
 * manifestSync.mjs — core of the Media manifest sync (testable).
 *
 * Pipeline (executed by scripts/sync-media-manifest.mjs in CI):
 *
 *   1. fetch the external Contents library manifest
 *      (Parsaetak/Contents/Projects/library.json — external contract,
 *      never renamed) and normalise its items
 *   2. fetch the OPTIONAL music manifest (Projects/music.json).
 *      A 404/absent file is the documented "no Music source" state —
 *      the pipeline continues with zero tracks and never fabricates
 *      music.
 *   3. for every CONTENTS music item: extract embedded metadata over
 *      HTTP range requests (scripts/media/audioMetadata.mjs) and
 *      resolve the cover path deterministically
 *      (scripts/media/covers.mjs)
 *   4. for every DIRECT music item (external absolute http(s) URL,
 *      v4.0.2): pass it through VERBATIM — WEB never fetches, proxies,
 *      or downloads direct media at build time; the browser receives
 *      the URL only when playback is requested
 *   5. write data/media.json (version 4) — the app's only data input,
 *      with an explicit `sourceType` discriminator on every item
 *
 * Everything network-shaped is injected: `fetchJson`, `fetchRange`,
 * `exists` (remote path probe). Tests provide deterministic fakes.
 */

import { extractAudioMetadata } from "./audioMetadata.mjs";
import { resolveCoverPath } from "./covers.mjs";

const MUSIC_KIND_BY_EXTENSION = {
  mp3: "mp3",
  m4a: "m4a",
  flac: "flac",
  wav: "wav"
};

function extensionOf(path) {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)$/);

  return match ? match[1] : null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Absolute http/https URL gate for direct sources — shared shape with
 * scripts/media/manifestSchema.mjs (kept local: zero-dependency module).
 */
export function isValidDirectMediaUrl(url) {
  if (!isNonEmptyString(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

/**
 * Normalise one raw manifest record into the canonical Media item.
 * Returns { item } or { error } (with a human-readable reason).
 *
 * DIRECT RECORDS (v4.0.2): a `url` field (with `branch`/`source`
 * absent, or `sourceType: "direct"` explicit) builds a direct item —
 * audio-only, validated as an absolute http/https URL, enriched with
 * NOTHING (no fetches). Every normalised item carries an explicit
 * `sourceType`; the runtime never infers source shapes from URLs.
 */
export function normalizeRawItem(raw, origin) {
  if (
    typeof raw !== "object" ||
    raw === null
  ) {
    return { error: `${origin}: item is not an object` };
  }

  for (const field of ["title"]) {
    if (!isNonEmptyString(raw[field])) {
      return {
        error: `${origin}: item is missing a valid \`${field}\` string`
      };
    }
  }

  const wantsDirect =
    raw.sourceType === "direct" ||
    (isNonEmptyString(raw.url) &&
      !isNonEmptyString(raw.branch) &&
      !isNonEmptyString(raw.source));

  let type = raw.type;

  /* The external library contract historically used "audio". */
  if (type === "audio") {
    type = "music";
  }

  if (!["book", "music", "video", "art"].includes(type)) {
    return {
      error: `${origin}: unknown type ${JSON.stringify(raw.type)}`
    };
  }

  if (wantsDirect) {
    return normalizeDirectItem(raw, type, origin);
  }

  for (const field of ["branch", "source"]) {
    if (!isNonEmptyString(raw[field])) {
      return {
        error: `${origin}: item is missing a valid \`${field}\` string`
      };
    }
  }

  const item = {
    sourceType: "contents",
    branch: raw.branch,
    source: raw.source,
    title: raw.title,
    type
  };

  copyDescriptiveFields(raw, item);

  return { item };
}

function normalizeDirectItem(raw, type, origin) {
  if (!isNonEmptyString(raw.url)) {
    return {
      error: `${origin}: sourceType "direct" requires a \`url\` string`
    };
  }

  if (!isValidDirectMediaUrl(raw.url)) {
    return {
      error: `${origin}: direct \`url\` must be an absolute http/https URL (got ${JSON.stringify(raw.url)})`
    };
  }

  if (type !== "music") {
    return {
      error: `${origin}: direct sources must be type "music" (got ${JSON.stringify(raw.type)}) — direct media is audio-only in this release`
    };
  }

  const item = {
    sourceType: "direct",
    url: raw.url,
    title: raw.title,
    type
  };

  if (isNonEmptyString(raw.mimeType)) {
    item.mimeType = raw.mimeType;
  }

  copyDescriptiveFields(raw, item);

  /* A direct cover is an absolute URL, copied verbatim; a relative
   * path cannot resolve without a branch and is refused loudly. */
  if (isNonEmptyString(raw.cover)) {
    if (!isValidDirectMediaUrl(raw.cover)) {
      return {
        error: `${origin}: direct item \`cover\` must be an absolute http(s) URL (got ${JSON.stringify(raw.cover)})`
      };
    }

    item.cover = raw.cover;
  }

  return { item };
}

function copyDescriptiveFields(raw, item) {
  const copyStrings = [
    "subtitle",
    "description",
    "year",
    "language",
    "author",
    "series",
    "status",
    "readingTime",
    "artist",
    "album",
    "albumArtist",
    "genre",
    "composer",
    "comment"
  ];

  for (const field of copyStrings) {
    if (isNonEmptyString(raw[field])) {
      item[field] = raw[field];
    }
  }

  /* Contents-style relative cover paths (probed on the branch CDN).
   * Direct covers were already handled in normalizeDirectItem. */
  if (
    item.sourceType === "contents" &&
    isNonEmptyString(raw.cover)
  ) {
    item.cover = raw.cover;
  }

  /*
   * Numeric descriptive/music fields: copied when finite. For
   * DIRECT items the publisher's duration is the ONLY duration
   * (there is no embedded extraction); for contents items a manifest
   * duration supplements a failed extraction instead of vanishing.
   */
  for (const field of [
    "volume",
    "duration",
    "trackNumber",
    "trackTotal",
    "discNumber",
    "discTotal"
  ]) {
    if (Number.isFinite(raw[field])) {
      item[field] = raw[field];
    }
  }

  if (typeof raw.featured === "boolean") {
    item.featured = raw.featured;
  }

  if (
    Array.isArray(raw.tags) &&
    raw.tags.every((tag) => isNonEmptyString(tag))
  ) {
    item.tags = [...raw.tags];
  }
}

/**
 * Build one branch-CDN probe (`exists`) from `fetchRange` — a HEAD
 * would be enough, but range GET of one byte works on every static
 * CDN and gives us status precision for free.
 */
function createExistsProbe(fetchRange) {
  const cache = new Map();

  return async (url) => {
    const cached = cache.get(url);

    if (cached !== undefined) {
      return cached;
    }

    let result = false;

    try {
      const response = await fetchRange(url, 0, 0);

      result = response.status === 200 || response.status === 206;
    } catch {
      result = false;
    }

    cache.set(url, result);

    return result;
  };
}

/**
 * Enrich one music item with embedded metadata + cover resolution.
 * Never throws: extraction problems downgrade to manifest metadata
 * with a returned warning string.
 *
 * DIRECT SOURCES (v4.0.2) are returned UNTOUCHED before any network
 * probe happens — WEB never downloads or range-fetches direct media
 * at build time; the manifest's own metadata is all a direct track
 * will ever carry, and its provenance stays "manifest".
 */
export async function enrichMusicItem({
  item,
  branchBaseUrl,
  fetchRange,
  warn = () => {}
}) {
  if (item.sourceType === "direct") {
    if (
      item.artist ||
      item.album ||
      item.duration !== undefined
    ) {
      return {
        item: {
          ...item,
          metadataSource: "manifest"
        }
      };
    }

    return { item };
  }

  const extension = extensionOf(item.source);

  const kind = MUSIC_KIND_BY_EXTENSION[extension ?? ""];

  const enriched = { ...item };

  if (!kind) {
    return {
      item: enriched,
      warning: `unsupported audio extension: ${item.source}`
    };
  }

  const audioUrl = `${branchBaseUrl}/${item.branch}/${item.source
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const probeExists = createExistsProbe(fetchRange);

  /* Cover resolution runs first (cheap HEAD-ish probes). */
  try {
    const exists = async (path) =>
      probeExists(`${branchBaseUrl}/${item.branch}/${path.split("/").map(encodeURIComponent).join("/")}`);

    const coverPath = await resolveCoverPath(item, exists);

    if (coverPath) {
      enriched.cover = coverPath;
    }
  } catch (reason) {
    warn(
      `cover resolution failed for ${item.source}: ${reason instanceof Error ? reason.message : String(reason)}`
    );
  }

  /* Embedded metadata extraction (range windows only). */
  try {
    const extracted = await extractAudioMetadata({
      url: audioUrl,
      kind,
      fetchRange
    });

    if (extracted.source === "embedded") {
      const merged = { ...extracted.fields };

      /* Manifest values win only where extraction found nothing. */
      for (const field of ["artist", "album", "albumArtist", "genre", "composer", "comment", "year"]) {
        if (
          enriched[field] !== undefined &&
          merged[field] === undefined
        ) {
          merged[field] = enriched[field];
        }
      }

      if (extracted.duration !== undefined) {
        merged.duration = extracted.duration;
      }

      for (const [key, value] of Object.entries(merged)) {
        enriched[key] = value;
      }

      enriched.metadataSource = "embedded";
    } else {
      /* Extraction found nothing usable (404, unparsable, empty tags)
       * — keep honest manifest metadata and warn so the source can be
       * checked. Never invent fields. */
      warn(
        `no embedded metadata found for ${item.source} — falling back to manifest values`
      );

      if (
        enriched.artist ||
        enriched.album ||
        enriched.duration !== undefined
      ) {
        enriched.metadataSource = "manifest";
      }
    }
  } catch (reason) {
    warn(
      `metadata extraction failed for ${item.source}: ${reason instanceof Error ? reason.message : String(reason)}`
    );

    enriched.metadataSource = "manifest";
  }

  return { item: enriched };
}

/**
 * Compose the final manifest object from raw sources.
 *
 * @param {object} options
 * @param {{ items: unknown[], updated?: string }} options.library
 * @param {{ items?: unknown[], updated?: string } | null} options.music
 * @param {string} options.branchBaseUrl — CDN base for branch files
 * @param options.fetchRange / options.warn — injected
 * @returns {Promise<{ manifest: object, warnings: string[] }>}
 */
export async function buildMediaManifest({
  library,
  music,
  branchBaseUrl,
  fetchRange
}) {
  const warnings = [];

  const items = [];

  for (const [index, raw] of (library?.items ?? []).entries()) {
    const normalized = normalizeRawItem(
      raw,
      `library.json items[${index}]`
    );

    if (normalized.error) {
      warnings.push(normalized.error);
      continue;
    }

    items.push(normalized.item);
  }

  for (const [index, raw] of (music?.items ?? []).entries()) {
    /*
     * The music manifest's items ARE music: the type defaults to
     * "music" so authors list bare file records, while an explicit
     * wrong type still fails loudly (no silent coercion of books).
     */
    const normalized = normalizeRawItem(
      { type: "music", ...raw },
      `music.json items[${index}]`
    );

    if (normalized.error) {
      warnings.push(normalized.error);
      continue;
    }

    const item = normalized.item;

    if (item.type !== "music") {
      warnings.push(
        `music.json items[${index}]: type must be "music" (got ${item.type}) — skipped`
      );
      continue;
    }

    const enriched = await enrichMusicItem({
      item,
      branchBaseUrl,
      fetchRange,
      warn: (message) => warnings.push(message)
    });

    if (enriched.warning) {
      warnings.push(
        `music.json items[${index}]: ${enriched.warning}`
      );
    }

    items.push(enriched.item);
  }

  const updated =
    (music && isNonEmptyString(music.updated) ? music.updated : null) ??
    (isNonEmptyString(library?.updated) ? library.updated : null) ??
    new Date().toISOString().slice(0, 10);

  return {
    manifest: {
      version: 4,
      updated,
      items
    },
    warnings
  };
}
