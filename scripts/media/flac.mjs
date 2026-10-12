/*
 * flac.mjs — FLAC metadata block parser.
 *
 * Reads STREAMINFO (exact duration) and VORBIS_COMMENT (tags) from
 * build-time byte windows. Picture blocks are skipped — cover art
 * resolves through deterministic file paths, never embedded images.
 *
 * Vorbis comment keys (case-insensitive) mapped to the Music contract:
 *   TITLE, ARTIST, ALBUM, ALBUMARTIST/ALBUM ARTIST, DATE,
 *   GENRE, TRACKNUMBER, TRACKTOTAL, DISCNUMBER, DISCTOTAL,
 *   COMPOSER, COMMENT/DESCRIPTION
 */

import {
  startsWithAscii,
  splitNullSeparated
} from "./bytes.mjs";

const VORBIS_KEYS = new Set([
  "TITLE",
  "ARTIST",
  "ALBUM",
  "ALBUMARTIST",
  "ALBUM ARTIST",
  "DATE",
  "GENRE",
  "TRACKNUMBER",
  "TRACKTOTAL",
  "TOTALTRACKS",
  "DISCNUMBER",
  "DISCTOTAL",
  "TOTALDISCS",
  "COMPOSER",
  "COMMENT",
  "DESCRIPTION"
]);

function applyVorbisField(
  fields,
  key,
  rawValue
) {
  const canonical = key.toUpperCase();

  if (!VORBIS_KEYS.has(canonical)) {
    return;
  }

  const values = splitNullSeparated(rawValue);

  if (values.length === 0) {
    return;
  }

  const value = values[0];

  switch (canonical) {
    case "TITLE":
      fields.title = value;
      return;

    case "ARTIST":
      fields.artist = value;
      return;

    case "ALBUM":
      fields.album = value;
      return;

    case "ALBUMARTIST":
    case "ALBUM ARTIST":
      fields.albumArtist = value;
      return;

    case "GENRE":
      fields.genre = value;
      return;

    case "COMPOSER":
      fields.composer = value;
      return;

    case "COMMENT":
    case "DESCRIPTION":
      if (!fields.comment) {
        fields.comment = value;
      }
      return;

    case "DATE": {
      const year = value.match(/(\d{4})/);

      if (year) {
        fields.year = year[1];
      }
      return;
    }

    case "TRACKNUMBER": {
      const index = Number.parseInt(value, 10);

      if (Number.isInteger(index) && index > 0) {
        fields.trackNumber = index;
      }
      return;
    }

    case "TRACKTOTAL":
    case "TOTALTRACKS": {
      const total = Number.parseInt(value, 10);

      if (Number.isInteger(total) && total > 0) {
        fields.trackTotal = total;
      }
      return;
    }

    case "DISCNUMBER": {
      const index = Number.parseInt(value, 10);

      if (Number.isInteger(index) && index > 0) {
        fields.discNumber = index;
      }
      return;
    }

    case "DISCTOTAL":
    case "TOTALDISCS": {
      const total = Number.parseInt(value, 10);

      if (Number.isInteger(total) && total > 0) {
        fields.discTotal = total;
      }
      return;
    }

    default:
      return;
  }
}

/**
 * Parse FLAC metadata from a byte window starting at the file head.
 *
 * Returns null when the window does not start with "fLaC", otherwise
 * { fields, durationSeconds?, requiresBytes, complete } — where
 * `requiresBytes` is how many head bytes the metadata region needs
 * (the walker stops at the first non-last block boundary).
 */
export function parseFlacMetadata(bytes) {
  if (
    bytes.length < 4 ||
    !startsWithAscii(bytes, "fLaC")
  ) {
    return null;
  }

  const fields = {};

  let durationSeconds;

  let offset = 4;

  let complete = false;

  while (offset + 4 <= bytes.length) {
    const header = bytes[offset];

    const isLast = (header & 0x80) !== 0;

    const blockType = header & 0x7f;

    const blockLength =
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];

    const bodyStart = offset + 4;

    const bodyEnd = bodyStart + blockLength;

    if (bodyEnd > bytes.length) {
      complete = false;
      break;
    }

    if (blockType === 0 && blockLength >= 18) {
      /*
       * STREAMINFO — 34 bytes; the packed 64-bit field at body
       * offset 10 carries: sample rate (20 bits, 63..44),
       * channels-1 (3, 43..41), bits-per-sample-1 (5, 40..36),
       * total samples (36, 35..0).
       */
      const p = bodyStart + 10;

      const sampleRate =
        (bytes[p] << 12) |
        (bytes[p + 1] << 4) |
        (bytes[p + 2] >> 4);

      /* Bits 35..32 are the LOW nibble of byte p+3. */
      const totalSamples =
        (bytes[p + 3] & 0x0f) * 0x100000000 +
        (bytes[p + 4] << 24) +
        (bytes[p + 5] << 16) +
        (bytes[p + 6] << 8) +
        bytes[p + 7];

      if (sampleRate > 0 && totalSamples > 0) {
        durationSeconds = totalSamples / sampleRate;
      }
    } else if (blockType === 4) {
      /* VORBIS_COMMENT — little-endian framing. */
      const view = bytes;

      if (bodyStart + 8 <= bodyEnd) {
        const vendorLength =
          (view[bodyStart] |
            (view[bodyStart + 1] << 8) |
            (view[bodyStart + 2] << 16) |
            (view[bodyStart + 3] << 24)) >>> 0;

        let cursor = bodyStart + 4 + vendorLength;

        if (cursor + 4 <= bodyEnd) {
          const count =
            (view[cursor] |
              (view[cursor + 1] << 8) |
              (view[cursor + 2] << 16) |
              (view[cursor + 3] << 24)) >>> 0;

          cursor += 4;

          for (
            let index = 0;
            index < count && cursor + 4 <= bodyEnd;
            index += 1
          ) {
            const length =
              (view[cursor] |
                (view[cursor + 1] << 8) |
                (view[cursor + 2] << 16) |
                (view[cursor + 3] << 24)) >>> 0;

            cursor += 4;

            if (cursor + length > bodyEnd) {
              break;
            }

            const entry = new TextDecoder("utf-8").decode(
              bytes.subarray(cursor, cursor + length)
            );

            const separator = entry.indexOf("=");

            if (separator > 0) {
              applyVorbisField(
                fields,
                entry.slice(0, separator),
                entry.slice(separator + 1)
              );
            }

            cursor += length;
          }
        }
      }
    }

    /* Type 6 (PICTURE) intentionally skipped. */

    offset = bodyEnd;

    if (isLast) {
      complete = true;
      break;
    }
  }

  return {
    fields,
    durationSeconds,
    requiresBytes: offset + 4,
    complete
  };
}
