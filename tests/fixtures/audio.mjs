/*
 * tests/fixtures/audio.mjs — deterministic synthetic audio files.
 *
 * These are TEST FIXTURES: byte-exact containers built to exercise
 * the metadata parsers and the HTTP range pipeline. They never ship
 * in the site catalog — data/media.json only ever contains items the
 * Contents sources publish. The MP3 payload is a real (silent) MPEG
 * Layer III bitstream so browser playback can be verified end to
 * end; M4A/FLAC fixtures exercise the build-time extractors.
 */

import {
  readUint32BE
} from "../../scripts/media/bytes.mjs";

function utf8(text) {
  return new TextEncoder().encode(text);
}

function latin1(text) {
  const bytes = new Uint8Array(text.length);

  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function concat(parts) {
  const length = parts.reduce(
    (sum, part) => sum + part.length,
    0
  );

  const output = new Uint8Array(length);

  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);

    offset += part.length;
  }

  return output;
}

function uint32BE(value) {
  const bytes = new Uint8Array(4);

  bytes[0] = (value >>> 24) & 0xff;
  bytes[1] = (value >>> 16) & 0xff;
  bytes[2] = (value >>> 8) & 0xff;
  bytes[3] = value & 0xff;

  return bytes;
}

function uint32LE(value) {
  const bytes = new Uint8Array(4);

  bytes[0] = value & 0xff;
  bytes[1] = (value >>> 8) & 0xff;
  bytes[2] = (value >>> 16) & 0xff;
  bytes[3] = (value >>> 24) & 0xff;

  return bytes;
}

function uint16LE(value) {
  const bytes = new Uint8Array(2);

  bytes[0] = value & 0xff;

  bytes[1] = (value >>> 8) & 0xff;

  return bytes;
}

function uint24BE(value) {
  const bytes = new Uint8Array(3);

  bytes[0] = (value >>> 16) & 0xff;
  bytes[1] = (value >>> 8) & 0xff;
  bytes[2] = value & 0xff;

  return bytes;
}

function syncSafe(value) {
  const bytes = new Uint8Array(4);

  bytes[0] = (value >>> 21) & 0x7f;
  bytes[1] = (value >>> 14) & 0x7f;
  bytes[2] = (value >>> 7) & 0x7f;
  bytes[3] = value & 0x7f;

  return bytes;
}

/* ---------------------------------------------------------------- */
/* MP3 / ID3v2                                                       */
/* ---------------------------------------------------------------- */

function id3FrameV23(id, text) {
  const body = concat([
    Uint8Array.of(0x00),
    latin1(text)
  ]);

  return concat([
    latin1(id),
    uint32BE(body.length),
    Uint8Array.of(0x00, 0x00),
    body
  ]);
}

function id3FrameV24(id, text) {
  const body = concat([
    Uint8Array.of(0x03),
    utf8(text)
  ]);

  return concat([
    latin1(id),
    syncSafe(body.length),
    Uint8Array.of(0x00, 0x00),
    body
  ]);
}

function buildId3Tag(version, frames) {
  const body = concat(frames);

  return concat([
    latin1("ID3"),
    Uint8Array.of(version, 0x00, 0x00),
    syncSafe(body.length),
    body
  ]);
}

/**
 * One silent MPEG1 Layer III frame at 128 kbps / 44.1 kHz stereo,
 * with a Xing header carrying the exact frame count.
 */
function buildMpegFrame(frameCount) {
  const frameLength = 417;

  const frame = new Uint8Array(frameLength);

  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0x00;

  /* "Xing" at 4 + 32 (MPEG1 stereo side info). */
  const xing = latin1("Xing");

  frame.set(xing, 36);

  /* Flags: frames field + bytes field. */
  frame.set(uint32BE(0x00000003), 40);

  frame.set(uint32BE(frameCount), 44);

  frame.set(uint32BE(frameCount * frameLength), 48);

  return frame;
}

/**
 * Build a playable silent MP3 with ID3v2.3 or v2.4 tags.
 * seconds → frame count → duration (Xing-exact).
 */
export function buildMp3({
  seconds = 30,
  version = 3,
  title = "Test Track",
  artist = "Test Artist",
  album = "Test Album",
  albumArtist = "Test Album Artist",
  year = "2026",
  genre = "Rock",
  track = "7/12",
  disc = "1/2",
  composer = "Test Composer",
  comment = "Synthetic test track",
  withTag = true
} = {}) {
  const samplesPerFrame = 1152;

  const sampleRate = 44100;

  const frameCount = Math.max(
    1,
    Math.round((seconds * sampleRate) / samplesPerFrame)
  );

  const frames = [];

  if (withTag) {
    const entries =
      version === 3
        ? [
            ["TIT2", title],
            ["TPE1", artist],
            ["TALB", album],
            ["TPE2", albumArtist],
            ["TYER", year],
            ["TCON", genre],
            ["TRCK", track],
            ["TPOS", disc],
            ["TCOM", composer]
          ]
        : [
            /* v2.4: the year frame is TDRC. */
            ["TIT2", title],
            ["TPE1", artist],
            ["TALB", album],
            ["TPE2", albumArtist],
            ["TDRC", year],
            ["TCON", genre],
            ["TRCK", track],
            ["TPOS", disc],
            ["TCOM", composer]
          ];

    const textFrames = entries.map(([id, value]) =>
      version === 3 ? id3FrameV23(id, value) : id3FrameV24(id, value)
    );

    /*
     * COMM frame: [encoding][language 3][short desc \0][text].
     */
    const commBody = concat([
      Uint8Array.of(0x00),
      latin1("eng"),
      Uint8Array.of(0x00),
      latin1(comment)
    ]);

    const commFrame = concat([
      latin1("COMM"),
      uint32BE(commBody.length),
      Uint8Array.of(0x00, 0x00),
      commBody
    ]);

    frames.push(
      buildId3Tag(version, [...textFrames, commFrame])
    );
  }

  const audioFrame = buildMpegFrame(frameCount);

  const mpegFrames = [];

  for (let index = 0; index < frameCount; index += 1) {
    mpegFrames.push(audioFrame);
  }

  return concat([...frames, ...mpegFrames]);
}

export { buildId3Tag, id3FrameV23, id3FrameV24, buildMpegFrame };

/* ---------------------------------------------------------------- */
/* M4A / MP4 atoms                                                   */
/* ---------------------------------------------------------------- */

function atom(type, body) {
  /* Accept a single buffer or a list of parts. */
  const payload = Array.isArray(body) ? concat(body) : body;

  return concat([
    uint32BE(8 + payload.length),
    latin1(type),
    payload
  ]);
}

function ilistEntry(type, text) {
  const data = atom(
    "data",
    concat([
      uint32BE(1),
      uint32BE(0),
      utf8(text)
    ])
  );

  return atom(type, data);
}

function trknEntry(index, total) {
  const payload = concat([
    Uint8Array.of(0x00, 0x00),
    Uint8Array.of((index >> 8) & 0xff, index & 0xff),
    Uint8Array.of((total >> 8) & 0xff, total & 0xff)
  ]);

  const data = atom(
    "data",
    concat([
      uint32BE(0),
      uint32BE(0),
      payload
    ])
  );

  return atom("trkn", data);
}

/**
 * Build a minimal (non-playable) M4A: ftyp + moov(mvhd + udta→meta→ilst).
 */
export function buildM4a({
  title = "M4A Track",
  artist = "M4A Artist",
  album = "M4A Album",
  albumArtist = "M4A Album Artist",
  year = "2025",
  genre = "Ambient",
  trackNumber = 3,
  trackTotal = 10,
  discNumber = 1,
  discTotal = 1,
  composer = "M4A Composer",
  comment = "Synthetic m4a",
  seconds = 30
} = {}) {
  const timescale = 1000;

  const duration = Math.round(seconds * timescale);

  const mvhdBody = concat([
    Uint8Array.of(0x00, 0x00, 0x00, 0x00),
    uint32BE(0),
    uint32BE(0),
    uint32BE(timescale),
    uint32BE(duration),
    uint32BE(0x00010000),
    Uint8Array.of(0x01, 0x00),
    new Uint8Array(10),
    new Uint8Array(36),
    new Uint8Array(24),
    uint32BE(2)
  ]);

  const mvhd = atom("mvhd", mvhdBody);

  const ilist = atom("ilst", [
    ilistEntry("\u00a9nam", title),
    ilistEntry("\u00a9ART", artist),
    ilistEntry("\u00a9alb", album),
    ilistEntry("aART", albumArtist),
    ilistEntry("\u00a9day", year),
    ilistEntry("\u00a9gen", genre),
    trknEntry(trackNumber, trackTotal),
    ilistEntry("\u00a9wrt", composer),
    ilistEntry("\u00a9cmt", comment)
  ]);

  const meta = atom(
    "meta",
    concat([
      Uint8Array.of(0x00, 0x00, 0x00, 0x00),
      ilist
    ])
  );

  const udta = atom("udta", meta);

  const moov = atom("moov", concat([mvhd, udta]));

  const ftyp = atom(
    "ftyp",
    concat([
      latin1("M4A "),
      uint32BE(0),
      latin1("mp42"),
      latin1("isom")
    ])
  );

  /* Padding atom before moov — browsers tolerate, parsers must skip. */
  const free = atom("free", new Uint8Array(64));

  return concat([ftyp, free, moov]);
}

/* ---------------------------------------------------------------- */
/* FLAC                                                              */
/* ---------------------------------------------------------------- */

function flacBlock(type, body, isLast) {
  return concat([
    Uint8Array.of((isLast ? 0x80 : 0x00) | type),
    uint24BE(body.length),
    body
  ]);
}

/**
 * Build a minimal (non-playable) FLAC: fLaC + STREAMINFO + VORBIS_COMMENT.
 */
export function buildFlac({
  title = "FLAC Track",
  artist = "FLAC Artist",
  album = "FLAC Album",
  albumArtist = "FLAC Album Artist",
  year = "2024",
  genre = "Classical",
  trackNumber = 5,
  trackTotal = 9,
  discNumber = 2,
  discTotal = 3,
  composer = "FLAC Composer",
  comment = "Synthetic flac",
  seconds = 30,
  sampleRate = 44100
} = {}) {
  const totalSamples = Math.round(seconds * sampleRate);

  /*
   * STREAMINFO packed field: sample rate (20 bits), channels-1
   * (3), bits-per-sample-1 (5), total samples (36).
   */
  const packed =
    (BigInt(sampleRate) << 44n) |
    (1n << 41n) |
    (15n << 36n) |
    BigInt(totalSamples);

  const packedBytes = new Uint8Array(8);

  for (let index = 0; index < 8; index += 1) {
    packedBytes[index] = Number(
      (packed >> BigInt((7 - index) * 8)) & 0xffn
    );
  }

  const streamInfo = concat([
    uint32BE(0x10001000).slice(0, 4),
    new Uint8Array(6),
    packedBytes,
    new Uint8Array(16)
  ]);

  const vorbisComment = (
    key,
    value
  ) => {
    const entry = utf8(`${key}=${value}`);

    return concat([
      uint32LE(entry.length),
      entry
    ]);
  };

  const vendor = utf8("WEB-test-vendor");

  const comments = concat([
    uint32LE(vendor.length),
    vendor,
    uint32LE(10),
    vorbisComment("TITLE", title),
    vorbisComment("ARTIST", artist),
    vorbisComment("ALBUM", album),
    vorbisComment("ALBUMARTIST", albumArtist),
    vorbisComment("DATE", year),
    vorbisComment("GENRE", genre),
    vorbisComment("TRACKNUMBER", String(trackNumber)),
    vorbisComment("TRACKTOTAL", String(trackTotal)),
    vorbisComment("DISCNUMBER", String(discNumber)),
    vorbisComment("COMPOSER", composer)
  ]);

  return concat([
    latin1("fLaC"),
    flacBlock(0, streamInfo, false),
    flacBlock(4, comments, true)
  ]);
}

/**
 * A real (silent) PCM RIFF/WAVE file with LIST/INFO tags — the WAV
 * counterpart of buildMp3: byte-exact for the parser tests and
 * genuinely playable in a browser for end-to-end verification.
 */
export function buildWav({
  title = "WAV Track",
  artist = "WAV Artist",
  album = "WAV Album",
  composer = "WAV Composer",
  year = "2024",
  genre = "Ambient",
  track = "3/7",
  comment = "Synthetic wav",
  seconds = 30,
  sampleRate = 44100,
  channels = 2,
  bitsPerSample = 16
} = {}) {
  const blockAlign =
    (channels * bitsPerSample) / 8;

  const byteRate =
    sampleRate * blockAlign;

  const dataBytes = Math.round(
    seconds * byteRate
  );

  /* Word-aligned data body (16-bit stereo is always even; the pad
   * keeps the builder honest for any configuration). */
  const data = new Uint8Array(
    dataBytes + (dataBytes % 2)
  );

  const fmt = concat([
    uint16LE(1), /* PCM */
    uint16LE(channels),
    uint32LE(sampleRate),
    uint32LE(byteRate),
    uint16LE(blockAlign),
    uint16LE(bitsPerSample)
  ]);

  const infoChunk = (id, text) => {
    const body = utf8(text);

    return concat([
      latin1(id),
      uint32LE(body.length),
      body,
      body.length % 2 === 1
        ? new Uint8Array([0])
        : new Uint8Array(0)
    ]);
  };

  const listBody = concat([
    latin1("INFO"),
    infoChunk("INAM", title),
    infoChunk("IART", artist),
    infoChunk("IPRD", album),
    infoChunk("ICMS", composer),
    infoChunk("ICRD", year),
    infoChunk("IGNR", genre),
    infoChunk("ITRK", track),
    infoChunk("ICMT", comment)
  ]);

  const chunk = (id, body) =>
    concat([
      latin1(id),
      uint32LE(body.length),
      body,
      body.length % 2 === 1
        ? new Uint8Array([0])
        : new Uint8Array(0)
    ]);

  const wave = concat([
    chunk("fmt ", fmt),
    chunk("LIST", listBody),
    chunk("data", data)
  ]);

  return concat([
    latin1("RIFF"),
    uint32LE(4 + wave.length),
    latin1("WAVE"),
    wave
  ]);
}

/**
 * A tiny valid 1×1 red PNG — cover-probe fixtures.
 */
export function buildCoverPng() {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
    0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03,
    0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
}

export { concat, uint32BE, readUint32BE };
