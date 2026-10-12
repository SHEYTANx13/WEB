/*
 * wav.mjs — RIFF/WAVE metadata parser (build time).
 *
 * Reads the fmt chunk (byte rate → exact duration from the data
 * chunk's size field), the fact chunk (compressed formats), and
 * LIST/INFO tags from byte windows. The data chunk BODY is never
 * needed — its 8-byte header carries the size, so duration resolves
 * from the head window alone even for files far larger than it.
 *
 * LIST/INFO sub-chunk ids mapped to the Music contract:
 *   INAM → title, IART → artist, IPRD → album, ICRD → year,
 *   IGNR → genre, ITRK → trackNumber/trackTotal, ICMT → comment,
 *   ICMS → composer (non-standard but common in the wild)
 */

import {
  startsWithAscii,
  normalizeGenre,
  parseSlashPair
} from "./bytes.mjs";

const INFO_KEYS = new Set([
  "INAM",
  "IART",
  "IPRD",
  "ICRD",
  "IGNR",
  "ITRK",
  "ICMT",
  "ICMS"
]);

function decodeInfoText(bytes) {
  let end = bytes.length;

  /* INFO values are null- or space-padded; trim both. */
  while (end > 0 && (bytes[end - 1] === 0 || bytes[end - 1] === 0x20)) {
    end -= 1;
  }

  if (end <= 0) {
    return null;
  }

  const text = new TextDecoder("utf-8").decode(
    bytes.subarray(0, end)
  );

  return text.length > 0 ? text : null;
}

function applyInfoField(
  fields,
  key,
  value
) {
  if (!INFO_KEYS.has(key) || value === null) {
    return;
  }

  switch (key) {
    case "INAM":
      fields.title = value;
      return;

    case "IART":
      fields.artist = value;
      return;

    case "IPRD":
      fields.album = value;
      return;

    case "ICMS":
      fields.composer = value;
      return;

    case "IGNR":
      fields.genre = normalizeGenre(value) ?? value;
      return;

    case "ICMT":
      if (!fields.comment) {
        fields.comment = value;
      }
      return;

    case "ICRD": {
      const year = value.match(/(\d{4})/);

      if (year) {
        fields.year = year[1];
      }
      return;
    }

    case "ITRK": {
      const pair = parseSlashPair(value);

      if (pair) {
        if (pair.index) {
          fields.trackNumber = pair.index;
        }

        if (pair.total !== undefined) {
          fields.trackTotal = pair.total;
        }
      }
      return;
    }

    default:
      return;
  }
}

/**
 * Parse RIFF/WAVE metadata from a byte window starting at the file
 * head.
 *
 * Returns null when the window is not a RIFF/WAVE file, otherwise
 * { fields, durationSeconds? } — duration comes from the data chunk
 * size over the fmt byte rate (exact for PCM; the fact chunk's
 * sample length is preferred when present for compressed formats).
 * A truncated window yields whatever honestly resolved: tags without
 * duration, duration without tags, or neither — never a guess.
 */
export function parseWavMetadata(bytes) {
  if (
    bytes.length < 12 ||
    !startsWithAscii(bytes, "RIFF") ||
    !startsWithAscii(bytes.subarray(8, 12), "WAVE")
  ) {
    return null;
  }

  const fields = {};

  let durationSeconds;

  let byteRate;

  let sampleRate;

  let factSampleLength;

  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );

    const chunkSize =
      (bytes[offset + 4] |
        (bytes[offset + 5] << 8) |
        (bytes[offset + 6] << 16) |
        (bytes[offset + 7] << 24)) >>>
      0;

    const bodyStart = offset + 8;

    const bodyEnd = Math.min(
      bodyStart + chunkSize,
      bytes.length
    );

    if (chunkId === "fmt " && bodyEnd - bodyStart >= 16) {
      sampleRate =
        (bytes[bodyStart + 4] |
          (bytes[bodyStart + 5] << 8) |
          (bytes[bodyStart + 6] << 16) |
          (bytes[bodyStart + 7] << 24)) >>>
        0;

      byteRate =
        (bytes[bodyStart + 8] |
          (bytes[bodyStart + 9] << 8) |
          (bytes[bodyStart + 10] << 16) |
          (bytes[bodyStart + 11] << 24)) >>>
        0;
    } else if (chunkId === "data") {
      /* Only the size field is needed — the body may be truncated. */
      if (chunkSize > 0 && byteRate > 0) {
        durationSeconds = chunkSize / byteRate;
      }
    } else if (chunkId === "fact" && bodyEnd - bodyStart >= 4) {
      factSampleLength =
        (bytes[bodyStart] |
          (bytes[bodyStart + 1] << 8) |
          (bytes[bodyStart + 2] << 16) |
          (bytes[bodyStart + 3] << 24)) >>>
        0;
    } else if (
      chunkId === "LIST" &&
      bodyEnd - bodyStart >= 4 &&
      startsWithAscii(bytes.subarray(bodyStart, bodyStart + 4), "INFO")
    ) {
      let cursor = bodyStart + 4;

      while (cursor + 8 <= bodyEnd) {
        const subId = String.fromCharCode(
          bytes[cursor],
          bytes[cursor + 1],
          bytes[cursor + 2],
          bytes[cursor + 3]
        );

        const subSize =
          (bytes[cursor + 4] |
            (bytes[cursor + 5] << 8) |
            (bytes[cursor + 6] << 16) |
            (bytes[cursor + 7] << 24)) >>>
          0;

        const subStart = cursor + 8;

        const subEnd = Math.min(
          subStart + subSize,
          bodyEnd
        );

        if (subEnd > subStart) {
          applyInfoField(
            fields,
            subId,
            decodeInfoText(bytes.subarray(subStart, subEnd))
          );
        }

        /* Sub-chunks are word-aligned (odd sizes carry one pad byte). */
        cursor = subStart + subSize + (subSize % 2);
      }
    }

    /* Chunks are word-aligned (odd sizes carry one pad byte). */
    offset = bodyStart + chunkSize + (chunkSize % 2);
  }

  /* Compressed formats: the fact chunk's sample count is the exact
   * source of truth when both it and the sample rate resolved. */
  if (
    factSampleLength !== undefined &&
    sampleRate > 0 &&
    (durationSeconds === undefined ||
      Math.abs(factSampleLength / sampleRate - durationSeconds) > 1)
  ) {
    durationSeconds = factSampleLength / sampleRate;
  }

  return {
    fields,
    durationSeconds:
      typeof durationSeconds === "number" &&
      Number.isFinite(durationSeconds) &&
      durationSeconds > 0
        ? durationSeconds
        : undefined
  };
}
