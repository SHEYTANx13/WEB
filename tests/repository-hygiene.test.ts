/*
 * tests/repository-hygiene.test.ts — durable repository-wide
 * contracts carried forward from v4.0.4 (the WhatsApp-free ban,
 * canonical source filenames) plus the release wiring.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { readFile, readdir } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function readText(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

/* ------------------------------------------------------------------ */
/* 1. WhatsApp-free repository (removed in v4.0.4, still enforced)     */
/* ------------------------------------------------------------------ */

const WHATSAPP_PATTERN = /whatsapp|wa\.me/i;

/*
 * The files below IMPLEMENT or DOCUMENT the WhatsApp ban — their
 * occurrences are the only legitimate ones in the tree: this test
 * and the export-level verifiers carry the detection patterns, and
 * the top-level docs record the removal factually in their
 * changelogs. Everything else (code, data, content, fixtures) must
 * be absolutely free of the channel.
 */
const CHECKER_FILES = new Set([
  path.join("tests", "repository-hygiene.test.ts"),
  path.join("tests", "footer.test.ts"),
  path.join("scripts", "verify-seo.mjs"),
  path.join("README.md"),
  path.join("ROADMAP.md"),
  path.join("AGENTS.md")
]);

const SCANNABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mjs",
  ".js",
  ".json",
  ".md",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".sh",
  ".py",
  ".svg",
  ".xml",
  ".txt"
]);

const SKIPPED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "shots"
]);

async function collectSourceFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) {
        continue;
      }

      files.push(...(await collectSourceFiles(full, base)));
    } else if (SCANNABLE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }

  return files;
}

describe("the repository is WhatsApp-free (removed in v4.0.4)", () => {
  it("no source, doc, data, or generated-data file contains a WhatsApp reference", async () => {
    const files = await collectSourceFiles(ROOT);

    const offenders: string[] = [];

    for (const file of files) {
      const relative = path.relative(ROOT, file);

      if (CHECKER_FILES.has(relative)) {
        continue;
      }

      const content = await readFile(file, "utf8");

      if (WHATSAPP_PATTERN.test(content)) {
        offenders.push(relative);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `WhatsApp remnants found (the channel was removed in v4.0.4): ${offenders.join(", ")}`
    );
  });

  it("the public-link registry carries no whatsapp icon type or entry", async () => {
    const links = await readText("lib/links.ts");
    const publicLinks = await readText("components/PublicLinks.tsx");

    assert.doesNotMatch(links, /whatsapp/i);
    assert.doesNotMatch(publicLinks, /whatsapp/i);
    assert.doesNotMatch(links, /"whatsapp"/);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Canonical source filenames                                       */
/* ------------------------------------------------------------------ */

describe("canonical source filenames (generated files are never sources)", () => {
  it("no duplicate/legacy source-name patterns exist in app/, components/, lib/, or scripts/", async () => {
    /*
     * One canonical source file per implementation: stable names, no
     * renamed copies, no AI-agent temp files. Next's own hashed build
     * chunks live in out/_next and are build output, never source.
     */
    const LEGACY_PATTERN =
      /(-final|-new|-v[0-9]+|-copy|-backup|-old|-temp|-tmp|\.bak)\.(tsx?|css|mjs|js)$/i;

    const offenders: string[] = [];

    for (const dir of ["app", "components", "lib", "scripts"]) {
      const files = await collectSourceFiles(path.join(ROOT, dir));

      for (const file of files) {
        if (LEGACY_PATTERN.test(path.basename(file))) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `legacy/duplicate source names found: ${offenders.join(", ")} — one canonical file per implementation`
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3. Release wiring                                                   */
/* ------------------------------------------------------------------ */

describe("v4.0.5 release wiring", () => {
  it("package.json declares version 4.0.5", async () => {
    const pkg = JSON.parse(await readText("package.json"));

    assert.equal(pkg.version, "4.0.5");
  });

  it("verify-seo carries the export-level WhatsApp ban and metadata census", async () => {
    const seo = await readText("scripts/verify-seo.mjs");

    for (const check of [
      "verifyNoWhatsAppRemnants",
      "verifyMetadataQuality",
      "verifyCanonicalUniqueness",
      "verifyEntityGraphIntegrity"
    ]) {
      assert.match(seo, new RegExp(`async function ${check}`));
      assert.match(seo, new RegExp(`await ${check}\\(`));
    }
  });
});
