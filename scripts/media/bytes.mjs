/*
 * bytes.mjs — byte-level primitives shared by the media metadata
 * parsers (scripts/media/*) and the media test suite.
 *
 * Zero dependencies by law (see validate-media-manifest.mjs): the
 * same modules run in CI (build-time extraction), locally, and under
 * `node --test`. Every function is pure over Uint8Array/DataView.
 */

/**
 * Read an unsigned 32-bit big-endian value.
 */
export function readUint32BE(
  bytes,
  offset
) {
  return (
    ((bytes[offset] & 0xff) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff)
  ) >>> 0;
}

/**
 * Read an unsigned 32-bit little-endian value.
 */
export function readUint32LE(
  bytes,
  offset
) {
  return (
    ((bytes[offset + 3] & 0xff) << 24) |
    ((bytes[offset + 2] & 0xff) << 16) |
    ((bytes[offset + 1] & 0xff) << 8) |
    (bytes[offset] & 0xff)
  ) >>> 0;
}

/**
 * ID3 "syncsafe" integer: four 7-bit groups packed into 28 bits.
 * Used by ID3v2 tag and frame sizes (v2.4 frames always, v2.3 tags).
 */
export function readSyncSafeUint32BE(
  bytes,
  offset
) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  ) >>> 0;
}

/**
 * Four-character ASCII code (atom/frame identifier).
 */
export function readFourCc(
  bytes,
  offset
) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

/**
 * True when `bytes` starts with the ASCII sequence `marker`.
 */
export function startsWithAscii(
  bytes,
  marker
) {
  if (bytes.length < marker.length) {
    return false;
  }

  for (let index = 0; index < marker.length; index += 1) {
    if (bytes[index] !== marker.charCodeAt(index)) {
      return false;
    }
  }

  return true;
}

/**
 * Find the ASCII byte sequence `marker` in `bytes` starting at
 * `from` (inclusive). Returns -1 when absent.
 */
export function indexOfAscii(
  bytes,
  marker,
  from = 0
) {
  const limit = bytes.length - marker.length;

  for (let index = from; index <= limit; index += 1) {
    let matched = true;

    for (let offset = 0; offset < marker.length; offset += 1) {
      if (bytes[index + offset] !== marker.charCodeAt(offset)) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return index;
    }
  }

  return -1;
}

/**
 * Decode a text buffer using an ID3 encoding byte:
 *   0 ISO-8859-1, 1 UTF-16 (BOM determines order),
 *   2 UTF-16BE, 3 UTF-8.
 * Latin-1 is decoded manually (every byte maps 1:1 to a code point);
 * multi-byte encodings use TextDecoder.
 */
export function decodeId3Text(
  bytes,
  encoding
) {
  if (bytes.length === 0) {
    return "";
  }

  if (encoding === 0) {
    let text = "";

    for (let index = 0; index < bytes.length; index += 1) {
      text += String.fromCharCode(bytes[index]);
    }

    return text;
  }

  if (encoding === 1) {
    if (
      bytes.length >= 2 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xfe
    ) {
      return new TextDecoder("utf-16le").decode(
        bytes.subarray(2)
      );
    }

    if (
      bytes.length >= 2 &&
      bytes[0] === 0xfe &&
      bytes[1] === 0xff
    ) {
      return new TextDecoder("utf-16be").decode(
        bytes.subarray(2)
      );
    }

    /* No BOM: ID3v2.3 defaults to UTF-16BE without one in the wild. */
    return new TextDecoder("utf-16be").decode(bytes);
  }

  if (encoding === 2) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Split a decoded ID3 text value on null separators and trim
 * whitespace from each part (multiple values are legal in v2.4).
 */
export function splitNullSeparated(text) {
  return text
    .split("\u0000")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Subset of the ID3v1 genre list (the 80 canonical entries) used to
 * resolve numeric genre references like "(13)" or bare "13".
 */
const ID3V1_GENRES = [
  "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk",
  "Grunge", "Hip-Hop", "Jazz", "Metal", "New Age", "Oldies",
  "Other", "Pop", "R&B", "Rap", "Reggae", "Rock", "Techno",
  "Industrial", "Alternative", "Ska", "Death Metal", "Pranks",
  "Soundtrack", "Euro-Techno", "Ambient", "Trip-Hop", "Vocal",
  "Jazz+Funk", "Fusion", "Trance", "Classical", "Instrumental",
  "Acid", "House", "Game", "Sound Clip", "Gospel", "Noise",
  "Alternative Rock", "Bass", "Soul", "Punk", "Space", "Meditative",
  "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic",
  "Darkwave", "Techno-Industrial", "Electronic", "Pop-Folk",
  "Eurodance", "Dream", "Southern Rock", "Comedy", "Cult", "Gangsta",
  "Top 40", "Christian Rap", "Pop/Funk", "Jungle", "Native US",
  "Cabaret", "New Wave", "Psychadelic", "Rave", "Showtunes",
  "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka",
  "Retro", "Musical", "Rock & Roll", "Hard Rock"
];

/**
 * Normalize an ID3 genre value: "(13)" and "13" resolve through the
 * ID3v1 table; refinement forms like "(13)Prog" keep the refinement.
 * Anything non-numeric passes through untouched (no guessing).
 */
export function normalizeGenre(value) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const bracketed = trimmed.match(/^\((\d+)\)\s*(.*)$/);

  if (bracketed) {
    const index = Number(bracketed[1]);
    const refinement = bracketed[2].trim();

    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < ID3V1_GENRES.length
    ) {
      return refinement.length > 0
        ? refinement
        : ID3V1_GENRES[index];
    }

    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed);

    if (index < ID3V1_GENRES.length) {
      return ID3V1_GENRES[index];
    }
  }

  return trimmed;
}

/**
 * "7/12" → { index: 7, total: 12 } (also accepts a bare "7").
 * Returns null for values without a leading integer.
 */
export function parseSlashPair(value) {
  const match = value
    .trim()
    .match(/^(\d+)(?:\s*\/\s*(\d+))?$/);

  if (!match) {
    return null;
  }

  return {
    index: Number(match[1]),
    total: match[2] ? Number(match[2]) : undefined
  };
}

/**
 * Format seconds as m:ss (hours are prefixed when present).
 * Non-finite input yields null — the UI never shows fake time.
 */
export function formatDuration(seconds) {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return null;
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const twoDigits = String(secs).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${twoDigits}`
    : `${minutes}:${twoDigits}`;
}
