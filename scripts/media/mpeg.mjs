/*
 * mpeg.mjs — MPEG audio frame header parser + MP3 duration logic.
 *
 * Duration strategy (deterministic, no full-file download):
 *   1. Xing/Info header in the first frame → exact frame count.
 *   2. Otherwise CBR estimate from the first frame's bitrate and the
 *      total file size (marked as an estimate by the caller).
 *
 * The sync script feeds byte windows obtained through range requests;
 * everything here is pure over Uint8Array.
 */

import {
  indexOfAscii,
  readUint32BE
} from "./bytes.mjs";

const MPEG_BITRATES_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320
];

const MPEG_BITRATES_V2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160
];

const MPEG_SAMPLE_RATES = [
  [44100, 48000, 32000],
  [22050, 24000, 16000],
  [11025, 12000, 8000]
];

/**
 * Parse an MPEG audio frame header located exactly at `offset`
 * (the caller locates the 0xFFE sync pattern first).
 */
export function parseMpegFrameHeader(
  bytes,
  offset
) {
  if (offset + 4 > bytes.length) {
    return null;
  }

  if (
    bytes[offset] !== 0xff ||
    (bytes[offset + 1] & 0xe0) !== 0xe0
  ) {
    return null;
  }

  const versionBits = (bytes[offset + 1] >> 3) & 0x03;

  const layerBits = (bytes[offset + 1] >> 1) & 0x03;

  if (versionBits === 0x01 || layerBits === 0x00) {
    /* 01 = reserved version; 00 = reserved layer. */
    return null;
  }

  const version =
    versionBits === 0x03 ? 1 : versionBits === 0x02 ? 2 : 2.5;

  const layer = 4 - layerBits;

  const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;

  const sampleRateIndex = (bytes[offset + 2] >> 2) & 0x03;

  const padded = (bytes[offset + 2] & 0x02) !== 0;

  const channelMode = (bytes[offset + 3] >> 6) & 0x03;

  if (bitrateIndex === 0x00 || bitrateIndex === 0x0f) {
    return null;
  }

  if (sampleRateIndex === 0x03) {
    return null;
  }

  const bitrateTable =
    version === 1 && layer === 3
      ? MPEG_BITRATES_V1_L3
      : version !== 1 && layer === 3
        ? MPEG_BITRATES_V2_L3
        : version === 1 && layer === 2
          ? [
              0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256,
              320, 384
            ]
          : [
              0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352,
              384, 416, 448
            ];

  const bitrateKbps = bitrateTable[bitrateIndex];

  const sampleRate = MPEG_SAMPLE_RATES[versionBits === 0x03 ? 0 : versionBits === 0x02 ? 1 : 2][sampleRateIndex];

  let samplesPerFrame;

  if (layer === 1) {
    samplesPerFrame = 384;
  } else if (layer === 2) {
    samplesPerFrame = 1152;
  } else {
    samplesPerFrame = version === 1 ? 1152 : 576;
  }

  let frameLength;

  if (layer === 1) {
    frameLength =
      (12 * bitrateKbps * 1000) / sampleRate + (padded ? 4 : 0);
  } else {
    frameLength =
      Math.floor(
        (samplesPerFrame / 8) * (bitrateKbps * 1000) / sampleRate
      ) + (padded ? 1 : 0);
  }

  return {
    offset,
    version,
    layer,
    bitrateKbps,
    sampleRate,
    isPadded: padded,
    channelMode,
    samplesPerFrame,
    frameLength: Math.floor(frameLength)
  };
}

/**
 * Locate the first MPEG frame sync after the ID3v2 tag.
 */
export function findFirstMpegFrame(bytes, from = 0) {
  for (let index = from; index < bytes.length - 1; index += 1) {
    if (
      bytes[index] === 0xff &&
      (bytes[index + 1] & 0xe0) === 0xe0
    ) {
      const frame = parseMpegFrameHeader(bytes, index);

      if (frame) {
        return frame;
      }
    }
  }

  return null;
}

/**
 * Read the Xing/Info header (frame count) from inside the first
 * MPEG frame. `bytes` must cover the first frame's beginning.
 *
 * Side information precedes the "Xing"/"Info" marker:
 *   MPEG1: 32 bytes stereo / 17 bytes mono
 *   MPEG2/2.5: 17 bytes stereo / 9 bytes mono
 */
export function readXingHeader(
  bytes,
  frame
) {
  if (!frame || frame.layer !== 3) {
    return null;
  }

  const isMpeg1 = frame.version === 1;

  const isMono = frame.channelMode === 3;

  const sideInfoSize = isMpeg1
    ? isMono
      ? 17
      : 32
    : isMono
      ? 9
      : 17;

  const searchStart = frame.offset + 4 + sideInfoSize;

  const searchEnd = Math.min(
    bytes.length - 4,
    frame.offset + frame.frameLength
  );

  const xingOffset = (() => {
    for (
      let index = searchStart;
      index <= searchEnd;
      index += 1
    ) {
      if (
        (bytes[index] === 0x58 && bytes[index + 1] === 0x69 && bytes[index + 2] === 0x6e && bytes[index + 3] === 0x67) ||
        (bytes[index] === 0x49 && bytes[index + 1] === 0x6e && bytes[index + 2] === 0x66 && bytes[index + 3] === 0x6f)
      ) {
        return index;
      }
    }

    return -1;
  })();

  if (xingOffset < 0 || xingOffset + 8 > bytes.length) {
    return null;
  }

  const flags = readUint32BE(bytes, xingOffset + 4);

  if ((flags & 0x01) === 0) {
    /* Frames field absent — no reliable count. */
    return null;
  }

  if (xingOffset + 12 > bytes.length) {
    return null;
  }

  const frameCount = readUint32BE(bytes, xingOffset + 8);

  if (frameCount === 0) {
    return null;
  }

  return { frameCount };
}

/**
 * Compute MP3 duration from a parsed head window.
 *
 * `fileSize` is the full remote size (from a range probe); `head` the
 * byte window that starts at file offset 0. Returns null when no
 * duration can be derived honestly.
 */
export function computeMp3Duration(
  head,
  fileSize
) {
  const frame = findFirstMpegFrame(head);

  if (!frame) {
    return null;
  }

  const xing = readXingHeader(head, frame);

  if (xing) {
    return (xing.frameCount * frame.samplesPerFrame) / frame.sampleRate;
  }

  /* CBR estimate: total audio bytes × 8 / bitrate. */
  if (
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    frame.bitrateKbps <= 0
  ) {
    return null;
  }

  const audioBytes = Math.max(
    0,
    fileSize - frame.offset
  );

  return (audioBytes * 8) / (frame.bitrateKbps * 1000);
}
