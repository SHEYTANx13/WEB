#!/usr/bin/env node
/*
 * Static export analyzer — per-route facts:
 * HTML bytes, initial JS set (count + transfer), RSC payload sizes,
 * CSS files, images referenced. Read-only; exits 1 if out/ missing.
 */
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] ?? path.resolve(process.root ?? process.cwd(), "out");
const ROOT = path.resolve(OUT, "..");

if (!fs.existsSync(path.join(OUT, "index.html"))) {
  console.error("no export at " + OUT);
  process.exit(1);
}

function listRoutes(dir, prefix = "") {
  const routes = [];
  if (fs.existsSync(path.join(dir, "index.html"))) {
    routes.push(prefix === "" ? "/" : `${prefix}/`);
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith("_") && e.name !== "media") {
      routes.push(...listRoutes(path.join(dir, e.name), `${prefix}/${e.name}`));
    }
  }
  return routes;
}

const routes = listRoutes(OUT);
const chunksDir = path.join(OUT, "_next", "static", "chunks");

function sizeOf(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

console.log("route".padEnd(34), "html".padStart(8), "initJS".padStart(9), "jsFiles".padStart(8), "rscBytes".padStart(9), "rscFiles".padStart(9), "css".padStart(8));

const summary = [];
for (const route of routes) {
  const file = path.join(OUT, route, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const htmlBytes = Buffer.byteLength(html);

  const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))]
    .filter((s) => s.endsWith(".js"));
  let jsBytes = 0;
  const jsFiles = [];
  for (const s of scripts) {
    const name = s.split("/").pop();
    const local = path.join(chunksDir, name);
    const b = sizeOf(local);
    jsBytes += b;
    jsFiles.push({ name, b });
  }

  const cssLinks = [...new Set([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]))];
  let cssBytes = 0;
  for (const c of cssLinks) {
    cssBytes += sizeOf(path.join(OUT, c.replace(/^\//, "").replace(/^WEB\//, "")));
  }

  // RSC payloads: files directly in the route's own directory
  let rscBytes = 0, rscFiles = 0;
  for (const e of fs.readdirSync(path.join(OUT, route), { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith(".txt") && e.name !== "robots.txt") {
      rscBytes += sizeOf(path.join(OUT, route, e.name));
      rscFiles++;
    }
  }

  summary.push({ route, htmlBytes, jsBytes, jsCount: scripts.length, rscBytes, rscFiles, cssBytes, jsFiles });
  console.log(route.padEnd(34), String(htmlBytes).padStart(8), String(jsBytes).padStart(9), String(scripts.length).padStart(8), String(rscBytes).padStart(9), String(rscFiles).padStart(9), String(cssBytes).padStart(8));
}

// largest initial assets overall
const all = new Map();
for (const s of summary) for (const f of s.jsFiles) all.set(f.name, Math.max(all.get(f.name) ?? 0, f.b));
const sorted = [...all.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log("\nlargest initial JS assets (bytes):");
for (const [name, b] of sorted) console.log(" ", name.padEnd(42), String(b).padStart(8));

// biggest html routes
console.log("\nlargest HTML routes:");
for (const s of [...summary].sort((a, b) => b.htmlBytes - a.htmlBytes).slice(0, 6))
  console.log(" ", s.route.padEnd(34), String(s.htmlBytes).padStart(8));
