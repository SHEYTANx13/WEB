/*
 * tests/media-manifest.test.ts — Media manifest schema + sync
 * normalization tests (the Library → Media data pipeline contract).
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import {
  validateMediaManifest
} from "../scripts/media/manifestSchema.mjs";

import {
  buildMediaManifest,
  normalizeRawItem
} from "../scripts/media/manifestSync.mjs";

import { buildFlac, buildMp3, buildWav } from "./fixtures/audio.mjs";

const VALID_BOOK = {
  branch: "Books",
  source: "RED MAGIC.pdf",
  title: "RED MAGIC",
  type: "book"
};

function makeFetcher(files: Record<string, Uint8Array>) {
  const map = new Map<string, Uint8Array>();

  for (const [path, data] of Object.entries(files)) {
    map.set(path, new Uint8Array(data));
  }

  return async (url: string, start: number, end: number) => {
    const path = new URL(url).pathname.replace(/^\//, "");

    const bytes: Uint8Array | undefined =
      map.get(decodeURIComponent(path));

    if (!bytes) {
      return {
        status: 404,
        arrayBuffer: new ArrayBuffer(0),
        contentRange: null,
        acceptRanges: null
      };
    }

    if (start === 0 && end === 0) {
      return {
        status: 206,
        arrayBuffer: bytes.subarray(0, 1).slice().buffer,
        contentRange: `bytes 0-0/${bytes.length}`,
        acceptRanges: "bytes"
      };
    }

    const rangeEnd = end ?? bytes.length - 1;

    return {
      status: 206,
      arrayBuffer: bytes
        .subarray(start, rangeEnd + 1)
        .slice()
        .buffer,
      contentRange: `bytes ${start}-${rangeEnd}/${bytes.length}`,
      acceptRanges: "bytes"
    };
  };
}

describe("manifest schema (data/media.json v3)", () => {
  it("accepts the shipped empty-music state", () => {
    const errors = validateMediaManifest({
      version: 4,
      updated: "2026-08-26",
      items: [VALID_BOOK]
    });

    assert.deepEqual(errors, []);
  });

  it("rejects the legacy audio type with a migration hint", () => {
    const errors = validateMediaManifest({
      version: 4,
      updated: "2026-08-26",
      items: [{ ...VALID_BOOK, type: "audio" }]
    });

    assert.ok(errors.some((error) => error.includes("audio")));
  });

  it("rejects version drift", () => {
    const errors = validateMediaManifest({
      version: 2,
      updated: "2026-08-26",
      items: []
    });

    assert.ok(errors.some((error) => error.includes("version")));
  });

  it("enforces type/extension coherence", () => {
    const errors = validateMediaManifest({
      version: 4,
      updated: "2026-08-26",
      items: [
        { ...VALID_BOOK, type: "music", source: "not-audio.pdf" }
      ]
    });

    assert.ok(
      errors.some((error) => error.includes("does not allow .pdf"))
    );
  });

  it("accepts the music extensions and rejects unknown fields", () => {
    const ok = validateMediaManifest({
      version: 4,
      updated: "2026-08-26",
      items: [
        {
          branch: "Music",
          source: "01 Song.mp3",
          title: "01 Song",
          type: "music",
          artist: "A",
          duration: 12.5,
          metadataSource: "embedded"
        }
      ]
    });

    assert.deepEqual(ok, []);

    const bad = validateMediaManifest({
      version: 4,
      updated: "2026-08-26",
      items: [
        {
          branch: "Music",
          source: "01 Song.mp3",
          title: "01 Song",
          type: "music",
          bogus: true
        }
      ]
    });

    assert.ok(bad.some((error) => error.includes("bogus")));
  });
});

describe("sync normalization (normalizeRawItem)", () => {
  it("maps the legacy audio type to music", () => {
    const result = normalizeRawItem(
      {
        branch: "Books",
        source: "X.mp3",
        title: "X",
        type: "audio"
      },
      "test"
    );

    assert.ok(result.item);
    assert.equal(result.item!.type, "music");
  });

  it("drops malformed records with a reason (no crashes, no inventions)", () => {
    const missing = normalizeRawItem(
      { branch: "Books", title: "X", type: "book" },
      "test"
    );

    assert.ok(missing.error);

    const unknown = normalizeRawItem(
      { branch: "Books", source: "x.txt", title: "X", type: "pamphlet" },
      "test"
    );

    assert.ok(unknown.error);
  });
});

describe("buildMediaManifest (the sync pipeline core)", () => {
  it("merges books + music, extracts embedded metadata, resolves covers", async () => {
    const mp3 = buildMp3({ seconds: 9 });

    const { manifest, warnings } = await buildMediaManifest({
      library: {
        version: 2,
        updated: "2026-08-26",
        items: [VALID_BOOK]
      },
      music: {
        version: 1,
        updated: "2026-09-19",
        items: [
          {
            branch: "Music",
            source: "Album/01 First.mp3",
            title: "01 First"
          }
        ]
      },
      branchBaseUrl: "https://cdn.test",
      fetchRange: makeFetcher({
        "Music/Album/01 First.mp3": mp3,
        "Music/Album/01 First.jpeg": Uint8Array.of(0x00)
      })
    });

    assert.equal(manifest.version, 4);
    assert.equal(manifest.updated, "2026-09-19");
    assert.equal(manifest.items.length, 2);

    const [book, track] = manifest.items;

    assert.equal(book.type, "book");

    assert.equal(track.type, "music");
    assert.equal(track.artist, "Test Artist");
    assert.equal(track.album, "Test Album");
    assert.equal(track.metadataSource, "embedded");
    assert.ok(Math.abs(track.duration! - 9) < 0.5);
    assert.equal(track.cover, "Album/01 First.jpeg");
  });

  it("keeps manifest metadata when extraction finds nothing", async () => {
    const { manifest, warnings } = await buildMediaManifest({
      library: { version: 2, updated: "2026-08-26", items: [] },
      music: {
        version: 1,
        updated: "2026-09-19",
        items: [
          {
            branch: "Music",
            source: "silent.flac",
            title: "silent",
            artist: "Manifest Artist"
          }
        ]
      },
      branchBaseUrl: "https://cdn.test",
      fetchRange: makeFetcher({})
    });

    const track = manifest.items[0];

    assert.equal(track.artist, "Manifest Artist");
    assert.equal(track.metadataSource, "manifest");
    assert.ok(
      warnings.some((warning) => warning.includes("no embedded metadata")),
      "extraction gap is reported in the returned warnings"
    );
  });

  it("produces the documented empty state when no music source exists", async () => {
    const { manifest } = await buildMediaManifest({
      library: {
        version: 2,
        updated: "2026-08-26",
        items: [VALID_BOOK]
      },
      music: null,
      branchBaseUrl: "https://cdn.test",
      fetchRange: makeFetcher({})
    });

    assert.equal(manifest.items.length, 1);
    assert.equal(
      manifest.items.filter((item) => item.type === "music").length,
      0,
      "zero fabricated tracks"
    );
    assert.equal(manifest.updated, "2026-08-26");
  });

  it("never fabricates metadata for fabricated-looking inputs", async () => {
    const { manifest } = await buildMediaManifest({
      library: { version: 2, updated: "2026-08-26", items: [] },
      music: {
        version: 1,
        updated: "2026-09-19",
        items: [
          { branch: "Music", source: "gone.mp3", title: "gone" }
        ]
      },
      branchBaseUrl: "https://cdn.test",
      fetchRange: makeFetcher({})
    });

    const track = manifest.items[0];

    /* The item survives (the publisher listed it) but carries NO
     * invented fields — only its manifest truth. */
    assert.equal(track.title, "gone");
    assert.equal(track.artist, undefined);
    assert.equal(track.duration, undefined);
    assert.equal(track.metadataSource, undefined);
    assert.equal(track.cover, undefined);
  });
});

/* ---------------------------------------------------------------- */
/* v4.0.2 — direct URL media sources                                */
/* ---------------------------------------------------------------- */

describe("manifest schema — direct sources (v4.0.2)", () => {
  const BASE = { updated: "2026-09-20" };

  it("accepts a valid HTTPS direct music item", () => {
    const errors = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "https://media.example.com/albums/01 Track.wav",
          title: "01 Track",
          type: "music"
        }
      ]
    });

    assert.deepEqual(errors, []);
  });

  it("accepts a valid HTTP direct music item", () => {
    const errors = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "http://192.168.1.10:8080/library/loop.mp3",
          title: "LAN loop",
          type: "music"
        }
      ]
    });

    assert.deepEqual(errors, []);
  });

  it("accepts an extensionless direct URL with a mapping mimeType", () => {
    const errors = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "https://cdn.example.org/stream?id=42",
          mimeType: "audio/flac",
          title: "Stream",
          type: "music"
        }
      ]
    });

    assert.deepEqual(errors, []);
  });

  it("rejects malformed URLs at validation time", () => {
    for (const url of [
      "not-a-url",
      "ftp://media.example.com/a.wav",
      "file:///etc/passwd.wav",
      "/relative/path/track.mp3",
      "media.example.com/track.mp3",
      ""
    ]) {
      const errors = validateMediaManifest({
        version: 4,
        ...BASE,
        items: [
          {
            sourceType: "direct",
            url,
            title: "Broken",
            type: "music"
          }
        ]
      });

      assert.ok(
        errors.some(
          (error) =>
            error.includes("malformed `url`") ||
            error.includes("missing a valid `url`")
        ),
        `URL ${JSON.stringify(url)} must be rejected`
      );
    }
  });

  it("rejects a direct item whose audio kind cannot resolve", () => {
    const errors = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "https://cdn.example.org/stream?id=42",
          title: "Opaque",
          type: "music"
        }
      ]
    });

    assert.ok(
      errors.some((error) => error.includes("cannot be resolved"))
    );
  });

  it("rejects non-music direct items (audio-only release)", () => {
    const errors = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "https://cdn.example.org/book.pdf",
          title: "Remote book",
          type: "book"
        }
      ]
    });

    assert.ok(
      errors.some((error) => error.includes("must be type `music`"))
    );
  });

  it("rejects direct items carrying contents-only fields or fake embedded provenance", () => {
    const withBranch = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "https://cdn.example.org/a.wav",
          branch: "Music",
          source: "a.wav",
          title: "Mixed",
          type: "music"
        }
      ]
    });

    assert.ok(
      withBranch.some((error) =>
        error.includes("contents-only field `branch`")
      )
    );

    const fakeEmbedded = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "https://cdn.example.org/a.wav",
          title: "Fake",
          type: "music",
          metadataSource: "embedded"
        }
      ]
    });

    assert.ok(
      fakeEmbedded.some((error) =>
        error.includes("must not claim `metadataSource: \"embedded\"`")
      )
    );
  });

  it("rejects a relative cover path on a direct item", () => {
    const errors = validateMediaManifest({
      version: 4,
      ...BASE,
      items: [
        {
          sourceType: "direct",
          url: "https://cdn.example.org/a.wav",
          cover: "covers/a.jpeg",
          title: "Covered",
          type: "music"
        }
      ]
    });

    assert.ok(
      errors.some((error) => error.includes("`cover` must be an absolute"))
    );
  });
});

describe("sync normalization — direct records (v4.0.2)", () => {
  /* The pipeline injects the music.json type default the same way. */
  const direct = (raw: Record<string, unknown>) =>
    normalizeRawItem({ type: "music", ...raw }, "test");

  it("builds a direct item from a url (explicit sourceType)", () => {
    const result = direct({
      sourceType: "direct",
      url: "https://media.example.com/t.wav",
      title: "T",
      artist: "A"
    });

    assert.ok(result.item);

    assert.equal(result.item!.sourceType, "direct");

    assert.equal(result.item!.url, "https://media.example.com/t.wav");

    assert.equal(result.item!.type, "music");

    assert.equal(result.item!.branch, undefined);

    assert.equal(result.item!.source, undefined);

    assert.equal(result.item!.artist, "A");
  });

  it("infers the direct shape only from FIELD PRESENCE (url, no branch/source)", () => {
    const result = direct({
      url: "http://localhost:4173/e2e.wav",
      title: "E2E"
    });

    assert.ok(result.item);

    assert.equal(result.item!.sourceType, "direct");
  });

  it("rejects malformed direct urls and non-music direct types", () => {
    const malformed = direct({ url: "not-a-url", title: "X" });

    assert.ok(malformed.error?.includes("absolute http/https"));

    const wrongType = normalizeRawItem(
      {
        sourceType: "direct",
        url: "https://media.example.com/x.wav",
        title: "X",
        type: "book"
      },
      "test"
    );

    assert.ok(wrongType.error?.includes("audio-only"));
  });

  it("writes the explicit contents sourceType on every contents item", () => {
    const result = normalizeRawItem(
      { branch: "Books", source: "X.pdf", title: "X", type: "book" },
      "test"
    );

    assert.ok(result.item);

    assert.equal(result.item!.sourceType, "contents");
  });
});

describe("sync pipeline — direct sources never get fetched (v4.0.2)", () => {
  it("passes a direct item through VERBATIM with zero network probes", async () => {
    let rangeCalls = 0;

    const fetchRange = async () => {
      rangeCalls += 1;

      return {
        status: 404,
        arrayBuffer: new ArrayBuffer(0),
        contentRange: null,
        acceptRanges: null
      };
    };

    const { manifest, warnings } = await buildMediaManifest({
      library: { version: 2, updated: "2026-08-26", items: [VALID_BOOK] },
      music: {
        version: 1,
        updated: "2026-09-20",
        items: [
          {
            url: "https://media.example.com/external/01 Direct.wav",
            title: "01 Direct",
            artist: "Direct Artist",
            album: "Direct Album",
            duration: 133.7
          }
        ]
      },
      branchBaseUrl: "https://cdn.test",
      fetchRange
    });

    assert.equal(rangeCalls, 0, "no build-time download of direct media");

    assert.deepEqual(warnings, []);

    const direct = manifest.items.find(
      (item) => item.sourceType === "direct"
    );

    assert.ok(direct);

    assert.equal(direct.url, "https://media.example.com/external/01 Direct.wav");

    assert.equal(direct.title, "01 Direct");

    assert.equal(direct.artist, "Direct Artist");

    assert.equal(direct.duration, 133.7);

    assert.equal(
      direct.metadataSource,
      "manifest",
      "publisher manifest metadata, honestly labeled"
    );

    /* The synced manifest validates against the v4 schema. */
    assert.deepEqual(validateMediaManifest(manifest), []);
  });
});

/* ---------------------------------------------------------------- */
/* v4.0.2 — WAV support                                              */
/* ---------------------------------------------------------------- */

describe("manifest schema — WAV (v4.0.2)", () => {
  it("accepts .wav as a music extension (contents item)", () => {
    const errors = validateMediaManifest({
      version: 4,
      updated: "2026-09-20",
      items: [
        {
          branch: "Music",
          source: "Album/01 Lossless.wav",
          title: "01 Lossless",
          type: "music"
        }
      ]
    });

    assert.deepEqual(errors, []);
  });

  it("still accepts mp3, m4a and flac (nothing removed)", () => {
    for (const source of [
      "a.mp3",
      "a.m4a",
      "a.flac"
    ]) {
      const errors = validateMediaManifest({
        version: 4,
        updated: "2026-09-20",
        items: [
          {
            branch: "Music",
            source,
            title: "A",
            type: "music"
          }
        ]
      });

      assert.deepEqual(errors, [], `${source} stays valid`);
    }
  });

  it("rejects .wav outside the music category", () => {
    const errors = validateMediaManifest({
      version: 4,
      updated: "2026-09-20",
      items: [
        {
          branch: "Books",
          source: "soundtrack.wav",
          title: "Soundtrack",
          type: "book"
        }
      ]
    });

    assert.ok(
      errors.some((error) => error.includes("does not allow .wav"))
    );
  });
});

describe("sync pipeline — WAV metadata extraction (v4.0.2)", () => {
  it("extracts LIST/INFO tags and exact duration from a contents .wav", async () => {
    const wav = buildWav({
      title: "Riff Title",
      artist: "Riff Artist",
      album: "Riff Album",
      composer: "Riff Composer",
      year: "2025",
      genre: "Ambient",
      track: "2/8",
      seconds: 12
    });

    const { manifest, warnings } = await buildMediaManifest({
      library: { version: 2, updated: "2026-08-26", items: [] },
      music: {
        version: 1,
        updated: "2026-09-20",
        items: [
          {
            branch: "Music",
            source: "Album/01 Riff.wav",
            title: "01 Riff"
          }
        ]
      },
      branchBaseUrl: "https://cdn.test",
      fetchRange: makeFetcher({
        "Music/Album/01 Riff.wav": wav
      })
    });

    assert.equal(warnings.length, 0, `no warnings: ${warnings.join("; ")}`);

    const track = manifest.items[0];

    assert.equal(track.type, "music");

    assert.equal(track.metadataSource, "embedded");

    assert.equal(track.title, "Riff Title");

    assert.equal(track.artist, "Riff Artist");

    assert.equal(track.album, "Riff Album");

    assert.equal(track.composer, "Riff Composer");

    assert.equal(track.year, "2025");

    assert.equal(track.trackNumber, 2);

    assert.equal(track.trackTotal, 8);

    assert.ok(Math.abs(track.duration! - 12) < 0.01);

    /* The synced manifest validates against the v4 schema. */
    assert.deepEqual(validateMediaManifest(manifest), []);
  });
});
