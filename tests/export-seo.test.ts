/*
 * tests/export-seo.test.ts — Library → Media migration invariants in
 * the shipped repository: scene registry, navigation, data files,
 * blog content links, and the "no fabricated music" law.
 *
 * These are the same facts `verify-seo.mjs` and
 * `verify-export-routes.mjs` enforce on the built export, pinned at
 * the source level for fast feedback.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function readJson(relative: string) {
  return JSON.parse(
    await readFile(path.join(ROOT, relative), "utf8")
  );
}

async function readText(relative: string) {
  return readFile(path.join(ROOT, relative), "utf8");
}

describe("scene registry (data/routes.json)", () => {
  it("declares media as the canonical sixth scene", async () => {
    const routes = await readJson("data/routes.json");

    assert.ok(routes.scenes.names.includes("media"));
    assert.ok(!routes.scenes.names.includes("library"));
  });

  it("no route document ever referenced a #library canonical anchor", async () => {
    /* Hash scenes are interaction states, never documents. */
    const routes = await readJson("data/routes.json");

    for (const route of routes.routes) {
      assert.ok(!route.path.includes("library"));
    }
  });
});

describe("navigation vocabulary", () => {
  it("carries MEDIA in the world navigation (no LIBRARY entries)", async () => {
    const navigation = await readText("lib/navigation.ts");

    assert.match(navigation, /shortLabel: "MEDIA"/);
    assert.match(navigation, /href: "\/#media"/);
    assert.doesNotMatch(navigation, /shortLabel: "LIBRARY"/);
  });

  it("keeps #library only as the documented alias", async () => {
    const sceneIds = await readText("lib/sceneIds.ts");

    assert.match(sceneIds, /library: "media"/);
  });

  it("shell registries reference the media scene chunk", async () => {
    const preloader = await readText("components/ScenePreloader.tsx");
    const registry = await readText("components/SceneRegistry.tsx");

    assert.match(preloader, /@\/components\/scenes\/MediaScene/);
    assert.doesNotMatch(preloader, /LibraryScene/);

    assert.match(registry, /media: MediaScene/);
    assert.doesNotMatch(registry, /LibraryScene/);
  });
});

describe("data files", () => {
  it("data/media.json exists as version 4 (explicit sourceType) and data/library.json is gone", async () => {
    const manifest = await readJson("data/media.json");

    assert.equal(manifest.version, 4);

    assert.ok(Array.isArray(manifest.items));

    /* v4.0.2: every item carries the explicit source discriminator
     * (the sync pipeline always writes it; the runtime never infers
     * source kinds from URL strings). */
    for (const item of manifest.items as { sourceType?: string }[]) {
      assert.ok(
        item.sourceType === "contents" || item.sourceType === "direct",
        "every committed item declares an explicit sourceType"
      );
    }

    await assert.rejects(
      () => readJson("data/library.json"),
      /ENOENT/
    );
  });

  it("the committed manifest contains zero music tracks (empty Music source)", async () => {
    const manifest = await readJson("data/media.json");

    const music = manifest.items.filter(
      (item: { type?: string }) =>
        item.type === "music" || item.type === "audio"
    );

    assert.equal(
      music.length,
      0,
      "no Music source exists yet — the manifest must not fabricate tracks"
    );
  });

  it("the old content repository module is gone", async () => {
    await assert.rejects(
      () => readText("lib/contentRepository.ts"),
      /ENOENT/
    );
  });
});

describe("blog content links", () => {
  it("article sources never point at a dead #library scene", async () => {
    const { readdir } = await import("node:fs/promises");

    const dir = path.join(ROOT, "content", "blog");

    const files = (await readdir(dir)).filter((name) =>
      name.endsWith(".md")
    );

    assert.ok(files.length > 0);

    for (const file of files) {
      const text = await readFile(path.join(dir, file), "utf8");

      const libraryLinks = text.match(/\]\(\/#library\)/g) ?? [];

      assert.equal(
        libraryLinks.length,
        0,
        `${file} still links /#library — use /#media`
      );
    }
  });
});

describe("the no-fake-content law", () => {
  it("public assets ship no fabricated audio", async () => {
    const { readdir } = await import("node:fs/promises");

    const publicDir = path.join(ROOT, "public");

    const entries = await readdir(publicDir, {
      recursive: true
    });

    const audio = entries.filter((entry) =>
      /\.(mp3|m4a|flac)$/i.test(entry)
    );

    assert.deepEqual(
      audio,
      [],
      "the static export must not ship audio the manifest does not declare"
    );
  });
});
