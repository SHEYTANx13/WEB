/*
 * tests/player-a11y.test.ts — the accessibility contract of the
 * player markup, pinned at the source level.
 *
 * A full a11y audit needs a browser (see the v4.0.0 verification
 * notes); these checks make the structural guarantees permanent:
 * every control exposes an accessible name, sliders are native range
 * inputs with labels, states are announced, and reduced-motion is
 * honoured.
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

async function readComponent(name: string) {
  return readFile(
    path.join(ROOT, "components", "player", name),
    "utf8"
  );
}

describe("player markup contract", () => {
  it("labels every control (no icon-only buttons without a name)", async () => {
    const mini = await readComponent("MiniPlayer.tsx");
    const expanded = await readComponent("ExpandedPlayer.tsx");

    /* The transport controls: */
    assert.match(mini, /aria-label="Previous track/);
    assert.match(mini, /aria-label=\{\s*isPlaying \? "Pause" : "Play"/);
    assert.match(mini, /aria-label="Next track"/);
    assert.match(expanded, /aria-label="Next track"/);

    /* Volume, seek, expand, close, queue rows: */
    assert.match(mini, /aria-label="Volume"/);
    assert.match(mini, /aria-label="Seek"/);
    assert.match(mini, /aria-label=\{[^}]*Unmute|aria-label=\{[^}]*"Mute"/);
    assert.match(mini, /aria-label="Open expanded player and queue"/);
    assert.match(expanded, /aria-label="Close expanded player"/);
    assert.match(expanded, /aria-label=\{`Remove \$\{queued\.title\}/);
    assert.match(expanded, /aria-label=\{`Play now: \$\{queued\.title\}/);
  });

  it("uses native range inputs for slider semantics + keyboard support", async () => {
    const mini = await readComponent("MiniPlayer.tsx");
    const expanded = await readComponent("ExpandedPlayer.tsx");

    const seekInputs = (mini.match(/type="range"/g) ?? []).length;

    assert.ok(seekInputs >= 2, "seek + volume in the mini player");

    assert.match(expanded, /type="range"/);
  });

  it("announces state: seek valuetext, volume percent, alerts, queue region", async () => {
    const mini = await readComponent("MiniPlayer.tsx");
    const expanded = await readComponent("ExpandedPlayer.tsx");

    assert.match(mini, /aria-valuetext=\{formatSeekValueText/);
    assert.match(mini, /percent/);
    assert.match(mini, /role="alert"/);
    assert.match(mini, /aria-label="Music player"/);
    assert.match(expanded, /role="alert"/);
    assert.match(expanded, /aria-label="Playback queue"/);
    assert.match(expanded, /aria-label="Expanded music player"/);
    assert.match(expanded, /aria-modal="true"/);
  });

  it("exposes the pressed state for toggles (mute, repeat)", async () => {
    const mini = await readComponent("MiniPlayer.tsx");
    const expanded = await readComponent("ExpandedPlayer.tsx");

    assert.match(mini, /aria-pressed=\{state\.muted\}/);
    assert.match(expanded, /aria-pressed=\{state\.muted\}/);
    assert.match(expanded, /aria-pressed=\{state\.repeat !== "off"\}/);
  });

  it("manages the expanded dialog focus (trap, escape, restoration)", async () => {
    const expanded = await readComponent("ExpandedPlayer.tsx");

    assert.match(expanded, /event\.key === "Escape"/);
    assert.match(expanded, /event\.key !== "Tab"/);
    assert.match(expanded, /previousFocus\?\.focus\(\)/);
    assert.match(expanded, /tabIndex=\{-1\}/);
  });

  it("keeps the viewer modal dialog contract in the Media scene", async () => {
    const scene = await readFile(
      path.join(ROOT, "components", "scenes", "MediaScene.tsx"),
      "utf8"
    );

    assert.match(scene, /role="dialog"/);
    assert.match(scene, /aria-modal="true"/);
    assert.match(scene, /aria-label="Media filters"/);
    assert.match(scene, /aria-pressed=\{[^}]*active/);
    assert.match(scene, /role="status"/, "music empty state announced");
    assert.match(scene, /role="alert"/);
  });
});

describe("reduced motion + touch targets", () => {
  it("guards transitions behind prefers-reduced-motion", async () => {
    const playerCss = await readFile(
      path.join(ROOT, "components", "player", "Player.module.css"),
      "utf8"
    );

    const sceneCss = await readFile(
      path.join(ROOT, "components", "scenes", "MediaScene.module.css"),
      "utf8"
    );

    assert.match(playerCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(sceneCss, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("keeps touch targets at the 44px minimum", async () => {
    const playerCss = await readFile(
      path.join(ROOT, "components", "player", "Player.module.css"),
      "utf8"
    );

    assert.match(playerCss, /min-height: 44px/);
    assert.match(playerCss, /height: 44px/);

    const sceneCss = await readFile(
      path.join(ROOT, "components", "scenes", "MediaScene.module.css"),
      "utf8"
    );

    assert.match(sceneCss, /min-height: 44px/);
  });

  it("respects the bottom safe area on mobile", async () => {
    const playerCss = await readFile(
      path.join(ROOT, "components", "player", "Player.module.css"),
      "utf8"
    );

    assert.match(playerCss, /env\(safe-area-inset-bottom/);
  });
});

describe("player markup contract — v4.0.2 controls", () => {
  it("labels the shuffle and retry controls with names and states", async () => {
    const mini = await readComponent("MiniPlayer.tsx");
    const expanded = await readComponent("ExpandedPlayer.tsx");

    /* Shuffle: a named, pressed-state toggle on both surfaces. */
    assert.match(
      mini,
      /aria-label=\{`Shuffle\. Currently \$\{state\.shuffle \? "on" : "off"\}\.`\}/
    );

    assert.match(mini, /aria-pressed=\{state\.shuffle\}/);

    assert.match(
      expanded,
      /aria-label=\{`Shuffle\. Currently \$\{state\.shuffle \? "on" : "off"\}\.`\}/
    );

    assert.match(expanded, /aria-pressed=\{state\.shuffle\}/);

    /* Retry: named, offered only when a track exists. */
    assert.match(mini, /aria-label="Retry playback of the current track"/);

    assert.match(expanded, /aria-label="Retry playback of the current track"/);
  });

  it("marks the current track's card control with its playing state", async () => {
    const scene = await readFile(
      path.join(ROOT, "components", "scenes", "MediaScene.tsx"),
      "utf8"
    );

    assert.match(
      scene,
      /data-playing=/,
      "the card play control exposes its playing state"
    );

    assert.match(
      scene,
      /aria-label=\{[^}]*Pause|aria-label=\{[^}]*Resume/,
      "the current track's control flips to Pause/Resume semantics"
    );
  });
});
