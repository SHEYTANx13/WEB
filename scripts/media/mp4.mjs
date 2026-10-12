/*
 * mp4.mjs — ISO BMFF (MP4/M4A) atom parser for M4A audio metadata.
 *
 * Walks the atom tree over a byte window obtained at build time:
 *   moov → mvhd   → duration (timescale-normalised seconds)
 *   moov → udta → meta → ilst → iTunes-style entries:
 *     ©nam title, ©ART artist, ©alb album, aART album artist,
 *     ©day date/year, ©gen genre, gnre numeric genre (ID3v1 index),
 *     trkn track, disk disc, ©wrt composer, ©cmt comment
 *
 * Well-formed files only: malformed atoms stop the walk cleanly and
 * the caller falls back to manifest-provided fields (never guesses).
 */

import {
  readUint32BE,
  readFourCc,
  startsWithAscii,
  normalizeGenre,
  parseSlashPair
} from "./bytes.mjs";

const ILIST_FIELD_MAP = {
  "\u00a9nam": "title",
  "\u00a9ART": "artist",
  "\u00a9alb": "album",
  aART: "albumArtist",
  "\u00a9day": "year",
  "\u00a9gen": "genre",
  gnre: "genreIndex",
  trkn: "track",
  disk: "disc",
  "\u00a9wrt": "composer",
  "\u00a9cmt": "comment"
};

/**
 * Iterate direct child atoms of the window [start, end).
 * Yields { type, bodyStart, bodyEnd, totalSize } and handles:
 *   - size == 1  → 64-bit extended size (header is 16 bytes)
 *   - size == 0  → atom extends to the end of the window
 */
export function* walkAtoms(bytes, start, end) {
  let offset = start;

  while (offset + 8 <= end) {
    const size32 = readUint32BE(bytes, offset);

    const type = readFourCc(bytes, offset + 4);

    let headerSize = 8;

    let totalSize = size32;

    if (size32 === 1) {
      if (offset + 16 > end) {
        return;
      }

      const high = readUint32BE(bytes, offset + 8);

      const low = readUint32BE(bytes, offset + 12);

      totalSize = high * 0x100000000 + low;

      headerSize = 16;
    } else if (size32 === 0) {
      totalSize = end - offset;
    } else if (size32 < 8) {
      /* Corrupt atom: stop the walk. */
      return;
    }

    if (offset + totalSize > end) {
      return;
    }

    yield {
      type,
      bodyStart: offset + headerSize,
      bodyEnd: offset + totalSize,
      totalSize
    };

    offset += totalSize;
  }
}

/**
 * Decode an ilst entry's `data` atom value.
 * data atom body: [4-byte type flags][4-byte locale][value…]
 * Type flags: 1 = UTF-8 text, 13/14 = image (ignored), 0 = binary.
 */
function decodeIlistData(
  bytes,
  bodyStart,
  bodyEnd
) {
  for (const atom of walkAtoms(bytes, bodyStart, bodyEnd)) {
    if (atom.type !== "data") {
      continue;
    }

    if (atom.bodyEnd - atom.bodyStart < 8) {
      return null;
    }

    const typeFlags = readUint32BE(bytes, atom.bodyStart);

    const value = bytes.subarray(
      atom.bodyStart + 8,
      atom.bodyEnd
    );

    if (typeFlags === 1) {
      return {
        kind: "text",
        text: new TextDecoder("utf-8").decode(value)
      };
    }

    if (typeFlags === 21 || typeFlags === 0) {
      /* Signed/unsigned integer payload (gnre uses 16-bit BE). */
      if (value.length === 2) {
        return {
          kind: "number",
          value: (value[0] << 8) | value[1]
        };
      }

      if (value.length === 4) {
        return {
          kind: "number",
          value: readUint32BE(value, 0)
        };
      }

      return { kind: "binary", bytes: value };
    }

    return { kind: "binary", bytes: value };
  }

  return null;
}

/**
 * Find an atom of `type` among direct children in [start, end).
 */
function findAtom(
  bytes,
  start,
  end,
  type
) {
  for (const atom of walkAtoms(bytes, start, end)) {
    if (atom.type === type) {
      return atom;
    }
  }

  return null;
}

/**
 * Decode a trkn/disk binary payload: 0, [16-bit ?], index BE16, total BE16.
 */
function decodeTrackDiscPayload(bytes) {
  if (bytes.length >= 6) {
    return {
      index: (bytes[2] << 8) | bytes[3],
      total: (bytes[4] << 8) | bytes[5]
    };
  }

  if (bytes.length >= 4) {
    return {
      index: (bytes[2] << 8) | bytes[3],
      total: undefined
    };
  }

  return null;
}

/**
 * Parse M4A metadata from a byte window (expected to contain the
 * complete moov atom, plus whatever surrounds it).
 *
 * Returns null when no moov/mvhd is present; `durationSeconds` is
 * exact when mvhd is readable.
 */
export function parseMp4Metadata(bytes) {
  const topLevel = walkAtoms(bytes, 0, bytes.length);

  let moov = null;

  for (const atom of topLevel) {
    if (atom.type === "moov") {
      moov = atom;
      break;
    }
  }

  if (!moov) {
    return null;
  }

  const fields = {};

  let durationSeconds;

  const mvhd = findAtom(
    bytes,
    moov.bodyStart,
    moov.bodyEnd,
    "mvhd"
  );

  if (mvhd && mvhd.bodyEnd - mvhd.bodyStart >= 24) {
    const version = bytes[mvhd.bodyStart];

    if (version === 1 && mvhd.bodyEnd - mvhd.bodyStart >= 32) {
      const timescale = readUint32BE(bytes, mvhd.bodyStart + 20);

      const high = readUint32BE(bytes, mvhd.bodyStart + 24);

      const low = readUint32BE(bytes, mvhd.bodyStart + 28);

      const duration = high * 0x100000000 + low;

      if (timescale > 0) {
        durationSeconds = duration / timescale;
      }
    } else if (version === 0) {
      const timescale = readUint32BE(bytes, mvhd.bodyStart + 12);

      const duration = readUint32BE(bytes, mvhd.bodyStart + 16);

      if (timescale > 0) {
        durationSeconds = duration / timescale;
      }
    }
  }

  const udta = findAtom(
    bytes,
    moov.bodyStart,
    moov.bodyEnd,
    "udta"
  );

  if (udta) {
    /* The meta atom carries a 4-byte version/flags prefix. */
    const meta = findAtom(
      bytes,
      udta.bodyStart,
      udta.bodyEnd,
      "meta"
    );

    if (meta && meta.bodyEnd >= meta.bodyStart + 4) {
      const ilst = findAtom(
        bytes,
        meta.bodyStart + 4,
        meta.bodyEnd,
        "ilst"
      );

      if (ilst) {
        for (const entry of walkAtoms(bytes, ilst.bodyStart, ilst.bodyEnd)) {
          const field = ILIST_FIELD_MAP[entry.type];

          if (!field) {
            continue;
          }

          const data = decodeIlistData(
            bytes,
            entry.bodyStart,
            entry.bodyEnd
          );

          if (!data) {
            continue;
          }

          if (
            field === "track" ||
            field === "disc"
          ) {
            if (data.kind !== "binary") {
              continue;
            }

            const pair = decodeTrackDiscPayload(data.bytes);

            if (!pair) {
              continue;
            }

            if (field === "track") {
              fields.trackNumber = pair.index;

              if (pair.total !== undefined) {
                fields.trackTotal = pair.total;
              }
            } else {
              fields.discNumber = pair.index;

              if (pair.total !== undefined) {
                fields.discTotal = pair.total;
              }
            }

            continue;
          }

          if (field === "genreIndex") {
            if (
              data.kind === "number" &&
              data.value >= 1 &&
              data.value <= 80
            ) {
              const genre = normalizeGenre(String(data.value - 1));

              if (genre.length > 0) {
                fields.genre = genre;
              }
            }

            continue;
          }

          if (data.kind === "text") {
            const text = data.text.trim();

            if (text.length === 0) {
              continue;
            }

            if (field === "genre") {
              const genre = normalizeGenre(text);

              if (genre.length > 0) {
                fields.genre = genre;
              }

              continue;
            }

            if (field === "year") {
              const year = text.match(/(\d{4})/);

              if (year) {
                fields.year = year[1];
              }

              continue;
            }

            fields[field] = text;
          }
        }
      }
    }
  }

  if (
    durationSeconds === undefined &&
    Object.keys(fields).length === 0
  ) {
    return null;
  }

  return {
    fields,
    durationSeconds
  };
}

/**
 * Quick check whether a byte window starts like an MP4 file
 * ("ftyp" atom) — used by the extractor to pick a parser.
 */
export function looksLikeMp4(bytes) {
  return (
    bytes.length >= 8 && startsWithAscii(bytes.subarray(4, 8), "ftyp")
  );
}
