#!/usr/bin/env node
/*
 * validate-media-manifest.mjs — Media manifest gate.
 *
 * The Media scene renders from data/media.json, synced in CI
 * (scripts/sync-media-manifest.mjs) from the Contents repository.
 * Before the site builds, the manifest must be structurally sound:
 *
 *   - top level: `version` 4, string `updated`, array `items`
 *   - every item: explicit `sourceType` (contents | direct), string
 *     `title`, canonical `type` (book | music | video | art — legacy
 *     "audio" rejected)
 *   - contents items: string `branch` + `source`, source extension
 *     matches the declared type
 *   - direct items: absolute http(s) `url`, type "music", audio kind
 *     resolvable from the URL extension or declared mimeType, no
 *     repository-only fields
 *   - music-only fields (duration, metadataSource, …) type-checked
 *
 * A malformed manifest fails the build BEFORE any expensive work,
 * with a message naming the first offending field. Zero runtime
 * dependencies, checked in so the same gate runs locally and in CI.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateMediaManifest } from "./media/manifestSchema.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const MANIFEST_PATH = path.join(ROOT, "data", "media.json");

function fail(message) {
  console.error(`[media] ${message}`);
  process.exit(1);
}

let manifest;

try {
  manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
} catch (error) {
  fail(`data/media.json is not parseable JSON: ${error.message}`);
}

const errors = validateMediaManifest(manifest);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[media] ${error}`);
  }

  fail(
    `Media manifest invalid: ${errors.length} problem(s) — check the manifest in the Contents repository`
  );
}

const counts = manifest.items.reduce((acc, item) => {
  acc[item.type] = (acc[item.type] ?? 0) + 1;

  if (item.sourceType === "direct") {
    acc.direct = (acc.direct ?? 0) + 1;
  }

  return acc;
}, {});

const summary = Object.entries(counts)
  .map(([type, count]) => `${type}: ${count}`)
  .join(", ");

console.log(
  `[media] Manifest valid: ${manifest.items.length} item(s)${summary ? ` (${summary})` : ""}.`
);
