/*
 * tests/media-metadata.test.ts — embedded-metadata extraction tests
 * (MP3 ID3v2.3 / ID3v2.4, M4A MP4 atoms, FLAC blocks, WAV RIFF).
 *
 * The fixtures are deterministic synthetic containers (never site
 * content): the MP3 carries a real silent MPEG Layer III bitstream,
 * the M4A/FLAC fixtures exercise the build-time extractors.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import {
  buildFlac,
  buildM4a,
  buildMp3,
  buildWav
} from "./fixtures/audio.mjs";

import { parseId3v2 } from "../scripts/media/id3.mjs";

import {
  computeMp3Duration
} from "../scripts/media/mpeg.mjs";

import { parseMp4Metadata } from "../scripts/media/mp4.mjs";

import { parseFlacMetadata } from "../scripts/media/flac.mjs";

import { parseWavMetadata } from "../scripts/media/wav.mjs";

import {
  extractAudioMetadata
} from "../scripts/media/audioMetadata.mjs";

import {
  formatDuration,
  normalizeGenre,
  parseSlashPair
} from "../scripts/media/bytes.mjs";

describe("ID3v2 (MP3) metadata", () => {
  it("extracts the full Music contract from an ID3v2.3 tag", () => {
    const bytes = new Uint8Array(
      buildMp3({ version: 3 })
    );

    const parsed = parseId3v2(bytes);

    assert.ok(parsed, "tag should parse");
    assert.equal(parsed.complete, true);

    const fields = parsed!.fields;

    assert.equal(fields.title, "Test Track");
    assert.equal(fields.artist, "Test Artist");
    assert.equal(fields.album, "Test Album");
    assert.equal(fields.albumArtist, "Test Album Artist");
    assert.equal(fields.year, "2026");
    assert.equal(fields.genre, "Rock");
    assert.equal(fields.trackNumber, 7);
    assert.equal(fields.trackTotal, 12);
    assert.equal(fields.discNumber, 1);
    assert.equal(fields.discTotal, 2);
    assert.equal(fields.composer, "Test Composer");
    assert.equal(fields.comment, "Synthetic test track");
  });

  it("extracts an ID3v2.4 tag (TDRC date frame)", () => {
    const bytes = new Uint8Array(
      buildMp3({ version: 4 })
    );

    const parsed = parseId3v2(bytes);

    assert.ok(parsed, "tag should parse");

    const fields = parsed!.fields;

    assert.equal(fields.title, "Test Track");
    assert.equal(fields.year, "2026");
    assert.equal(fields.trackNumber, 7);
  });

  it("resolves numeric genre references through the ID3v1 table", () => {
    assert.equal(normalizeGenre("(17)"), "Rock");
    assert.equal(normalizeGenre("17"), "Rock");
    assert.equal(normalizeGenre("(17)Prog"), "Prog");
    assert.equal(normalizeGenre("Dark Jazz"), "Dark Jazz");
  });

  it("returns null for non-ID3 data", () => {
    const bytes = new Uint8Array(64).fill(0x20);

    assert.equal(parseId3v2(bytes), null);
  });

  it("reports incomplete tags via requiresBytes (range window support)", () => {
    const full = new Uint8Array(buildMp3({}));

    const truncated = full.subarray(0, 10);

    const parsed = parseId3v2(truncated);

    assert.ok(parsed);

    assert.equal(parsed!.complete, false);
    assert.ok(parsed!.requiresBytes > 10);
  });
});

describe("MP3 duration", () => {
  it("derives exact duration from the Xing header", () => {
    const seconds = 30;

    const bytes = new Uint8Array(
      buildMp3({ seconds })
    );

    const duration = computeMp3Duration(bytes, bytes.length);

    assert.ok(duration);

    /* 1148 frames × 1152 / 44100 ≈ 29.98 s */
    assert.ok(Math.abs(duration - seconds) < 0.5);
  });

  it("estimates CBR duration without a usable header window", () => {
    const bytes = new Uint8Array(
      buildMp3({ seconds: 30, withTag: false })
    );

    /* Zero out the Xing marker to force the CBR fallback. */
    const mutated = new Uint8Array(bytes);

    mutated[36] = 0x00;
    mutated[37] = 0x00;
    mutated[38] = 0x00;
    mutated[39] = 0x00;

    const duration = computeMp3Duration(mutated, mutated.length);

    assert.ok(duration);

    assert.ok(Math.abs(duration - 30) < 2);
  });
});

describe("M4A (MP4 atoms) metadata", () => {
  it("extracts iTunes-style tags and mvhd duration", () => {
    const bytes = new Uint8Array(buildM4a({}));

    const parsed = parseMp4Metadata(bytes);

    assert.ok(parsed, "moov should parse");

    const fields = parsed!.fields;

    assert.equal(fields.title, "M4A Track");
    assert.equal(fields.artist, "M4A Artist");
    assert.equal(fields.album, "M4A Album");
    assert.equal(fields.albumArtist, "M4A Album Artist");
    assert.equal(fields.year, "2025");
    assert.equal(fields.genre, "Ambient");
    assert.equal(fields.trackNumber, 3);
    assert.equal(fields.trackTotal, 10);
    assert.equal(fields.composer, "M4A Composer");
    assert.equal(fields.comment, "Synthetic m4a");

    const duration = parsed!.durationSeconds;

    assert.ok(duration);
    assert.ok(Math.abs(duration - 30) < 0.001);
  });

  it("returns null when no moov atom is present", () => {
    const bytes = new Uint8Array(
      buildM4a({}).slice(0, 24)
    );

    assert.equal(parseMp4Metadata(bytes), null);
  });
});

describe("FLAC metadata", () => {
  it("extracts Vorbis comments and STREAMINFO duration", () => {
    const bytes = new Uint8Array(buildFlac({}));

    const parsed = parseFlacMetadata(bytes);

    assert.ok(parsed, "flac should parse");

    const fields = parsed!.fields;

    assert.equal(fields.title, "FLAC Track");
    assert.equal(fields.artist, "FLAC Artist");
    assert.equal(fields.album, "FLAC Album");
    assert.equal(fields.albumArtist, "FLAC Album Artist");
    assert.equal(fields.year, "2024");
    assert.equal(fields.genre, "Classical");
    assert.equal(fields.trackNumber, 5);
    assert.equal(fields.trackTotal, 9);
    assert.equal(fields.composer, "FLAC Composer");

    const duration = parsed!.durationSeconds;

    assert.ok(duration);
    assert.ok(Math.abs(duration - 30) < 0.001);
    assert.equal(parsed!.complete, true);
  });

  it("rejects non-FLAC buffers", () => {
    assert.equal(
      parseFlacMetadata(new Uint8Array([0, 1, 2, 3])),
      null
    );
  });
});

describe("extractAudioMetadata (range pipeline)", () => {
  function makeRangeFetcher(file: Uint8Array) {
    const bytes = new Uint8Array(file);

    return async (url: string, start: number, end: number) => {
      assert.ok(url.startsWith("https://cdn.test/"), "test URL only");

      const rangeEnd = end === null ? bytes.length - 1 : end;

      if (start === 0 && rangeEnd === 0) {
        return {
          status: 206,
          arrayBuffer: bytes.subarray(0, 1).buffer,
          contentRange: `bytes 0-0/${bytes.length}`,
          acceptRanges: "bytes"
        };
      }

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

  it("extracts MP3 metadata over range windows", async () => {
    const file = buildMp3({ seconds: 8 });

    const result = await extractAudioMetadata({
      url: "https://cdn.test/audio.mp3",
      kind: "mp3",
      fetchRange: makeRangeFetcher(file)
    });

    assert.equal(result.source, "embedded");
    assert.equal(result.fields.title, "Test Track");
    assert.ok(result.duration);
    assert.ok(Math.abs(result.duration! - 8) < 0.5);
    assert.equal(result.exact, true);
  });

  it("extracts M4A metadata from the head window", async () => {
    const file = buildM4a({ seconds: 21 });

    const result = await extractAudioMetadata({
      url: "https://cdn.test/audio.m4a",
      kind: "m4a",
      fetchRange: makeRangeFetcher(file)
    });

    assert.equal(result.source, "embedded");
    assert.equal(result.fields.title, "M4A Track");
    assert.ok(Math.abs(result.duration! - 21) < 0.001);
  });

  it("extracts FLAC metadata including exact duration", async () => {
    const file = buildFlac({ seconds: 12.5 });

    const result = await extractAudioMetadata({
      url: "https://cdn.test/audio.flac",
      kind: "flac",
      fetchRange: makeRangeFetcher(file)
    });

    assert.equal(result.source, "embedded");
    assert.equal(result.fields.artist, "FLAC Artist");
    assert.ok(Math.abs(result.duration! - 12.5) < 0.001);
  });

  it("never fabricates fields for a hostile/empty source", async () => {
    const result = await extractAudioMetadata({
      url: "https://cdn.test/none.mp3",
      kind: "mp3",
      fetchRange: async () => ({ status: 404, arrayBuffer: new ArrayBuffer(0), contentRange: null, acceptRanges: null })
    });

    assert.equal(result.source, "none");
    assert.deepEqual(result.fields, {});
    assert.equal(result.duration, undefined);
  });
});

describe("shared byte helpers", () => {
  it("formats durations honestly (never fake time)", () => {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(65), "1:05");
    assert.equal(formatDuration(3600 + 61), "1:01:01");
    assert.equal(formatDuration(Number.NaN), null);
    assert.equal(formatDuration(-3), null);
  });

  it("parses track/disc slash pairs", () => {
    assert.deepEqual(parseSlashPair("7/12"), { index: 7, total: 12 });
    assert.deepEqual(parseSlashPair("7"), { index: 7, total: undefined });
    assert.equal(parseSlashPair("x"), null);
  });
});

/* ---------------------------------------------------------------- */
/* v4.0.2 — WAV (RIFF/LIST INFO)                                     */
/* ---------------------------------------------------------------- */

describe("WAV (RIFF) metadata (v4.0.2)", () => {
  it("extracts LIST/INFO tags and the exact PCM duration", () => {
    const bytes = buildWav({
      title: "Riff Title",
      artist: "Riff Artist",
      album: "Riff Album",
      composer: "Riff Composer",
      year: "2025",
      genre: "Ambient",
      track: "2/8",
      seconds: 9
    });

    const parsed = parseWavMetadata(bytes);

    assert.ok(parsed, "RIFF/WAVE should parse");

    assert.equal(parsed!.fields.title, "Riff Title");
    assert.equal(parsed!.fields.artist, "Riff Artist");
    assert.equal(parsed!.fields.album, "Riff Album");
    assert.equal(parsed!.fields.composer, "Riff Composer");
    assert.equal(parsed!.fields.year, "2025");
    assert.equal(parsed!.fields.trackNumber, 2);
    assert.equal(parsed!.fields.trackTotal, 8);

    assert.ok(Math.abs(parsed!.durationSeconds! - 9) < 0.01);
  });

  it("returns null for non-RIFF bytes", () => {
    assert.equal(parseWavMetadata(new Uint8Array(64)), null);

    assert.equal(
      parseWavMetadata(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x33])),
      null,
      "RIFF without the WAVE form type is not a WAV"
    );
  });

  it("resolves duration from a truncated head window (data body never needed)", () => {
    const bytes = buildWav({ seconds: 20 });

    /* Past the fmt + LIST chunks and the data chunk HEADER, far
     * before the data body — the size field is all the parser needs. */
    const head = bytes.subarray(0, 200);

    const parsed = parseWavMetadata(head);

    assert.ok(parsed);

    assert.ok(
      Math.abs(parsed!.durationSeconds! - 20) < 0.01,
      "duration comes from the data chunk SIZE field, not its body"
    );
  });

  it("extracts through the range-request orchestrator like production", async () => {
    const bytes = buildWav({
      title: "Orchestrated",
      artist: "Via Ranges",
      seconds: 6
    });

    const files = new Map<string, Uint8Array>([
      ["w.wav", bytes]
    ]);

    const fetchRange = async (
      url: string,
      start: number,
      end: number | null
    ) => {
      const key = new URL(url).pathname.replace(/^\//, "");

      const data = files.get(key);

      if (!data) {
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
          arrayBuffer: data.subarray(0, 1).slice().buffer,
          contentRange: `bytes 0-0/${data.length}`,
          acceptRanges: "bytes"
        };
      }

      const rangeEnd = end ?? data.length - 1;

      return {
        status: 206,
        arrayBuffer: data
          .subarray(start, rangeEnd + 1)
          .slice().buffer,
        contentRange: `bytes ${start}-${rangeEnd}/${data.length}`,
        acceptRanges: "bytes"
      };
    };

    const result = await extractAudioMetadata({
      url: "https://cdn.test/w.wav",
      kind: "wav",
      fetchRange
    });

    assert.equal(result.source, "embedded");

    assert.equal(result.fields.title, "Orchestrated");

    assert.equal(result.fields.artist, "Via Ranges");

    assert.ok(Math.abs(result.duration! - 6) < 0.01);
  });
});
