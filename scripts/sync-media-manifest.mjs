#!/usr/bin/env node
/*
 * sync-media-manifest.mjs — Sync Media manifest (CI step).
 *
 * Replaces the former raw `curl` of the external library manifest and
 * keeps the external contract byte-compatible:
 *
 *   https://raw.githubusercontent.com/Parsaetak/Contents/Projects/library.json
 *
 * That external FILE keeps its historical name; inside the WEB
 * repository everything is Media: the fetched data is normalised,
 * merged with the OPTIONAL music manifest, enriched with embedded
 * audio metadata (HTTP range requests — the browser never parses
 * audio metadata), and written to data/media.json (version 3).
 *
 * The music manifest (Projects/music.json) does not exist yet — its
 * absence is the documented empty-Music state, not an error. The
 * pipeline must never fabricate tracks to fill it.
 *
 * Environment:
 *   MEDIA_LIBRARY_URL — override the external library URL (tests)
 *   MEDIA_MUSIC_URL   — override the external music URL (tests)
 *   MEDIA_SYNC_TIMEOUT_MS — per-request timeout (default 30000)
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildMediaManifest } from "./media/manifestSync.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const OUTPUT_PATH = path.join(ROOT, "data", "media.json");

const LIBRARY_URL =
  process.env.MEDIA_LIBRARY_URL ??
  "https://raw.githubusercontent.com/Parsaetak/Contents/Projects/library.json";

const MUSIC_URL =
  process.env.MEDIA_MUSIC_URL ??
  "https://raw.githubusercontent.com/Parsaetak/Contents/Projects/music.json";

const TIMEOUT_MS = Number(
  process.env.MEDIA_SYNC_TIMEOUT_MS ?? 30000
);

/**
 * Plain-fetch JSON with a hard timeout. Returns null on HTTP 404 —
 * the caller decides whether absence is acceptable (music: yes).
 */
async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "Parsaetak-WEB-media-sync" }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

/**
 * Range fetch for the metadata extractor (bytes start..end inclusive).
 */
async function fetchRange(url, start, end) {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  return {
    status: response.status,
    arrayBuffer: await response.arrayBuffer(),
    contentRange: response.headers.get("content-range"),
    acceptRanges: response.headers.get("accept-ranges")
  };
}

function warn(message) {
  console.warn(`[media] ${message}`);
}

function fail(message) {
  console.error(`[media] ${message}`);
  process.exit(1);
}

/* ---------------------------------------------------------------- */

let library;

try {
  library = await fetchJson(LIBRARY_URL);
} catch (reason) {
  fail(
    `the external library manifest could not be fetched (${LIBRARY_URL}): ${reason instanceof Error ? reason.message : String(reason)}`
  );
}

if (!library) {
  fail(
    `the external library manifest returned 404 (${LIBRARY_URL}) — this is the REQUIRED media source contract`
  );
}

let music = null;

try {
  music = await fetchJson(MUSIC_URL);
} catch (reason) {
  warn(
    `the optional music manifest could not be fetched (${MUSIC_URL}): ${reason instanceof Error ? reason.message : String(reason)} — continuing without music`
  );

  music = null;
}

if (music === null) {
  warn(
    "no Music source published yet (Projects/music.json absent) — Media will ship an empty Music state"
  );
}

const branchBaseUrl = "https://cdn.jsdelivr.net/gh";

const { manifest, warnings } = await buildMediaManifest({
  library,
  music,
  branchBaseUrl,
  fetchRange,
  warn
});

for (const warning of warnings) {
  warn(warning);
}

try {
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`
  );
} catch (reason) {
  fail(`could not write data/media.json: ${reason instanceof Error ? reason.message : String(reason)}`);
}

const bookCount = manifest.items.filter(
  (item) => item.type === "book"
).length;

const musicCount = manifest.items.filter(
  (item) => item.type === "music"
).length;

const directCount = manifest.items.filter(
  (item) => item.sourceType === "direct"
).length;

const embeddedCount = manifest.items.filter(
  (item) => item.type === "music" && item.metadataSource === "embedded"
).length;

console.log(
  `[media] Manifest synced: ${bookCount} book(s), ${musicCount} music track(s) (${directCount} direct source(s), ${embeddedCount} with embedded metadata), version ${manifest.version}.`
);
