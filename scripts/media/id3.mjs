/*
 * id3.mjs — ID3v2 tag parser (v2.2 / v2.3 / v2.4) for MP3 tracks.
 *
 * Build-time only: the sync script (scripts/sync-media-manifest.mjs)
 * feeds it the first bytes of the audio file obtained through HTTP
 * range requests; the browser never parses audio metadata.
 *
 * Extracted fields (the Media Music contract):
 *   title, artist, album, albumArtist, year, genre,
 *   trackNumber, trackTotal, discNumber, discTotal,
 *   composer, comment
 *
 * Embedded artwork (APIC/PIC) is intentionally ignored — cover art
 * resolves through deterministic FILE paths (scripts/media/covers.mjs),
 * never through binary payloads inside the audio.
 */

import {
  readSyncSafeUint32BE,
  readUint32BE,
  decodeId3Text,
  splitNullSeparated,
  normalizeGenre,
  parseSlashPair
} from "./bytes.mjs";

const TEXT_FIELD_MAP_V3 = {
  TIT2: "title",
  TPE1: "artist",
  TALB: "album",
  TPE2: "albumArtist",
  TCON: "genre",
  TCOM: "composer",
  TDRV: "date",
  TDRC: "date",
  TYER: "year",
  TRCK: "track",
  TPOS: "disc"
};

const TEXT_FIELD_MAP_V2 = {
  TT2: "title",
  TP1: "artist",
  TAL: "album",
  TP2: "albumArtist",
  TCO: "genre",
  TCM: "composer",
  TYE: "year",
  TRK: "track",
  TPA: "disc"
};

/**
 * Remove ID3 "unsynchronisation" (0xFF 0x00 → 0xFF) in place over a
 * subarray. Returns a possibly shorter view of the buffer.
 */
function removeUnsynchronisation(
  bytes,
  start,
  end
) {
  const output = new Uint8Array(end - start);

  let read = start;

  let write = 0;

  while (read < end) {
    const byte = bytes[read];

    output[write] = byte;

    write += 1;
    read += 1;

    if (
      byte === 0xff &&
      read < end &&
      bytes[read] === 0x00
    ) {
      read += 1;
    }
  }

  return output.subarray(0, write);
}

/**
 * Read one null-terminated string of `charSize` bytes
 * (1 = eight-bit characters, 2 = UTF-16 units) starting at offset.
 * Returns { value, end } where `end` points PAST the terminator.
 */
function readNullTerminated(
  bytes,
  offset,
  charSize
) {
  let cursor = offset;

  while (cursor + charSize <= bytes.length) {
    const isTerminator =
      bytes[cursor] === 0x00 &&
      (charSize === 1 || bytes[cursor + 1] === 0x00);

    if (isTerminator) {
      return {
        value: bytes.subarray(offset, cursor),
        end: cursor + charSize
      };
    }

    cursor += charSize;
  }

  return {
    value: bytes.subarray(offset, bytes.length),
    end: bytes.length
  };
}

/**
 * Decode a text frame body: [encoding byte][text…].
 */
function decodeTextFrame(body) {
  if (body.length === 0) {
    return "";
  }

  const encoding = body[0];

  const { value } = readNullTerminated(
    body,
    1,
    encoding === 1 || encoding === 2 ? 2 : 1
  );

  return decodeId3Text(value, encoding);
}

/**
 * Decode a COMM (comment) frame body:
 * [encoding][language(3)][short description, terminated][text].
 */
function decodeCommentFrame(body) {
  if (body.length < 4) {
    return "";
  }

  const encoding = body[0];

  const charSize =
    encoding === 1 || encoding === 2 ? 2 : 1;

  const { end } = readNullTerminated(
    body,
    4,
    charSize
  );

  const text = readNullTerminated(
    body,
    end,
    charSize
  );

  return decodeId3Text(text.value, encoding);
}

/**
 * Apply a parsed text value to the tag accumulator, mapping
 * track/disc "n/total" pairs into numeric fields.
 */
function applyTextField(
  fields,
  field,
  rawValue
) {
  const values = splitNullSeparated(rawValue);

  if (values.length === 0) {
    return;
  }

  const value = values[0];

  if (field === "genre") {
    const genre = normalizeGenre(value);

    if (genre.length > 0) {
      fields.genre = genre;
    }

    return;
  }

  if (field === "track" || field === "disc") {
    const pair = parseSlashPair(value);

    if (!pair) {
      return;
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

    return;
  }

  if (field === "date" || field === "year") {
    /* Prefer the first four-digit year found in the value. */
    const year = value.match(/(\d{4})/);

    if (year) {
      fields.year = year[1];
    }

    return;
  }

  if (value.length > 0) {
    fields[field] = value;
  }
}

/**
 * Parse one v2.3/v2.4 frame at `offset` (body of a validated tag).
 * Returns { id, size, headerSize, next } or null when the frame
 * cannot be read (padding/corruption) — the caller stops cleanly.
 */
function readFrameV3OrV4(
  bytes,
  offset,
  version
) {
  if (offset + 10 > bytes.length) {
    return null;
  }

  const id = String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );

  if (!/^[A-Z0-9]{4}$/.test(id)) {
    return null;
  }

  const rawSize = readUint32BE(bytes, offset + 4);

  const size =
    version === 4
      ? readSyncSafeUint32BE(bytes, offset + 4)
      : rawSize;

  const flags = (bytes[offset + 8] << 8) | bytes[offset + 9];

  if (size <= 0 || offset + 10 + size > bytes.length) {
    return null;
  }

  let body = bytes.subarray(
    offset + 10,
    offset + 10 + size
  );

  /*
   * v2.4 per-frame unsynchronisation (format flag 0x02, the second
   * flag byte's bit 1) applies only to frames that are not
   * encrypted/compressed; handle the common case.
   */
  if (
    version === 4 &&
    (flags & 0x0002) !== 0
  ) {
    body = removeUnsynchronisation(
      body,
      0,
      body.length
    );
  }

  return {
    id,
    size,
    headerSize: 10,
    body,
    next: offset + 10 + size
  };
}

/**
 * Parse one v2.2 frame (3-byte id, 3-byte size, no flags).
 */
function readFrameV2(
  bytes,
  offset
) {
  if (offset + 6 > bytes.length) {
    return null;
  }

  const id = String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2]
  );

  if (!/^[A-Z0-9]{3}$/.test(id)) {
    return null;
  }

  const size =
    (bytes[offset + 3] << 16) |
    (bytes[offset + 4] << 8) |
    bytes[offset + 5];

  if (size <= 0 || offset + 6 + size > bytes.length) {
    return null;
  }

  return {
    id,
    size,
    headerSize: 6,
    body: bytes.subarray(
      offset + 6,
      offset + 6 + size
    ),
    next: offset + 6 + size
  };
}

/**
 * Parse an ID3v2 tag from the start of `bytes`.
 *
 * Returns null when the buffer does not carry an ID3v2 header, or a
 * `complete` result with the extracted fields. `tagBytes` reports how
 * many bytes the tag occupies (the first MPEG frame follows it) and
 * `requiresBytes` the minimum head window needed to parse fully.
 */
export function parseId3v2(bytes) {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return null;
  }

  const version = bytes[3];

  const flags = bytes[5];

  const tagSize = readSyncSafeUint32BE(bytes, 6);

  const tagEnd = 10 + tagSize;

  if (bytes.length < tagEnd) {
    return {
      complete: false,
      requiresBytes: tagEnd,
      tagBytes: tagEnd,
      fields: {}
    };
  }

  let body = bytes.subarray(10, tagEnd);

  /* Whole-tag unsynchronisation (v2.2/v2.3 flag 0x80). */
  if ((flags & 0x80) !== 0 && version < 4) {
    body = removeUnsynchronisation(
      body,
      0,
      body.length
    );
  }

  const fields = {};

  const textFieldMap =
    version === 2 ? TEXT_FIELD_MAP_V2 : TEXT_FIELD_MAP_V3;

  let offset = 0;

  /* v2.3 extended header (non-syncsafe size, skip it). */
  if (
    version === 3 &&
    (flags & 0x40) !== 0 &&
    body.length >= 4
  ) {
    const extendedSize = readUint32BE(body, 0);

    offset += extendedSize;
  }

  /* v2.4 extended header (syncsafe size INCLUDES itself). */
  if (
    version === 4 &&
    (flags & 0x40) !== 0 &&
    body.length >= 4
  ) {
    const extendedSize = readSyncSafeUint32BE(body, 0);

    offset += extendedSize;
  }

  let truncated = false;

  while (offset < body.length) {
    /* Padding is zero bytes — a zero octet ends the frame walk. */
    if (body[offset] === 0x00) {
      break;
    }

    const frame =
      version === 2
        ? readFrameV2(body, offset)
        : readFrameV3OrV4(body, offset, version);

    if (!frame) {
      truncated = offset + (version === 2 ? 6 : 10) > body.length;

      break;
    }

    const field = textFieldMap[frame.id];

    if (frame.id === "COMM" || frame.id === "COM") {
      const comment = decodeCommentFrame(frame.body);

      if (comment.length > 0 && !fields.comment) {
        fields.comment = comment;
      }
    } else if (field) {
      applyTextField(
        fields,
        field,
        decodeTextFrame(frame.body)
      );
    }

    offset = frame.next;
  }

  return {
    complete: !truncated,
    requiresBytes: tagEnd,
    tagBytes: tagEnd,
    fields
  };
}
