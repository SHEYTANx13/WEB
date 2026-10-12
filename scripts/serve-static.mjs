#!/usr/bin/env node
/*
 * scripts/serve-static.mjs — the production preview for the static
 * export (v4.0.1).
 *
 * `next start` is NOT the right preview for output: "export" — there
 * is no server runtime, only the generated out/ tree. This script
 * serves that tree with plain node:http (zero dependencies, matching
 * the GitHub Pages contract):
 *
 *   - directories resolve to their index.html;
 *   - unknown paths serve out/404.html with a real 404 status, the
 *     same way GitHub Pages serves the custom error page;
 *   - byte-range requests are honoured (audio/PDF seeking parity);
 *   - ./public-style MIME types, no cache headers beyond the
 *     essentials, and a quiet one-line startup log.
 *
 * Usage:  npm start          (serves out/ at http://localhost:3000)
 *         node scripts/serve-static.mjs [root] [port]
 */

import { createServer } from "node:http";

import { readFile, stat } from "node:fs/promises";

import path from "node:path";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("out");

const PORT = Number(process.argv[3] ?? process.env.PORT ?? 3000);

const HOST = process.env.HOST ?? "0.0.0.0";

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

function resolveTarget(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");

  if (clean === "") {
    return path.join(ROOT, "index.html");
  }

  const target = path.join(ROOT, clean);

  /* Containment: the resolved path must stay inside the export. */
  if (!target.startsWith(ROOT + path.sep)) {
    return null;
  }

  return target;
}

async function tryIndex(target) {
  try {
    const info = await stat(target);

    if (info.isDirectory()) {
      return path.join(target, "index.html");
    }
  } catch {
    /* not found or not a directory — fall through */
  }

  return target;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  let target = resolveTarget(url.pathname);

  if (target === null) {
    response.writeHead(403).end("forbidden");

    return;
  }

  target = await tryIndex(target);

  let data = null;

  try {
    data = await readFile(target);
  } catch {
    /* fall through to the 404 document */
  }

  if (data === null) {
    try {
      const notFound = await readFile(
        path.join(ROOT, "404.html")
      );

      response.writeHead(404, {
        "content-type": MIME[".html"],
        "content-length": notFound.length
      });

      response.end(notFound);
    } catch {
      response.writeHead(404).end("not found");
    }

    return;
  }

  const contentType =
    MIME[path.extname(target)] ?? "application/octet-stream";

  const range = request.headers.range;

  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);

    const size = data.length;

    const start = match?.[1] ? Number(match[1]) : 0;

    const end = match?.[2] ? Number(match[2]) : size - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start >= size
    ) {
      response.writeHead(416, {
        "content-range": `bytes */${size}`
      });

      response.end();

      return;
    }

    response.writeHead(206, {
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": end - start + 1,
      "accept-ranges": "bytes",
      "content-type": contentType
    });

    response.end(data.subarray(start, end + 1));

    return;
  }

  response.writeHead(200, {
    "content-length": data.length,
    "accept-ranges": "bytes",
    "content-type": contentType
  });

  response.end(data);
});

server.listen(PORT, HOST, () => {
  console.log(
    `[serve-static] serving ${ROOT} at http://${
      HOST === "0.0.0.0" ? "localhost" : HOST
    }:${PORT}`
  );
});
