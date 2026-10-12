/*
 * tests/media-repository.test.ts — the app-side Media model
 * (lib/media/normalize.ts): discriminated MediaItem derivation,
 * category mapping, filter grouping, and the Library → Media labels.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import {
  createGitHubUrl,
  createMediaUrl,
  encodePath,
  getActionLabel,
  getCatalogLabel,
  getCategoryForKind,
  getDirectAudioKind,
  getDownloadLabel,
  getMediaFilterForItem,
  getMediaKind,
  getPreviewGlyph,
  isValidDirectMediaUrl,
  MEDIA_FILTERS,
  MIME_BY_AUDIO_KIND,
  normalizeCategory,
  normalizeManifestItems,
  normalizeMediaItem,
  type MediaManifest
} from "../lib/media/normalize";

const BOOK = {
  branch: "Books",
  source: "RED MAGIC.pdf",
  title: "RED MAGIC",
  type: "book",
  featured: true,
  tags: ["RED MAGIC"]
};

const TRACK = {
  branch: "Music",
  source: "Album/01 Song.mp3",
  title: "01 Song",
  type: "music",
  artist: "Parsa Tak",
  album: "Laboratory",
  duration: 12.5,
  metadataSource: "embedded" as const
};

describe("manifest → MediaItem normalization", () => {
  it("derives the discriminated categories", () => {
    const items = normalizeManifestItems({
      version: 3,
      updated: "2026-08-26",
      items: [
        BOOK,
        TRACK,
        { branch: "Video", source: "clip.mp4", title: "clip", type: "video" },
        { branch: "Art", source: "piece.png", title: "piece", type: "art" }
      ]
    });

    assert.deepEqual(
      items.map((item) => item.category),
      ["book", "music", "video", "art"]
    );

    assert.equal(items[0]!.kind, "pdf");
    assert.equal(items[1]!.kind, "mp3");
    assert.equal(items[2]!.kind, "mp4");
    assert.equal(items[3]!.kind, "png");
  });

  it("accepts the legacy audio type as music (compatibility alias)", () => {
    const item = normalizeMediaItem({
      branch: "Books",
      source: "x.mp3",
      title: "x",
      type: "audio"
    });

    assert.ok(item);
    assert.equal(item!.category, "music");
  });

  it("rejects type/extension contradictions (validator guarantees this upstream)", () => {
    assert.equal(
      normalizeMediaItem({
        branch: "Books",
        source: "book.pdf",
        title: "book",
        type: "music"
      }),
      null
    );

    assert.equal(
      normalizeMediaItem({
        branch: "Music",
        source: "song.txt",
        title: "song",
        type: "music"
      }),
      null
    );
  });

  it("accepts .wav as a music kind (v4.0.2)", () => {
    const item = normalizeMediaItem({
      branch: "Music",
      source: "Album/01 Lossless.wav",
      title: "01 Lossless",
      type: "music"
    });

    assert.ok(item);

    assert.equal(item!.kind, "wav");

    assert.equal(item!.category, "music");

    assert.equal(
      item!.rawUrl,
      "https://cdn.jsdelivr.net/gh/Parsaetak/Contents@Music/Album/01%20Lossless.wav"
    );
  });

  it("builds CDN + provenance URLs and cover URLs", () => {
    const item = normalizeMediaItem(TRACK) ;

    assert.ok(item);

    assert.equal(item.id, "Music:Album/01 Song.mp3");
    assert.equal(
      item.rawUrl,
      "https://cdn.jsdelivr.net/gh/Parsaetak/Contents@Music/Album/01%20Song.mp3"
    );
    assert.equal(
      item.githubUrl,
      "https://github.com/Parsaetak/Contents/blob/Music/Album/01%20Song.mp3"
    );

    const withCover = normalizeMediaItem({
      ...TRACK,
      cover: "Album/01 Song.jpeg"
    });

    assert.equal(
      withCover!.coverUrl,
      "https://cdn.jsdelivr.net/gh/Parsaetak/Contents@Music/Album/01%20Song.jpeg"
    );
  });

  it("carries the Music track contract (embedded metadata only)", () => {
    const item = normalizeMediaItem(TRACK);

    assert.ok(item);
    assert.equal(item!.category, "music");

    if (item!.category !== "music") {
      return;
    }

    const track = item!.track;

    assert.equal(track.title, "01 Song");
    assert.equal(track.artist, "Parsa Tak");
    assert.equal(track.album, "Laboratory");
    assert.equal(track.duration, 12.5);
    assert.equal(track.source, "embedded");

    /* No invented fields: */
    assert.equal(track.genre, undefined);
    assert.equal(track.composer, undefined);
  });

  it("filters the whole manifest without crashing on partial corruption", () => {
    const items = normalizeManifestItems({
      version: 3,
      updated: "2026-08-26",
      items: [
        BOOK,
        { branch: "", source: "x.pdf", title: "broken", type: "book" },
        { branch: "Music", source: "y.txt", title: "broken", type: "music" }
      ] as never[]
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]!.title, "RED MAGIC");
  });
});

describe("filters and labels (Media vocabulary)", () => {
  it("orders the MEDIA filter group exactly as specified", () => {
    assert.deepEqual(
      MEDIA_FILTERS.map((filter) => filter.label),
      ["ALL", "MUSIC", "BOOKS", "VIDEO", "ART"]
    );
  });

  it("groups items deterministically", () => {
    const items = normalizeManifestItems({
      version: 3,
      updated: "2026-08-26",
      items: [BOOK, TRACK]
    });

    assert.equal(getMediaFilterForItem(items[0]!), "book");
    assert.equal(getMediaFilterForItem(items[1]!), "music");
  });

  it("labels categories and actions without Library-era vocabulary", () => {
    const items = normalizeManifestItems({
      version: 3,
      updated: "2026-08-26",
      items: [
        BOOK,
        TRACK,
        { branch: "Video", source: "clip.mp4", title: "clip", type: "video" },
        { branch: "Art", source: "piece.png", title: "piece", type: "art" }
      ]
    });

    const labels = items.map((item) => getCatalogLabel(item));

    assert.deepEqual(labels, ["BOOK", "MUSIC", "VIDEO", "IMAGE"]);

    const actions = items.map((item) => getActionLabel(item));

    assert.deepEqual(actions, ["READ", "LISTEN", "WATCH", "VIEW"]);

    const glyphs = items.map((item) => getPreviewGlyph(item));

    assert.deepEqual(glyphs, ["BOOK", "MUSIC", "VIDEO", "IMAGE"]);

    const downloads = items.map((item) => getDownloadLabel(item));

    assert.deepEqual(downloads, [
      "DOWNLOAD PDF",
      "DOWNLOAD MP3",
      "DOWNLOAD VIDEO",
      "DOWNLOAD IMAGE"
    ]);
  });
});

describe("category/kind primitives", () => {
  it("maps kinds to categories", () => {
    assert.equal(getCategoryForKind("m4a"), "music");
    assert.equal(getCategoryForKind("flac"), "music");
    assert.equal(getCategoryForKind("jpeg"), "art");
  });

  it("resolves kinds case-insensitively", () => {
    assert.equal(getMediaKind("Song.FLAC"), "flac");
    assert.equal(getMediaKind("book.PDF"), "pdf");
    assert.equal(getMediaKind("nope.exe"), null);
  });

  it("normalizes category types strictly", () => {
    assert.equal(normalizeCategory("music"), "music");
    assert.equal(normalizeCategory("audio"), "music");
    assert.equal(normalizeCategory("pamphlet"), null);
  });

  it("encodes every path segment", () => {
    assert.equal(encodePath("a b/c d.png"), "a%20b/c%20d.png");
  });

  it("builds URLs for covers and tracks from branch + path", () => {
    assert.equal(
      createMediaUrl("Music", "A B/Song.mp3"),
      "https://cdn.jsdelivr.net/gh/Parsaetak/Contents@Music/A%20B/Song.mp3"
    );

    assert.equal(
      createGitHubUrl("Books", "RED MAGIC.pdf"),
      "https://github.com/Parsaetak/Contents/blob/Books/RED%20MAGIC.pdf"
    );
  });
});

describe("manifest typing sanity", () => {
  it("treats the shipped manifest shape as a MediaManifest", () => {
    const manifest: MediaManifest = {
      version: 3,
      updated: "2026-08-26",
      items: [BOOK]
    };

    assert.equal(manifest.items.length, 1);
  });
});

/* ---------------------------------------------------------------- */
/* v4.0.2 — direct sources in the app-side model                    */
/* ---------------------------------------------------------------- */

const DIRECT = {
  sourceType: "direct" as const,
  url: "https://media.example.com/albums/02 Direct.wav",
  title: "02 Direct",
  type: "music",
  artist: "Direct Artist",
  mimeType: "audio/wav"
};

describe("manifest → MediaItem normalization — direct sources (v4.0.2)", () => {
  it("derives a DirectSource item with the URL as the playback source", () => {
    const item = normalizeMediaItem(DIRECT);

    assert.ok(item);

    assert.equal(
      item!.id,
      "direct:https://media.example.com/albums/02 Direct.wav"
    );

    assert.equal(item!.kind, "wav");

    assert.equal(item!.category, "music");

    assert.equal(item!.rawUrl, DIRECT.url);

    assert.equal(
      item!.githubUrl,
      undefined,
      "no GitHub provenance is fabricated for a direct source"
    );

    assert.deepEqual(item!.source, {
      kind: "direct",
      url: DIRECT.url,
      mimeType: "audio/wav"
    });

    if (item!.category !== "music") {
      return;
    }

    assert.equal(item!.track.artist, "Direct Artist");

    assert.equal(item!.track.source, "manifest");
  });

  it("derives contents items with the explicit contents discriminator", () => {
    const item = normalizeMediaItem(TRACK);

    assert.ok(item);

    assert.deepEqual(item!.source, {
      kind: "contents",
      branch: "Music",
      path: "Album/01 Song.mp3"
    });
  });

  it("rejects malformed direct URLs and unresolvable kinds (defense in depth)", () => {
    assert.equal(
      normalizeMediaItem({ ...DIRECT, url: "not-a-url" }),
      null
    );

    assert.equal(
      normalizeMediaItem({
        ...DIRECT,
        url: "ftp://media.example.com/a.wav"
      }),
      null
    );

    /* Extensionless with no mapping MIME — kind unresolvable. */
    assert.equal(
      normalizeMediaItem({
        ...DIRECT,
        url: "https://cdn.example.org/stream?id=1",
        mimeType: undefined
      }),
      null
    );

    /* Direct sources are audio-only. */
    assert.equal(
      normalizeMediaItem({
        ...DIRECT,
        type: "book"
      } as never),
      null
    );
  });

  it("resolves the direct kind from the MIME when the URL has no extension", () => {
    const item = normalizeMediaItem({
      ...DIRECT,
      url: "https://cdn.example.org/stream?id=42",
      mimeType: "audio/mpeg"
    });

    assert.ok(item);

    assert.equal(item!.kind, "mp3");
  });

  it("carries an absolute direct cover URL without rewriting it", () => {
    const item = normalizeMediaItem({
      ...DIRECT,
      cover: "https://media.example.com/art/cover.jpg"
    });

    assert.ok(item);

    assert.equal(item!.coverUrl, "https://media.example.com/art/cover.jpg");
  });

  it("direct tracks flow into the manifest-level queue registry (player compatibility)", () => {
    const items = normalizeManifestItems({
      version: 4,
      updated: "2026-09-20",
      items: [DIRECT, TRACK]
    });

    const music = items.filter((item) => item.category === "music");

    assert.equal(music.length, 2);

    /* Both source shapes produce registry-shaped tracks: id + url. */
    for (const track of music) {
      assert.ok(track.id.length > 0);
      assert.ok(track.rawUrl.startsWith("https://"));
    }
  });
});

describe("direct URL + MIME primitives (v4.0.2)", () => {
  it("validates absolute http/https URLs only", () => {
    assert.equal(
      isValidDirectMediaUrl("https://media.example.com/a.wav"),
      true
    );

    assert.equal(
      isValidDirectMediaUrl("http://localhost:4173/e2e.wav"),
      true
    );

    assert.equal(
      isValidDirectMediaUrl("HTTP://EXAMPLE.COM/a.wav"),
      true,
      "URL parsing is case-insensitive on the scheme"
    );

    for (const bad of [
      "",
      "media.example.com/a.wav",
      "/relative/a.wav",
      "ftp://media.example.com/a.wav",
      "file:///a.wav",
      "javascript:alert(1)"
    ]) {
      assert.equal(isValidDirectMediaUrl(bad), false);
    }
  });

  it("resolves direct kinds from URL extensions (query strings ignored)", () => {
    assert.equal(
      getDirectAudioKind("https://x.test/a.mp3?download=1"),
      "mp3"
    );

    assert.equal(
      getDirectAudioKind("https://x.test/a.WAV#fragment"),
      "wav"
    );

    assert.equal(
      getDirectAudioKind("https://x.test/a.m4a"),
      "m4a"
    );

    assert.equal(
      getDirectAudioKind("https://x.test/a.flac"),
      "flac"
    );

    assert.equal(
      getDirectAudioKind("https://x.test/a.txt"),
      null,
      "non-audio extensions never resolve"
    );
  });

  it("resolves direct kinds from publisher MIME types", () => {
    assert.equal(getDirectAudioKind("https://x.test/id/1", "audio/mpeg"), "mp3");
    assert.equal(getDirectAudioKind("https://x.test/id/1", "audio/mp4"), "m4a");
    assert.equal(getDirectAudioKind("https://x.test/id/1", "audio/FLAC"), "flac");
    assert.equal(getDirectAudioKind("https://x.test/id/1", "audio/x-wav"), "wav");
    assert.equal(getDirectAudioKind("https://x.test/id/1", "audio/ogg"), null);
    assert.equal(getDirectAudioKind("https://x.test/a.wav", "audio/mpeg"), "wav");
  });

  it("maps every audio kind to its canonical MIME (server parity)", () => {
    assert.deepEqual(MIME_BY_AUDIO_KIND, {
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      flac: "audio/flac",
      wav: "audio/wav"
    });
  });
});

describe("download labels — WAV (v4.0.2)", () => {
  it("labels every music kind honestly, including WAV", () => {
    const labelFor = (source: string, extra: Record<string, unknown> = {}) => {
      const item = normalizeMediaItem({
        branch: "Music",
        source,
        title: "T",
        type: "music",
        ...extra
      });

      return item ? getDownloadLabel(item) : "<rejected>";
    };

    assert.equal(labelFor("a.mp3"), "DOWNLOAD MP3");
    assert.equal(labelFor("a.m4a"), "DOWNLOAD M4A");
    assert.equal(labelFor("a.flac"), "DOWNLOAD FLAC");
    assert.equal(labelFor("a.wav"), "DOWNLOAD WAV");
  });

  it("labels a direct-source WAV track (no branch needed)", () => {
    const item = normalizeMediaItem(DIRECT);

    assert.ok(item);

    assert.equal(getDownloadLabel(item!), "DOWNLOAD WAV");
  });
});
