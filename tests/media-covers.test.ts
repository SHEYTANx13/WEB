/*
 * tests/media-covers.test.ts — deterministic cover resolution.
 *
 * Contract: explicit cover → matching audio basename → folder cover
 * → fallback. Supported extensions .jpeg/.png only; no fuzzy matching.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import {
  resolveCoverPath
} from "../scripts/media/covers.mjs";

function setOf(...paths: string[]) {
  return new Set(paths);
}

describe("cover resolution", () => {
  it("prefers the explicit cover path", async () => {
    const cover = await resolveCoverPath(
      {
        source: "Album/Track 01.mp3",
        cover: "Album/custom-cover.png"
      },
      async (path) => setOf("Album/cover.jpeg").has(path)
    );

    assert.equal(cover, "Album/custom-cover.png");
  });

  it("resolves the matching basename before folder covers", async () => {
    const cover = await resolveCoverPath(
      { source: "Album/Track 01.mp3" },
      async (path) =>
        setOf("Album/Track 01.jpeg", "Album/cover.png").has(path)
    );

    assert.equal(cover, "Album/Track 01.jpeg");
  });

  it("matches the .png basename before .jpeg folder candidates", async () => {
    const cover = await resolveCoverPath(
      { source: "Album/Track 01.mp3" },
      async (path) => setOf("Album/Track 01.png", "Album/cover.jpeg").has(path)
    );

    assert.equal(cover, "Album/Track 01.png");
  });

  it("falls back to the folder cover in the documented candidate order", async () => {
    const onlyFolderPng = await resolveCoverPath(
      { source: "Deep/Album/track.mp3" },
      async (path) => setOf("Deep/Album/cover.png").has(path)
    );

    assert.equal(onlyFolderPng, "Deep/Album/cover.png");

    const folderBeforeFront = await resolveCoverPath(
      { source: "track.flac" },
      async (path) => setOf("folder.jpeg", "front.png").has(path)
    );

    assert.equal(folderBeforeFront, "folder.jpeg");
  });

  it("honours the root-level audio folder boundary", async () => {
    const cover = await resolveCoverPath(
      { source: "Track 09.m4a" },
      async (path) => setOf("Track 09.png", "cover.jpeg").has(path)
    );

    assert.equal(cover, "Track 09.png");
  });

  it("returns null when nothing matches (UI fallback owns the gap)", async () => {
    const cover = await resolveCoverPath(
      { source: "Album/track.mp3" },
      async (path) =>
        setOf("Album/track.jpg", "Album/cover.gif", "Album/cover.webp").has(
          path
        )
    );

    assert.equal(cover, null);
  });

  it("rejects unsupported explicit cover extensions (no fuzzy matching)", async () => {
    const cover = await resolveCoverPath(
      {
        source: "Album/track.mp3",
        cover: "Album/cover.gif"
      },
      async () => true
    );

    /* The unsupported explicit value is ignored; the deterministic
     * chain continues and the matching basename resolves. */
    assert.equal(cover, "Album/track.jpeg");
  });
});
