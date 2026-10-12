/*
 * manifestSchema.mjs — structural contract for data/media.json (v4).
 *
 * Shared by scripts/validate-media-manifest.mjs (the CI gate), the
 * sync writer, and the media test suite. Zero dependencies.
 *
 * Schema (version 4, the Global Music release):
 *   {
 *     version: 4,
 *     updated: "YYYY-MM-DD",
 *     items: [
 *       {
 *         sourceType: "contents" | "direct",   // explicit (v4.0.2)
 *         // contents shape:
 *         branch:  string  — Contents repository branch
 *         source:  string  — file path inside that branch
 *         // direct shape (music only):
 *         url:     string  — absolute http(s) media URL
 *         mimeType: string — optional publisher-declared MIME type
 *         title:   string
 *         type:    "book" | "music" | "video" | "art"
 *         ...optional descriptive fields (subtitle, description, year,
 *            language, author, series, volume, featured, status,
 *            readingTime, tags, cover)
 *         ...music-only fields (artist, album, albumArtist, year, genre,
 *            trackNumber, discNumber, composer, comment, duration,
 *            trackTotal, discTotal, metadataSource)
 *       }
 *     ]
 *   }
 *
 * Source rules (v4.0.2):
 *   - `sourceType: "direct"` (music only): `url` must be an absolute
 *     http/https URL — malformed URLs are rejected here, at manifest
 *     validation time. Direct items must NOT carry branch/source and
 *     are never fetched, proxied, or downloaded by WEB at build time.
 *   - `sourceType: "contents"` (or absent — legacy records): the
 *     historical branch + source contract, unchanged.
 *   - The audio kind of a direct item must resolve from the URL's
 *     pathname extension or the declared mimeType (extensionless URLs
 *     are legal only with a mapping MIME type).
 *
 * The legacy type "audio" is NOT accepted here: the sync step
 * normalises it to "music" before the manifest is ever written.
 */

const CANONICAL_TYPES = new Set([
  "book",
  "music",
  "video",
  "art"
]);

const TYPE_EXTENSIONS = {
  book: new Set(["pdf"]),
  music: new Set(["mp3", "m4a", "flac", "wav"]),
  video: new Set(["mp4"]),
  art: new Set(["png", "jpg", "jpeg", "webp", "gif"])
};

const AUDIO_KIND_BY_MIME = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "m4a",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/vnd.wave": "wav"
};

const OPTIONAL_STRINGS = new Set([
  "subtitle",
  "description",
  "year",
  "language",
  "author",
  "series",
  "status",
  "readingTime",
  "cover",
  "artist",
  "album",
  "albumArtist",
  "genre",
  "composer",
  "comment"
]);

const OPTIONAL_NUMBERS = new Set([
  "volume",
  "trackNumber",
  "trackTotal",
  "discNumber",
  "discTotal",
  "duration"
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Absolute http/https URL check (the direct-source gate).
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
 * Audio kind of a direct URL from its pathname extension, with the
 * declared MIME as the extensionless fallback. null = unresolvable.
 */
export function resolveDirectAudioKind(url, mimeType) {
  let pathname = "";

  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  const extension = pathname.split(".").pop()?.toLowerCase();

  if (extension && TYPE_EXTENSIONS.music.has(extension)) {
    return extension;
  }

  if (isNonEmptyString(mimeType)) {
    return (
      AUDIO_KIND_BY_MIME[mimeType.toLowerCase().split(";")[0]] ??
      null
    );
  }

  return null;
}

/**
 * Validate a parsed manifest object.
 * Returns an array of error strings (empty = valid).
 */
export function validateMediaManifest(manifest) {
  const errors = [];

  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    return ["manifest must be a JSON object"];
  }

  if (manifest.version !== 4) {
    errors.push(
      `manifest field \`version\` must be 4 (got ${JSON.stringify(manifest.version)})`
    );
  }

  if (!isNonEmptyString(manifest.updated)) {
    errors.push("manifest field `updated` must be a non-empty string");
  }

  if (!Array.isArray(manifest.items)) {
    errors.push("manifest field `items` must be an array");

    return errors;
  }

  manifest.items.forEach((item, index) => {
    const label = `items[${index}]`;

    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item)
    ) {
      errors.push(`${label} must be an object`);
      return;
    }

    if (!isNonEmptyString(item.title)) {
      errors.push(`${label} is missing a valid \`title\` string`);
    }

    if (!isNonEmptyString(item.type)) {
      errors.push(`${label} is missing a valid \`type\` string`);
    }

    if (item.sourceType !== undefined) {
      if (
        item.sourceType !== "contents" &&
        item.sourceType !== "direct"
      ) {
        errors.push(
          `${label} field \`sourceType\` must be "contents" or "direct" (got ${JSON.stringify(item.sourceType)})`
        );

        return;
      }
    }

    if (item.mimeType !== undefined && !isNonEmptyString(item.mimeType)) {
      errors.push(
        `${label} field \`mimeType\` must be a non-empty string when present`
      );
    }

    if (!CANONICAL_TYPES.has(item.type)) {
      if (item.type === "audio") {
        errors.push(
          `${label} uses legacy type \`audio\` — the sync step must normalise it to \`music\``
        );
      } else if (isNonEmptyString(item.type)) {
        errors.push(
          `${label} has unknown type ${JSON.stringify(item.type)} — expected one of book, music, video, art`
        );
      }

      return;
    }

    if (item.sourceType === "direct") {
      validateDirectItem(item, label, errors);

      return;
    }

    validateContentsItem(item, label, errors);

    if (
      typeof item.metadataSource !== "undefined" &&
      item.metadataSource !== "embedded" &&
      item.metadataSource !== "manifest"
    ) {
      errors.push(
        `${label} field \`metadataSource\` must be "embedded" or "manifest"`
      );
    }
  });

  return errors;
}

/**
 * Contents item: branch + source path, extension matches the type.
 */
function validateContentsItem(item, label, errors) {
  for (const field of ["branch", "source"]) {
    if (!isNonEmptyString(item[field])) {
      errors.push(
        `${label} (sourceType ${item.sourceType === "direct" ? "direct" : "contents"}) is missing a valid \`${field}\` string`
      );
    }
  }

  if (isNonEmptyString(item.url)) {
    errors.push(
      `${label} (contents source) must not carry a direct \`url\` field`
    );
  }

  const extension = isNonEmptyString(item.source)
    ? item.source.split(".").pop()?.toLowerCase()
    : null;

  if (extension) {
    const allowed = TYPE_EXTENSIONS[item.type];

    if (allowed && !allowed.has(extension)) {
      errors.push(
        `${label} type \`${item.type}\` does not allow .${extension} sources (allowed: ${[...allowed].join(", ")})`
      );
    }
  }

  validateCommonFields(item, label, errors);
}

/**
 * Direct item: absolute http(s) URL, music only, resolvable audio
 * kind, no repository fields, no embedded-metadata claims.
 */
function validateDirectItem(item, label, errors) {
  if (!isNonEmptyString(item.url)) {
    errors.push(
      `${label} (sourceType "direct") is missing a valid \`url\` string`
    );

    return;
  }

  if (!isValidDirectMediaUrl(item.url)) {
    errors.push(
      `${label} (sourceType "direct") has a malformed \`url\` — only absolute http/https URLs are allowed (got ${JSON.stringify(item.url)})`
    );

    return;
  }

  if (item.type !== "music") {
    errors.push(
      `${label} (sourceType "direct") must be type \`music\` (got ${JSON.stringify(item.type)}) — direct sources are audio-only in this release`
    );

    return;
  }

  for (const field of ["branch", "source"]) {
    if (isNonEmptyString(item[field])) {
      errors.push(
        `${label} (sourceType "direct") must not carry the contents-only field \`${field}\``
      );
    }
  }

  if (isNonEmptyString(item.cover) && !isValidDirectMediaUrl(item.cover)) {
    errors.push(
      `${label} (sourceType "direct") field \`cover\` must be an absolute http(s) URL (contents-style relative cover paths are not resolvable for direct items)`
    );
  }

  const kind = resolveDirectAudioKind(item.url, item.mimeType);

  if (!kind) {
    errors.push(
      `${label} (sourceType "direct") audio kind cannot be resolved — the URL needs a .mp3/.m4a/.flac/.wav pathname extension or a mapping \`mimeType\``
    );
  }

  if (item.metadataSource === "embedded") {
    errors.push(
      `${label} (sourceType "direct") must not claim \`metadataSource: "embedded"\` — WEB never downloads direct files to extract tags`
    );
  }

  validateCommonFields(item, label, errors);
}

/**
 * Fields shared by both source shapes.
 */
function validateCommonFields(item, label, errors) {
  if (
    typeof item.featured !== "undefined" &&
    typeof item.featured !== "boolean"
  ) {
    errors.push(
      `${label} field \`featured\` must be a boolean when present`
    );
  }

  if (Array.isArray(item.tags)) {
    if (item.tags.some((tag) => !isNonEmptyString(tag))) {
      errors.push(`${label} field \`tags\` must contain non-empty strings`);
    }
  } else if (typeof item.tags !== "undefined") {
    errors.push(`${label} field \`tags\` must be an array when present`);
  }

  for (const [key, value] of Object.entries(item)) {
    if (OPTIONAL_STRINGS.has(key)) {
      if (value !== undefined && !isNonEmptyString(value)) {
        errors.push(`${label} field \`${key}\` must be a non-empty string`);
      }

      continue;
    }

    if (OPTIONAL_NUMBERS.has(key)) {
      if (
        value !== undefined &&
        (typeof value !== "number" || !Number.isFinite(value))
      ) {
        errors.push(`${label} field \`${key}\` must be a finite number`);
      }

      if (
        key === "duration" &&
        typeof value === "number" &&
        value < 0
      ) {
        errors.push(`${label} field \`duration\` must not be negative`);
      }

      continue;
    }

    if (
      key !== "branch" &&
      key !== "source" &&
      key !== "title" &&
      key !== "type" &&
      key !== "tags" &&
      key !== "featured" &&
      key !== "metadataSource" &&
      key !== "sourceType" &&
      key !== "url" &&
      key !== "mimeType"
    ) {
      errors.push(`${label} has unknown field \`${key}\``);
    }
  }
}
