/*
 * audioMetadata.mjs — build-time embedded-metadata extraction.
 *
 * Orchestrates format detection + parsers (id3 / mpeg / mp4 / flac)
 * over HTTP range windows. The BROWSER never runs this module: the
 * sync script executes it in CI and merges the results into
 * data/media.json, so visitors only ever download the manifest.
 *
 * Range strategy per file (never the whole file unless it is tiny):
 *   1. bytes=0-0          → learn total size (Content-Range)
 *   2. bytes=0-<HEAD-1>   → header/tag window (ID3, fLaC, MP4 head)
 *   3. for MP4 without a complete moov in the head window:
 *        bytes=<tail>     → tail window (moov often sits at the end)
 *        plus, when the moov atom declares a larger body, one exact
 *        range fetch for the remainder
 *
 * `fetchRange(url, start, endInclusive)` is injected — tests use an
 * in-memory server; the sync script uses global fetch.
 */

import { parseId3v2 } from "./id3.mjs";
import {
  computeMp3Duration
} from "./mpeg.mjs";
import {
  parseMp4Metadata,
  looksLikeMp4
} from "./mp4.mjs";
import { parseFlacMetadata } from "./flac.mjs";
import { parseWavMetadata } from "./wav.mjs";

const HEAD_WINDOW = 256 * 1024;

const TAIL_WINDOW = 256 * 1024;

/*
 * Files at or below this size are fetched in one request instead of
 * the range dance — a full single request is cheaper than three
 * round-trips for genuinely tiny clips. Real music tracks exceed it
 * and always take the range path.
 */
const TINY_FILE_LIMIT = 1024 * 1024;

/**
 * Normalize extracted fields into the manifest's music contract
 * (only finite, positive, defined values survive).
 */
function normalizeFields(raw) {
  const fields = {};

  if (!raw) {
    return fields;
  }

  for (const key of [
    "title",
    "artist",
    "album",
    "albumArtist",
    "year",
    "genre",
    "composer",
    "comment"
  ]) {
    if (typeof raw[key] === "string" && raw[key].length > 0) {
      fields[key] = raw[key];
    }
  }

  for (const key of [
    "trackNumber",
    "trackTotal",
    "discNumber",
    "discTotal"
  ]) {
    if (Number.isInteger(raw[key]) && raw[key] > 0) {
      fields[key] = raw[key];
    }
  }

  return fields;
}

function normalizeDuration(seconds) {
  if (
    typeof seconds === "number" &&
    Number.isFinite(seconds) &&
    seconds > 0
  ) {
    return Math.round(seconds * 1000) / 1000;
  }

  return undefined;
}

/**
 * Extract embedded metadata for one audio file.
 *
 * @param {object} options
 * @param {string} options.url — absolute audio URL
 * @param {"mp3"|"m4a"|"flac"|"wav"} options.kind
 * @param {(url: string, start: number, end: number|null) => Promise<{
 *   status: number, arrayBuffer: ArrayBuffer, contentRange?: string|null,
 *   acceptRanges?: boolean
 * }>} options.fetchRange
 * @returns {Promise<{ fields: object, duration?: number, exact: boolean,
 *   source: "embedded"|"none" }>}
 */
export async function extractAudioMetadata({
  url,
  kind,
  fetchRange
}) {
  if (kind === "mp4") {
    /* Videos are not extracted; the caller never asks for mp4. */
    return { fields: {}, exact: false, source: "none" };
  }

  let totalSize = null;

  let supportsRanges = false;

  /*
   * Probe: 1-byte range returns 206 + Content-Range on range-capable
   * servers, or 200 with the full body otherwise (tiny files only).
   */
  const probe = await fetchRange(url, 0, 0);

  if (probe.status === 206) {
    supportsRanges = true;

    const match = probe.contentRange?.match(/\/(\d+)$/);

    if (match) {
      totalSize = Number(match[1]);
    }
  } else if (probe.status === 200) {
    totalSize = probe.arrayBuffer.byteLength;
  } else {
    return { fields: {}, exact: false, source: "none" };
  }

  /* Tiny files: one full read is cheaper than three range dances. */
  if (
    totalSize !== null &&
    totalSize <= TINY_FILE_LIMIT
  ) {
    const full = await fetchRange(url, 0, totalSize - 1);

    const bytes = new Uint8Array(full.arrayBuffer);

    return extractFromHeadBytes({
      bytes,
      kind,
      fileSize: totalSize
    });
  }

  if (!supportsRanges) {
    /* Server without ranges and unknown size: extract nothing. */
    return { fields: {}, exact: false, source: "none" };
  }

  const headEnd = Math.min(
    HEAD_WINDOW,
    totalSize ?? HEAD_WINDOW
  ) - 1;

  const head = await fetchRange(url, 0, headEnd);

  const headBytes = new Uint8Array(head.arrayBuffer);

  if (kind === "m4a") {
    return extractMp4WithRanges({
      url,
      headBytes,
      totalSize,
      fetchRange
    });
  }

  return extractFromHeadBytes({
    bytes: headBytes,
    kind,
    fileSize: totalSize
  });
}

/**
 * MP4: the moov atom may live at the tail. Try the head window
 * first; when absent, fetch the tail window and retry.
 */
async function extractMp4WithRanges({
  url,
  headBytes,
  totalSize,
  fetchRange
}) {
  let parsed = parseMp4Metadata(headBytes);

  if (parsed) {
    return {
      fields: normalizeFields(parsed.fields),
      duration: normalizeDuration(parsed.durationSeconds),
      exact: parsed.durationSeconds !== undefined,
      source: Object.keys(parsed.fields).length > 0 || parsed.durationSeconds !== undefined
        ? "embedded"
        : "none"
    };
  }

  if (totalSize === null || totalSize <= headBytes.length) {
    return { fields: {}, exact: false, source: "none" };
  }

  const tailStart = Math.max(
    0,
    totalSize - TAIL_WINDOW
  );

  const tail = await fetchRange(
    url,
    tailStart,
    totalSize - 1
  );

  const tailBytes = new Uint8Array(tail.arrayBuffer);

  parsed = parseMp4Metadata(tailBytes);

  if (!parsed) {
    return { fields: {}, exact: false, source: "none" };
  }

  return {
    fields: normalizeFields(parsed.fields),
    duration: normalizeDuration(parsed.durationSeconds),
    exact: parsed.durationSeconds !== undefined,
    source: "embedded"
  };
}

/**
 * Head-window extraction for MP3 (ID3 + duration), FLAC, and M4A
 * (the m4a path applies when the whole file fit in one window, so
 * moov is guaranteed present).
 */
function extractFromHeadBytes({
  bytes,
  kind,
  fileSize
}) {
  if (kind === "m4a") {
    const parsed = parseMp4Metadata(bytes);

    if (!parsed) {
      return { fields: {}, exact: false, source: "none" };
    }

    const fields = normalizeFields(parsed.fields);

    const duration = normalizeDuration(parsed.durationSeconds);

    return {
      fields,
      duration,
      exact: duration !== undefined,
      source:
        Object.keys(fields).length > 0 || duration !== undefined
          ? "embedded"
          : "none"
    };
  }

  if (kind === "flac") {
    const parsed = parseFlacMetadata(bytes);

    if (!parsed) {
      return { fields: {}, exact: false, source: "none" };
    }

    const fields = normalizeFields(parsed.fields);

    const duration = normalizeDuration(parsed.durationSeconds);

    return {
      fields,
      duration,
      exact: duration !== undefined,
      source:
        Object.keys(fields).length > 0 || duration !== undefined
          ? "embedded"
          : "none"
    };
  }

  if (kind === "wav") {
    const parsed = parseWavMetadata(bytes);

    if (!parsed) {
      return { fields: {}, exact: false, source: "none" };
    }

    const fields = normalizeFields(parsed.fields);

    const duration = normalizeDuration(parsed.durationSeconds);

    return {
      fields,
      duration,
      exact: duration !== undefined,
      source:
        Object.keys(fields).length > 0 || duration !== undefined
          ? "embedded"
          : "none"
    };
  }

  /* MP3 */
  const id3 = parseId3v2(bytes);

  const fields = normalizeFields(id3?.fields);

  let duration;

  if (id3 && bytes.length > id3.tagBytes) {
    duration = normalizeDuration(
      computeMp3Duration(bytes, fileSize)
    );
  } else if (!id3) {
    duration = normalizeDuration(
      computeMp3Duration(bytes, fileSize)
    );
  }

  return {
    fields,
    duration,
    exact: duration !== undefined,
    source:
      Object.keys(fields).length > 0 || duration !== undefined
        ? "embedded"
        : "none"
  };
}
