/*
 * lib/sceneIds.ts — the canonical world-shell scene vocabulary.
 *
 * Shared by LivingShell, SceneUrlSync, SceneRegistry, ScenePreloader
 * and the navigation layer so the scene id type, the ordered id list
 * and the legacy hash aliases live in ONE neutral module (no
 * component-to-component import cycles).
 *
 * v4.0.1: the "about" scene id is gone — /about/ is the canonical
 * About document and no navigation surface links to an #about hash;
 * a stale "#about" hash now resolves through the safe fallback
 * ("home") exactly like any other unrecognised hash. v4.0.0: the
 * former "library" scene id is "media"; "#library" links keep
 * working through SCENE_ID_ALIASES and the address bar is
 * normalised to the canonical form after resolution.
 */

export type SceneId =
  | "home"
  | "systems"
  | "magic"
  | "work"
  | "media";

/*
 * The canonical scene ids in shell order. Consumers that need the
 * full vocabulary (hash validation, preload order, status readouts)
 * derive it from this list instead of re-declaring it.
 */
export const SCENE_IDS: readonly SceneId[] = [
  "home",
  "systems",
  "magic",
  "work",
  "media"
];

/*
 * BACKWARD-COMPATIBLE HASH ALIASES (v4.0.0) — deliberate
 * compatibility layer: hashes published before the Media migration
 * must keep resolving. Each alias maps to exactly one canonical
 * scene id, and only SceneUrlSync (the single hash parser) consults
 * this map.
 */
export const SCENE_ID_ALIASES: Readonly<
  Record<string, SceneId>
> = {
  library: "media"
};
