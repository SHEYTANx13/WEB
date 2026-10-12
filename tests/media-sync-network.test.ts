/*
 * tests/media-sync-network.test.ts — end-to-end range-request
 * pipeline: extractAudioMetadata against a REAL local HTTP server
 * that implements byte ranges (like a static CDN would).
 *
 * Proves the three-step dance (probe → head window → tail window)
 * over actual sockets — the same path CI runs against jsDelivr.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { createServer } from "node:http";

// (server.address() typed via inline check — AddressInfo is a type-only export)

import { promisify } from "node:util";

import {
  buildFlac,
  buildM4a,
  buildMp3,
  buildCoverPng
} from "./fixtures/audio.mjs";

import { extractAudioMetadata } from "../scripts/media/audioMetadata.mjs";

async function withFileServer(
  files: Map<string, Uint8Array>,
  run: (base: string) => Promise<void>
) {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname
    );

    const bytes = files.get(path.replace(/^\//, ""));

    if (!bytes) {
      response.writeHead(404);

      response.end();

      return;
    }

    const range = request.headers.range;

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);

      const start = match?.[1] ? Number(match[1]) : 0;

      const end = match?.[2]
        ? Number(match[2])
        : bytes.length - 1;

      response.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${bytes.length}`,
        "content-length": end - start + 1,
        "accept-ranges": "bytes"
      });

      response.end(bytes.subarray(start, end + 1));

      return;
    }

    response.writeHead(200, {
      "content-length": bytes.length,
      "accept-ranges": "bytes"
    });

    response.end(bytes);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address();

    assert.ok(
      typeof address === "object" &&
        address !== null &&
        "port" in address,
      "server address should be an interface info object"
    );

    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await promisify(server.close.bind(server))();
  }
}

describe("range pipeline over real HTTP", () => {
  it("extracts MP3 metadata with a 2-request minimum (probe + head)", async () => {
    const mp3 = new Uint8Array(buildMp3({ seconds: 120 }));

    let requestCount = 0;

    let smallestFullFetch = Infinity;

    await withFileServer(
      new Map([["song.mp3", mp3]]),
      async (base) => {
        const result = await extractAudioMetadata({
          url: `${base}/song.mp3`,
          kind: "mp3",
          fetchRange: async (url, start, end) => {
            requestCount += 1;

            const response = await fetch(url, {
              headers: { Range: `bytes=${start}-${end}` }
            });

            const buffer = await response.arrayBuffer();

            smallestFullFetch = Math.min(
              smallestFullFetch,
              buffer.byteLength === 1
                ? Infinity
                : buffer.byteLength
            );

            return {
              status: response.status,
              arrayBuffer: buffer,
              contentRange: response.headers.get("content-range"),
              acceptRanges: response.headers.get("accept-ranges")
            };
          }
        });

        assert.equal(result.source, "embedded");
        assert.equal(result.fields.title, "Test Track");
        assert.ok(Math.abs(result.duration! - 120) <  0.5);
      }
    );

    /* Probe + head window only — never the full file. */
    assert.equal(requestCount, 2);
    assert.ok(smallestFullFetch < mp3.length);
  });

  it("reads covers through the same range server (probe semantics)", async () => {
    const cover = buildCoverPng();

    await withFileServer(
      new Map([["Album/cover.png", cover]]),
      async (base) => {
        const response = await fetch(
          `${base}/Album/cover.png`,
          { headers: { Range: "bytes=0-0" } }
        );

        assert.equal(response.status, 206);
        assert.match(
          response.headers.get("content-range") ?? "",
          new RegExp(`/${cover.length}$`)
        );
      }
    );
  });

  it("extracts M4A metadata from the head window over HTTP", async () => {
    const m4a = new Uint8Array(buildM4a({ seconds: 42 }));

    await withFileServer(
      new Map([["song.m4a", m4a]]),
      async (base) => {
        const result = await extractAudioMetadata({
          url: `${base}/song.m4a`,
          kind: "m4a",
          fetchRange: async (url, start, end) => {
            const response = await fetch(url, {
              headers: { Range: `bytes=${start}-${end}` }
            });

            return {
              status: response.status,
              arrayBuffer: await response.arrayBuffer(),
              contentRange: response.headers.get("content-range"),
              acceptRanges: response.headers.get("accept-ranges")
            };
          }
        });

        assert.equal(result.source, "embedded");
        assert.equal(result.fields.title, "M4A Track");
        assert.ok(Math.abs(result.duration! - 42) <  0.001);
      }
    );
  });

  it("extracts FLAC metadata over HTTP", async () => {
    const flac = new Uint8Array(buildFlac({ seconds: 5 }));

    await withFileServer(
      new Map([["song.flac", flac]]),
      async (base) => {
        const result = await extractAudioMetadata({
          url: `${base}/song.flac`,
          kind: "flac",
          fetchRange: async (url, start, end) => {
            const response = await fetch(url, {
              headers: { Range: `bytes=${start}-${end}` }
            });

            return {
              status: response.status,
              arrayBuffer: await response.arrayBuffer(),
              contentRange: response.headers.get("content-range"),
              acceptRanges: response.headers.get("accept-ranges")
            };
          }
        });

        assert.equal(result.source, "embedded");
        assert.equal(result.fields.genre, "Classical");
        assert.ok(Math.abs(result.duration! - 5) <  0.001);
      }
    );
  });
});
