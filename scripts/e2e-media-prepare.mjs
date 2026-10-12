#!/usr/bin/env node
/*
 * scripts/e2e-media-prepare.mjs — LOCAL verification helper.
 *
 * Builds the synthetic verification tracks (tests/fixtures bytes):
 * an MP3, a WAV (both with embedded metadata extracted through the
 * SAME production extractor the CI sync uses), and a DIRECT-source
 * item pointing at a locally served copy of the WAV. It writes a
 * TEMPORARY data/media.json (schema v4) containing the three E2E
 * music items and a temporary public/e2e-direct-source.wav for the
 * direct URL. Both are reverted by git after verification — the
 * shipped repository never carries fabricated content.
 */

import { mkdir, writeFile, copyFile } from "node:fs/promises";

import path from "node:path";

import { buildMp3, buildWav, buildCoverPng } from "../tests/fixtures/audio.mjs";

import { extractAudioMetadata } from "../scripts/media/audioMetadata.mjs";

import { validateMediaManifest } from "../scripts/media/manifestSchema.mjs";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);

const E2E_DIR = path.join(ROOT, ".e2e-track");

const TRACK_FILE = path.join(E2E_DIR, "01 Verification Track.mp3");

const WAV_FILE = path.join(E2E_DIR, "02 Lossless Verification.wav");

const bytes = buildMp3({ seconds: 45 });

const wavBytes = buildWav({
  title: "02 Lossless Verification",
  artist: "WAV Artist",
  album: "E2E Album",
  composer: "WAV Composer",
  year: "2026",
  genre: "Ambient",
  track: "2/3",
  seconds: 45
});

await mkdir(E2E_DIR, { recursive: true });

await writeFile(TRACK_FILE, bytes);

await writeFile(WAV_FILE, wavBytes);

await writeFile(path.join(E2E_DIR, "cover.png"), buildCoverPng());

/* The direct-source targets: shipped by the static export (reverted
 * with the rest of the E2E state after verification). */
await writeFile(
  path.join(ROOT, "public", "e2e-mp3-track.mp3"),
  bytes
);

await writeFile(
  path.join(ROOT, "public", "e2e-wav-track.wav"),
  buildWav({ seconds: 45 })
);

await writeFile(
  path.join(ROOT, "public", "e2e-cover.png"),
  buildCoverPng()
);

/* File-backed range fetch shared by both extractions. */
function fileRangeFetch(source) {
  return async (url, start, end) => {
    if (start === 0 && end === 0) {
      return {
        status: 206,
        arrayBuffer: source.subarray(0, 1).slice().buffer,
        contentRange: `bytes 0-0/${source.length}`,
        acceptRanges: "bytes"
      };
    }

    return {
      status: 206,
      arrayBuffer: source.subarray(start, end + 1).slice().buffer,
      contentRange: `bytes ${start}-${end}/${source.length}`,
      acceptRanges: "bytes"
    };
  };
}

/* Extract metadata through the production extractor (file-backed range fetch). */
const extracted = await extractAudioMetadata({
  url: "file://fixture/01 Verification Track.mp3",
  kind: "mp3",
  fetchRange: fileRangeFetch(bytes)
});

if (extracted.source !== "embedded") {
  console.error("[e2e] extraction failed — aborting before any manifest change");

  process.exit(1);
}

const wavExtracted = await extractAudioMetadata({
  url: "file://fixture/02 Lossless Verification.wav",
  kind: "wav",
  fetchRange: fileRangeFetch(wavBytes)
});

if (wavExtracted.source !== "embedded") {
  console.error("[e2e] WAV extraction failed — aborting before any manifest change");

  process.exit(1);
}

const manifest = {
  version: 4,
  updated: "2026-08-26",
  items: [
    {
      sourceType: "contents",
      branch: "Books",
      source: "RED MAGIC.pdf",
      title: "RED MAGIC",
      subtitle: "A living system of intelligence, adaptation, and synthetic life.",
      type: "book",
      description:
        "RED MAGIC begins as a question: what happens when software becomes responsive, adaptive, and capable of exhibiting its own evolving behaviour?",
      year: "2026",
      language: "English",
      author: "Parsa Tak",
      series: "RED MAGIC",
      volume: 1,
      featured: true,
      status: "published",
      readingTime: "Long read",
      tags: [
        "RED MAGIC",
        "AI",
        "intelligence",
        "systems",
        "consciousness",
        "simulation",
        "adaptation",
        "synthetic life"
      ]
    },
    {
      sourceType: "contents",
      branch: "Books",
      source: "RED MAGIC 0_ MAGIC FOR KIDS.pdf",
      title: "RED MAGIC 0: MAGIC FOR KIDS",
      subtitle: "An accessible introduction to the ideas behind RED MAGIC.",
      type: "book",
      description:
        "An introduction to RED MAGIC for younger readers, using simple language to explore intelligence, systems, change, and the strange idea of software behaving like something alive.",
      year: "2026",
      language: "English",
      author: "Parsa Tak",
      series: "RED MAGIC",
      volume: 0,
      featured: false,
      status: "published",
      readingTime: "Short read",
      tags: ["RED MAGIC", "intelligence", "systems", "introduction", "education"]
    },
    {
      sourceType: "contents",
      branch: "Books",
      source: "RED MAGIC II_ THE BOOK OF THE DEMIURGE.pdf",
      title: "RED MAGIC II: THE BOOK OF THE DEMIURGE",
      subtitle:
        "Creation, intelligence, systems, and the forces that shape artificial worlds.",
      type: "book",
      description:
        "The second RED MAGIC volume goes deeper into creation, intelligence, systems, and the forces that shape what an artificial world can become.",
      year: "2026",
      language: "English",
      author: "Parsa Tak",
      series: "RED MAGIC",
      volume: 2,
      featured: false,
      status: "published",
      readingTime: "Long read",
      tags: [
        "RED MAGIC",
        "systems",
        "creation",
        "intelligence",
        "synthetic life",
        "demiurge",
        "philosophy"
      ]
    },
    /*
     * MP3 (v4.0.2) — a real silent MPEG bitstream served by the local
     * static server through a DIRECT URL: full end-to-end playback
     * verification without any external network dependency.
     */
    {
      sourceType: "direct",
      url: "http://127.0.0.1:4173/e2e-mp3-track.mp3",
      mimeType: "audio/mpeg",
      title: "01 Verification Track",
      type: "music",
      cover: "http://127.0.0.1:4173/e2e-cover.png",
      year: extracted.fields.year ?? "2026",
      trackNumber: 1,
      trackTotal: 3,
      artist: extracted.fields.artist,
      album: extracted.fields.album,
      albumArtist: extracted.fields.albumArtist,
      genre: extracted.fields.genre,
      composer: extracted.fields.composer,
      comment: extracted.fields.comment,
      duration: extracted.duration,
      /* Direct sources never claim embedded provenance — the fields
       * above are what a publisher's manifest carries (this script
       * plays that publisher; the extraction proves the fixture). */
      metadataSource: "manifest"
    },
    /*
     * WAV (v4.0.2) — a real silent PCM RIFF/WAVE file with LIST/INFO
     * tags, extracted through the SAME production extractor and
     * served locally through a direct URL: the browser verification
     * covers the new kind end to end.
     */
    {
      sourceType: "direct",
      url: "http://127.0.0.1:4173/e2e-wav-track.wav",
      mimeType: "audio/wav",
      title: "02 Lossless Verification",
      type: "music",
      cover: "http://127.0.0.1:4173/e2e-cover.png",
      year: "2026",
      trackNumber: 2,
      trackTotal: 3,
      artist: "WAV Artist",
      album: "E2E Album",
      genre: "Ambient",
      composer: "WAV Composer",
      comment: "Synthetic wav",
      duration: wavExtracted.duration,
      metadataSource: "manifest"
    },
    /*
     * CONTENTS SOURCE (v4.0.2) — a repository-backed track whose CDN
     * URL does not exist (no E2E branch on the Contents repository).
     * This verifies the contents catalog shape end to end AND the
     * honest error path in a real browser: the failed load surfaces
     * the error state with a RETRY affordance, and next() advances.
     * The URL is the real production CDN — nothing is faked.
     */
    {
      sourceType: "contents",
      branch: "E2E",
      source: "03 Contents Source Verification.mp3",
      title: "03 Contents Source Verification",
      type: "music",
      year: "2026",
      trackNumber: 3,
      trackTotal: 3,
      artist: "Contents Artist",
      album: "Repository Album",
      duration: 45
    }
  ]
};

const errors = validateMediaManifest(manifest);

if (errors.length > 0) {
  console.error("[e2e] temp manifest invalid:", errors);

  process.exit(1);
}

await writeFile(
  path.join(ROOT, "data", "media.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(
  `[e2e] temp manifest written (2 playable direct-source tracks [MP3 + WAV] + 1 contents track for the honest error path, schema v4)`
);
