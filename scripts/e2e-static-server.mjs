#!/usr/bin/env node
/*
 * scripts/e2e-static-server.mjs — LOCAL verification helper (not part
 * of the shipped site pipeline): serves the static export with an
 * access log so the E2E check can prove that no media request happens
 * before playback intent. Byte-range capable for audio seeking.
 */

import { createServer } from "node:http";

import { readFile, stat } from "node:fs/promises";

import path from "node:path";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("out");

const PORT = Number(process.argv[3] ?? 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  let filePath = path.join(
    ROOT,
    decodeURIComponent(url.pathname).replace(/^\/+/, "")
  );

  try {
    const info = await stat(filePath);

    if (info.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    /* fall through to read attempt */
  }

  try {
    const data = await readFile(filePath);

    const range = request.headers.range;

    const size = data.length;

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);

      const start = match?.[1] ? Number(match[1]) : 0;

      const end = match?.[2] ? Number(match[2]) : size - 1;

      response.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${size}`,
        "content-length": end - start + 1,
        "accept-ranges": "bytes",
        "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream"
      });

      response.end(data.subarray(start, end + 1));
    } else {
      response.writeHead(200, {
        "content-length": size,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
        "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream"
      });

      response.end(data);
    }

    console.log(`[server] 200 ${request.method} ${url.pathname}${range ? ` (range)` : ""}`);
  } catch {
    response.writeHead(404);

    response.end("not found");

    console.log(`[server] 404 ${request.method} ${url.pathname}`);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] serving ${ROOT} at http://127.0.0.1:${PORT}`);
});
