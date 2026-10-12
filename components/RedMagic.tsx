"use client";

import {
  useEffect,
  useRef
} from "react";

import styles from "@/components/RedMagic.module.css";

import {
  mountRedMagicEngine
} from "@/components/redmagic/lifecycle";

/*
 * RED MAGIC — the React shell of the computational organism (v4.0.1).
 *
 * This component stays deliberately tiny: a canvas host plus one
 * effect that mounts the engine and returns its teardown. Everything
 * operational lives in the redmagic/ module family, mechanically
 * extracted from this file in v4.0.1 with unchanged behavior:
 *
 *   redmagic/engineConstants.ts  shared types, tuning constants,
 *                                the organism profile, math helpers
 *   redmagic/engineConfig.ts     quality budgets, adaptation policy
 *                                (pre-existing module, unchanged)
 *   redmagic/engineSprites.ts    cached sprite construction
 *                                (pre-existing module, unchanged)
 *   redmagic/engineWorld.ts      pure world-structure builders
 *                                (pre-existing module, unchanged)
 *   redmagic/engineState.ts      the single mutable EngineState
 *   redmagic/simulation.ts       world building, grid physics,
 *                                quality adaptation, pointer signals
 *   redmagic/render.ts           the draw passes and frame loop
 *   redmagic/input.ts            DOM event intake
 *   redmagic/lifecycle.ts        mount, observers, teardown
 *
 * The public contract is unchanged: default export, the same markup
 * and the same lazy loading through RedMagicScene — ScenePreloader
 * remains the single dynamic import site.
 */

export default function RedMagic() {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    return mountRedMagicEngine(
      canvas
    );
  }, []);

  return (
    <div
      className={
        styles.root
      }
      role="img"
      aria-label="Interactive RED MAGIC interconnected computational energy field"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
      />
    </div>
  );
}
