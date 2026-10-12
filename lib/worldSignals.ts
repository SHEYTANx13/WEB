/*
 * WORLD SIGNALS — tiny shared runtime state for the living background.
 *
 * A module-level store (NOT React state, NOT a state library) that
 * carries the organism's shared sense of "now" between the shell and
 * the global WorldBackground:
 *
 * - active scene (mood)
 * - latest pointer position (raw, coalesced by the receiver)
 * - click ripples
 * - scene-transition pulses
 * - page visibility
 * - interactive-organism arousal (Runtime v2 coordination)
 *
 * Why a module: LivingShell already re-renders on scene change, but
 * feeding every pointer movement through React state would re-render
 * the whole shell per event. The organism instead reads these signals
 * through one subscription inside WorldBackground and expresses them
 * as CSS variables on its own subtree — zero React renders, zero
 * component-wide churn.
 *
 * Footprint: a handful of numbers, one listener set, no history, no
 * timers of its own. Bounded by design.
 */

import type {
  SceneId
} from "@/lib/sceneIds";

/*
 * The mood vocabulary is the world-shell scene vocabulary plus the
 * one static mood used outside the shell (the blog renders as
 * "archive"). Derived from lib/sceneIds.ts so the two can never
 * drift apart (v4.0.1).
 */
export type WorldSceneMood =
  | SceneId
  | "archive";

export type WorldEvent =
  | "scene"
  | "pulse"
  | "click"
  | "visibility";

type WorldListener = (event: WorldEvent) => void;

const listeners =
  new Set<WorldListener>();

const state = {
  scene: "home" as WorldSceneMood,

  pointerX: 0,
  pointerY: 0,

  clickX: 0,
  clickY: 0,

  hidden: false,

  /*
   * Monotonic tokens — the receiver compares against its last seen
   * value to detect fresh events without any allocation.
   */
  pulseToken: 0,
  clickToken: 0,

  /*
   * RUNTIME V2 — SHARED VISUAL/PERFORMANCE BUDGET.
   *
   * The RedMagic canvas organism (high-detail, interactive) publishes
   * its arousal 0..1 here; the WorldBackground (low-cost ambient
   * organism) reads it so the two layers never double-spend the same
   * pointer energy: when the interactive organism is already visibly
   * responding, the ambient layer backs off its own gain and skips
   * duplicate ripples. One conceptual budget, two layers.
   */
  organismActivity: 0
};

function publish(event: WorldEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

export function getWorldScene(): WorldSceneMood {
  return state.scene;
}

export function getWorldPointer(): { x: number; y: number } {
  return { x: state.pointerX, y: state.pointerY };
}

export function getWorldClick(): { x: number; y: number; token: number } {
  return {
    x: state.clickX,
    y: state.clickY,
    token: state.clickToken
  };
}

export function getPulseToken(): number {
  return state.pulseToken;
}

export function isWorldHidden(): boolean {
  return state.hidden;
}

/**
 * Runtime v2 coordination: the interactive organism's arousal (0..1).
 * Published by RedMagic (throttled, a plain field write) and read by
 * WorldBackground's own loop — no listeners fire, no allocation.
 */
export function getOrganismActivity(): number {
  return state.organismActivity;
}

export function noteOrganismActivity(level: number) {
  const clamped = level < 0 ? 0 : level > 1 ? 1 : level;

  if (state.organismActivity === clamped) {
    return;
  }

  state.organismActivity = clamped;
}

export function setWorldScene(scene: WorldSceneMood) {
  if (state.scene === scene) {
    return;
  }

  state.scene = scene;

  publish("scene");
}

/*
 * Coordinated organism pulse — fired on scene transitions. The
 * receiver plays one cheap compositor animation and settles back.
 */
export function pulseWorld() {
  state.pulseToken += 1;

  publish("pulse");
}

export function noteWorldPointerMove(x: number, y: number) {
  state.pointerX = x;
  state.pointerY = y;
}

export function noteWorldClick(x: number, y: number) {
  state.clickX = x;
  state.clickY = y;
  state.clickToken += 1;

  publish("click");
}

export function noteWorldVisibility(hidden: boolean) {
  if (state.hidden === hidden) {
    return;
  }

  state.hidden = hidden;

  publish("visibility");
}

export function subscribeWorld(listener: WorldListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
