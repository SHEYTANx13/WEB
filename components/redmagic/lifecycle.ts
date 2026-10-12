/*
 * redmagic/lifecycle.ts — engine mount, event wiring, observers and
 * teardown (v4.0.1).
 *
 * Mechanically extracted from the engine closure in
 * components/RedMagic.tsx: mountRedMagicEngine performs exactly the
 * setup sequence the old useEffect did (context acquisition, media
 * query, state creation, listener/observer registration, initial
 * world build, resize, reduced-motion handling, start) and returns
 * the same cleanup function. The per-function bodies are unchanged;
 * the shared mutable state arrives as the single EngineState object
 * and sibling engine functions are reached through the late-bound
 * Engine object.
 */

import {
  createEngineState,
  createNucleusGradient,
  type EngineState,
  type Engine
} from "@/components/redmagic/engineState";

import { createSimulationModule } from "@/components/redmagic/simulation";

import { createRenderModule } from "@/components/redmagic/render";

import { createInputModule } from "@/components/redmagic/input";

import {
  resolveAdaptiveDpr,
  dprCeilingFor,
  suspendRefreshWindow
} from "@/components/redmagic/engineConfig";

import {
  qualityFromArea
} from "@/components/redmagic/engineWorld";

import {
  RED_MAGIC_INTERACTION_EVENT
} from "@/components/RedMagicInteraction";

import {
  placeParticles
} from "@/components/RedMagicParticles";

function createLifecycleModule(
  state: EngineState,
  engine: Engine
): Pick<
  Engine,
  | "applyBackingStore"
  | "applyDpr"
  | "resize"
  | "handleMotionChange"
  | "handleIntersection"
  | "handleVisibility"
  | "start"
  | "stop"
> {
/*
 * BACKING STORE (v2.1) — the single bitmap-write path: canvas
 * dimensions from the CURRENT width/height/dpr triple plus the
 * matching transform. resize() calls it unconditionally on a real
 * geometry change (width/height may change while dpr does not —
 * e.g. a 1× display — and the store must still be rewritten);
 * applyDpr() calls it on a pure resolution switch.
 */
const applyBackingStore =
  () => {
    state.canvas.width =
      Math.floor(
        state.width *
          state.dpr
      );

    state.canvas.height =
      Math.floor(
        state.height *
          state.dpr
      );

    state.context.setTransform(
      state.dpr,
      0,
      0,
      state.dpr,
      0,
      0
    );
  };

/*
 * APPLY DPR (v2.1) — a PURE resolution switch (no CSS geometry
 * change): new bitmap through applyBackingStore, no world rebuild
 * needed (particles and grid nodes live in CSS pixel space; the
 * membrane gradient's user-space coordinates resolve under the
 * CTM at fill time). The measurement reset stops the sampler from
 * judging the new resolution with the old window's numbers.
 */
const applyDpr =
  (nextDpr: number) => {
    if (
      nextDpr === state.dpr
    ) {
      return;
    }

    state.dpr =
      nextDpr;

    state.dprLastChangeAt =
      performance.now();

    engine.applyBackingStore();

    engine.resetPerformanceSampling();
  };



const resize =
  () => {
    const rect =
      state.canvas.getBoundingClientRect();

    state.canvasRectLeft =
      rect.left;

    state.canvasRectTop =
      rect.top;

    const nextWidth =
      Math.max(
        1,
        rect.width
      );

    const nextHeight =
      Math.max(
        1,
        rect.height
      );

    /*
     * ADAPTIVE DPR (Runtime v2): the target resolution derives from
     * the device DPR, canvas area, active quality tier and sustained
     * performance via resolveAdaptiveDpr (engineConfig). The policy
     * itself is debounced (>= 0.25 steps, >= 2.5s between changes,
     * never raising while the engine under-performs), so resolution
     * changes are rare, stable and always real work changes.
     */
    state.dprCap = dprCeilingFor(
      state.qualityName,
      nextWidth * nextHeight
    );

    const nextDpr =
      resolveAdaptiveDpr({
        deviceDpr:
          window.devicePixelRatio || 1,
        area: nextWidth * nextHeight,
        quality: state.qualityName,
        performanceRatio:
          state.refreshEstimator.estimate > 0
            ? state.latestFps / state.refreshEstimator.estimate
            : 0,
        currentDpr: state.dpr,
        lastChangeAt: state.dprLastChangeAt,
        now: performance.now()
      });

    /*
     * Perf guard (v3.1.1): ResizeObserver only coalesces within a
     * frame — a continuous window drag delivered up to ~60
     * callbacks/s, and each one reset the canvas backing store,
     * rebuilt the membrane gradient and re-placed every particle
     * and grid node even when the observed size had not actually
     * changed (initial no-op observer callbacks, the duplicate
     * reduced-motion mount call, sub-pixel jitter). Skip the
     * entire reallocation path when width/height/DPR are
     * unchanged; the rect reads above still refresh pointer
     * mapping.
     */
    if (
      nextWidth ===
        state.width &&
      nextHeight ===
        state.height &&
      nextDpr ===
        state.dpr
    ) {
      return;
    }

    state.width =
      nextWidth;

    state.height =
      nextHeight;

    /*
     * Real geometry change (v2.1): adopt the resolved DPR (the
     * backing store must be rewritten even when the DPR itself is
     * unchanged — a 1× display resizing its window still needs a
     * new bitmap), then invalidate the measurement windows —
     * resize previously let the open sampler window carry pre-
     * and post-resize frames in one average.
     */
    if (
      nextDpr !== state.dpr
    ) {
      state.dpr =
        nextDpr;

      state.dprLastChangeAt =
        performance.now();
    }

    engine.applyBackingStore();

    engine.resetPerformanceSampling();

    state.centerX =
      state.width *
      0.5;

    state.centerY =
      state.height *
      0.5;

    state.radius =
      Math.min(
        state.width,
        state.height
      ) *
      0.39;

    engine.rebuildMembraneGradient();

    if (
      state.gridNodes.length ===
      0
    ) {
      engine.buildWorld(
        qualityFromArea(
          rect.width *
          rect.height
        )
      );
    }

    for (
      let index = 0;
      index <
        state.gridNodes.length;
      index += 1
    ) {
      const node =
        state.gridNodes[
          index
        ];

      node.x =
        state.centerX +
        node.homeX *
          state.radius;

      node.y =
        state.centerY +
        node.homeY *
          state.radius;
    }

    placeParticles(
      state.particles,
      state.width,
      state.height
    );

    /*
     * A resize changed the world geometry. While the loop runs,
     * start() is a no-op and the next frame picks the new size
     * up; under reduced motion the loop is stopped, so this
     * renders one fresh static frame at the new size instead of
     * leaving a stale canvas.
     */
    engine.start();
  };



const start =
  () => {
    if (
      state.animationFrame !==
        0 ||
      !state.visible ||
      !state.documentVisible
    ) {
      return;
    }

    state.lastTimestamp =
      0;

    state.animationFrame =
      window.requestAnimationFrame(
        engine.render
      );
  };



const stop =
  () => {
    if (
      state.animationFrame !==
      0
    ) {
      window.cancelAnimationFrame(
        state.animationFrame
      );

      state.animationFrame =
        0;
    }

    state.lastTimestamp =
      0;
  };



const handleMotionChange =
  (
    event:
      MediaQueryListEvent
  ) => {
    state.reducedMotion =
      event.matches;

    if (
      state.reducedMotion
    ) {
      /*
       * Hard mode: a static organism draws one frame and stops, so
       * a deferred soft rebuild would never execute.
       */
      engine.setQuality(
        "low",
        {
          mode: "hard",
          reason: "reduced-motion"
        }
      );
    } else {
      engine.setQuality(
        qualityFromArea(
          state.width *
            state.height
        ),
        {
          mode: "hard",
          reason: "motion-restored"
        }
      );
    }

    engine.resize();

    engine.start();
  };



const handleIntersection =
  (
    entries:
      IntersectionObserverEntry[]
  ) => {
    state.visible =
      entries[0]
        ?.isIntersecting ??
      true;

    if (
      state.visible
    ) {
      engine.start();
    } else {
      engine.stop();
    }
  };



const handleVisibility =
  () => {
    state.documentVisible =
      document.visibilityState ===
      "visible";

    if (
      state.documentVisible
    ) {
      engine.start();
    } else {
      /*
       * Suspension resets the open sampling window: deltas across a
       * hidden period say nothing about the display or the engine,
       * and a stale window must not drive adaptation (Runtime v2;
       * the same measurement reset geometry/DPR changes use, v2.1).
       */
      engine.resetPerformanceSampling();

      suspendRefreshWindow(
        state.refreshEstimator
      );

      engine.stop();
    }
  };

  return {
    applyBackingStore,
    applyDpr,
    resize,
    handleMotionChange,
    handleIntersection,
    handleVisibility,
    start,
    stop
  };
}

/*
 * Engine assembly: one late-bound function object. Every module
 * factory receives the shared state and the engine object itself, so
 * cross-module calls resolve at call time — exactly like the closure
 * they were extracted from. All factories run before any call.
 */
function createEngine(state: EngineState): Engine {
  const engine = {} as Engine;

  Object.assign(engine, createSimulationModule(state, engine));
  Object.assign(engine, createRenderModule(state, engine));
  Object.assign(engine, createInputModule(state, engine));
  Object.assign(engine, createLifecycleModule(state, engine));

  return engine;
}

/*
 * THE MOUNT (v4.0.1) — the single entry point RedMagic.tsx calls from
 * its effect. Returns the teardown function; a missing 2D context
 * returns a no-op cleanup, exactly like the old early return.
 */
export function mountRedMagicEngine(
  canvas: HTMLCanvasElement
): () => void {
  const context = canvas.getContext(
    "2d",
    {
      alpha: true,
      desynchronized: true
    }
  );

  if (!context) {
    return () => {};
  }

  const reduceMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const nucleusGradient = createNucleusGradient(context);

  const state = createEngineState({
    canvas,
    context,
    reduceMotionQuery,
    nucleusGradient
  });

  const engine = createEngine(state);

state.canvas.addEventListener(
    "pointermove",
    engine.handlePointerMove,
    {
      passive:
        true
    }
  );

state.canvas.addEventListener(
    "pointerleave",
    engine.handlePointerLeave,
    {
      passive:
        true
    }
  );

state.canvas.addEventListener(
    "click",
    engine.handleCanvasClick,
    {
      passive:
        true
    }
  );

state.canvas.addEventListener(
    RED_MAGIC_INTERACTION_EVENT,
    engine.handleInteractionEvent
  );

state.reduceMotionQuery.addEventListener(
    "change",
    engine.handleMotionChange
  );

document.addEventListener(
    "visibilitychange",
    engine.handleVisibility
  );

state.resizeObserver =
    new ResizeObserver(
      engine.resize
    );

state.resizeObserver.observe(
    state.canvas
  );

state.intersectionObserver =
    new IntersectionObserver(
      engine.handleIntersection,
      {
        threshold:
          0.02
      }
    );

state.intersectionObserver.observe(
    state.canvas
  );

engine.buildWorld(
    qualityFromArea(
      state.canvas.clientWidth *
        state.canvas.clientHeight
    )
  );

engine.resize();

if (
    state.reducedMotion
  ) {
    engine.setQuality(
      "low",
      {
        mode: "hard",
        reason: "reduced-motion-mount"
      }
    );

    engine.resize();
  }

engine.start();

return () => {
    engine.stop();

    state.canvas.removeEventListener(
      "pointermove",
      engine.handlePointerMove
    );

    state.canvas.removeEventListener(
      "pointerleave",
      engine.handlePointerLeave
    );

    state.canvas.removeEventListener(
      "click",
      engine.handleCanvasClick
    );

    state.canvas.removeEventListener(
      RED_MAGIC_INTERACTION_EVENT,
      engine.handleInteractionEvent
    );

    state.reduceMotionQuery.removeEventListener(
      "change",
      engine.handleMotionChange
    );

    document.removeEventListener(
      "visibilitychange",
      engine.handleVisibility
    );

    state.resizeObserver?.disconnect();

    state.intersectionObserver?.disconnect();

    /*
     * Memory lifecycle: release the canvas backing store
     * deterministically instead of waiting for GC. Resizing to zero
     * drops the bitmap allocation for this context immediately; the
     * sprites and typed arrays are reachable only from this closure
     * and are collected with it.
     */
    state.context.clearRect(
      0,
      0,
      state.width,
      state.height
    );

    state.canvas.width = 0;

    state.canvas.height = 0;
  };
}
