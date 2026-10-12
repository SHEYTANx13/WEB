/*
 * tests/global-cursor.test.ts — the v4.0.5 GLOBAL CURSOR contract,
 * pinned at the source level.
 *
 * Root cause this test makes impossible to regress: the red cursor
 * used to mount inside LivingShell (and, separately, in the blog
 * layout), so every ContentShell document route — /about/,
 * /contact/, /work/, /research/, the topic hubs — never received the
 * html.red-cursor-enabled class and fell back to the native pointer.
 * The fix is a PLACEMENT fix, not a cursor rewrite: the ONE cursor
 * implementation mounts exactly once, from the ROOT layout, the same
 * root-layout law as the global Music player and RouteProgress.
 *
 * These tests assert ARCHITECTURE (who owns the mount, how many
 * implementations exist, which fallback contracts the component
 * preserves), never CSS pixel values or colors.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { readdir, readFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function readText(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

async function collectTsxFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTsxFiles(full, base)));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }

  return files;
}

/* ------------------------------------------------------------------ */
/* 1. Ownership: exactly one mount, from the root layout               */
/* ------------------------------------------------------------------ */

describe("the red cursor is one root-level global system", () => {
  it("app/layout.tsx owns the one RedCursor mount", async () => {
    const layout = await readText("app/layout.tsx");

    assert.match(
      layout,
      /import RedCursor from "@\/components\/RedCursor"/,
      "the root layout imports the cursor component"
    );

    assert.match(layout, /<RedCursor \/>/);

    assert.equal(
      (layout.match(/<RedCursor \/>/g) ?? []).length,
      1,
      "exactly ONE cursor mount, site-wide"
    );
  });

  it("LivingShell no longer mounts RedCursor", async () => {
    const shell = await readText("components/LivingShell.tsx");

    assert.doesNotMatch(
      shell,
      /RedCursor/,
      "the world shell renders only on \"/\" — a cursor mount here starves every document route"
    );
  });

  it("no route-level layout mounts RedCursor (blog included)", async () => {
    const blogLayout = await readText("app/blog/layout.tsx");

    assert.doesNotMatch(
      blogLayout,
      /RedCursor/,
      "the blog keeps no cursor mount of its own — the root layout owns the one mount"
    );
  });

  it("the root-layout mount follows the same law as the other global hosts", async () => {
    const layout = await readText("app/layout.tsx");

    /* The three root-level systems render together in the body. */
    const host = layout.indexOf("<GlobalMusicPlayerHost />");
    const progress = layout.indexOf("<RouteProgress />");
    const cursor = layout.indexOf("<RedCursor />");

    assert.ok(host > -1, "the player host is root-mounted");
    assert.ok(progress > -1, "route progress is root-mounted");
    assert.ok(cursor > -1, "the cursor is root-mounted");
    assert.ok(
      host < progress && progress < cursor,
      "the cursor mounts alongside the other root-level global systems"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. Exactly one implementation                                       */
/* ------------------------------------------------------------------ */

describe("exactly one cursor implementation exists", () => {
  it("components/RedCursor.tsx is the only cursor implementation in the tree", async () => {
    const files = await collectTsxFiles(path.join(ROOT, "components"));

    const implementers: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");

      if (/RED_CURSOR_CSS|export default function RedCursor/.test(source)) {
        implementers.push(path.relative(ROOT, file));
      }
    }

    assert.deepEqual(
      implementers,
      [path.join("components", "RedCursor.tsx")],
      "one implementation, one name, no duplicates"
    );
  });

  it("the red-cursor-enabled class literal lives only in the cursor component", async () => {
    const files = await collectTsxFiles(path.join(ROOT, "app"));

    files.push(...(await collectTsxFiles(path.join(ROOT, "components"))));
    files.push(...(await collectTsxFiles(path.join(ROOT, "lib"))));

    const holders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");

      if (source.includes("red-cursor-enabled")) {
        holders.push(path.relative(ROOT, file));
      }
    }

    assert.deepEqual(
      holders,
      [path.join("components", "RedCursor.tsx")],
      "no second cursor implementation may sneak the class literal back in"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3. The implementation contract is preserved                         */
/* ------------------------------------------------------------------ */

describe("the cursor implementation keeps its native-CSS performance contract", () => {
  it("the component is unchanged in kind: native CSS cursor, class on <html>", async () => {
    const cursor = await readText("components/RedCursor.tsx");

    assert.match(cursor, /html\.red-cursor-enabled/);
    assert.match(cursor, /classList\.add\(\s*"red-cursor-enabled"/);
    assert.match(cursor, /cursor:\s*url\(/, "the native CSS cursor approach");
  });

  it("zero pointer listeners, zero rAF, zero React state, zero moving DOM", async () => {
    const cursor = await readText("components/RedCursor.tsx");

    /*
     * Call-shaped patterns: the component's own documentation comment
     * names the banned APIs ("zero requestAnimationFrame loops"), so
     * the assertions must match real API USAGE, not the words.
     */
    assert.doesNotMatch(
      cursor,
      /addEventListener\s*\(/,
      "no event listeners of any kind"
    );

    assert.doesNotMatch(
      cursor,
      /requestAnimationFrame\s*\(/,
      "no rAF loops"
    );

    assert.doesNotMatch(
      cursor,
      /\buseState\b|\buseRef\b|\buseMemo\b/,
      "no React state machinery"
    );

    assert.doesNotMatch(
      cursor,
      /onMouseMove|onPointerMove/,
      "no pointer-following React handlers"
    );
  });

  it("coarse/touch and reduced-motion fallbacks are preserved", async () => {
    const cursor = await readText("components/RedCursor.tsx");

    assert.match(
      cursor,
      /\(hover: none\), \(pointer: coarse\)/,
      "touch devices keep the native pointer"
    );

    assert.match(
      cursor,
      /prefers-reduced-motion: reduce/,
      "reduced-motion users keep the native pointer"
    );
  });

  it("the pdf-reader-active escape hatch is preserved", async () => {
    const cursor = await readText("components/RedCursor.tsx");

    assert.match(
      cursor,
      /html\.pdf-reader-active/,
      "embedded PDF viewers keep their own cursor behavior"
    );
  });
});
