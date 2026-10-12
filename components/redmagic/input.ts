/*
 * redmagic/input.ts — DOM event intake for the organism (v4.0.1).
 *
 * Mechanically extracted from the engine closure in
 * components/RedMagic.tsx: the function bodies are unchanged; the
 * shared mutable state arrives as the single EngineState object and
 * sibling engine functions are reached through the late-bound
 * Engine object.
 */

import type { EngineState, Engine } from "@/components/redmagic/engineState";

import {
  clamp
} from "@/components/redmagic/engineConstants";

import {
  type RedMagicInteractionDetail
} from "@/components/RedMagicInteraction";

export function createInputModule(
  state: EngineState,
  engine: Engine
): Pick<Engine, "handleInteractionEvent" | "handleCanvasClick" | "handlePointerMove" | "handlePointerLeave"> {


  const handleInteractionEvent =
    (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<RedMagicInteractionDetail>;

      const detail =
        customEvent.detail;

      if (!detail) {
        return;
      }

      state.pointerTarget.x =
        clamp(
          detail.x,
          0,
          state.width
        );

      state.pointerTarget.y =
        clamp(
          detail.y,
          0,
          state.height
        );

      state.pointerVelocity =
        detail.velocity;

      /*
       * Impulse memory (Runtime v2): discrete events leave a decaying
       * afterglow so the organism's energy falls naturally instead of
       * snapping back the instant the event ends.
       */
      state.interactionMemory =
        Math.max(
          state.interactionMemory,
          detail.energy
        );

      state.interactionTurbulence =
        clamp(
          (
            detail.velocity /
            40
          ) *
            state.profile.turbulenceGain,
          0,
          1
        );

      state.interactionEnergy =
        Math.max(
          state.interactionEnergy,
          detail.energy
        );

      switch (
        detail.type
      ) {
        case "enter":
          state.pointerActive =
            true;

          if (
            state.pointerPresentSince ===
            0
          ) {
            state.pointerPresentSince =
              performance.now();
          }

          state.interactionEnergy =
            Math.max(
              state.interactionEnergy,
              0.14
            );

          break;

        case "move":
          state.pointerActive =
            true;

          break;

        case "impact":
          state.pointerActive =
            true;

          state.interactionEnergy =
            Math.max(
              state.interactionEnergy,
              detail.proximity
            );

          engine.spawnShockwave(
            detail,
            0.62 +
              detail.proximity *
                0.28
          );

          engine.applyParticleImpulse(
            detail,
            0.48 +
              detail.proximity *
                0.38
          );

          break;

        case "flick":
          state.pointerActive =
            true;

          state.interactionEnergy =
            Math.max(
              state.interactionEnergy,
              detail.energy
            );

          engine.spawnShockwave(
            detail,
            0.34 +
              clamp(
                detail.velocity /
                  10,
                0,
                0.7
              )
          );

          engine.applyParticleImpulse(
            detail,
            0.72 +
              clamp(
                detail.velocity /
                  8,
                0,
                0.28
              )
          );

          break;

        case "charge":
          state.pointerHeld =
            true;

          state.charge =
            detail.charge;

          state.interactionEnergy =
            Math.max(
              state.interactionEnergy,
              detail.charge
            );

          break;

        case "release":
          state.pointerHeld =
            false;

          state.charge =
            detail.charge;

          state.interactionEnergy =
            Math.max(
              state.interactionEnergy,
              detail.charge
            );

          if (
            detail.charge >
            0.08
          ) {
            engine.spawnShockwave(
              detail,
              0.42 +
                detail.charge *
                  0.58
            );

            engine.applyParticleImpulse(
              detail,
              0.55 +
                detail.charge *
                  0.9
            );
          }

          break;

        case "orbit":
          state.pointerActive =
            true;

          state.interactionTurbulence =
            Math.max(
              state.interactionTurbulence,
              0.45 *
                state.profile.turbulenceGain
            );

          break;

        case "leave":
          state.pointerActive =
            false;

          state.pointerHeld =
            false;

          state.interactionEnergy =
            Math.min(
              state.interactionEnergy,
              0.35
            );

          state.charge =
            0;

          /*
           * Signals decay from here: the organism calms down over the
           * following seconds instead of dropping instantly.
           */
          state.pointerPresentSince = 0;

          state.pointerSpeedPxPerS = 0;

          state.lastSignalPointerAt = 0;

          state.idleSince =
            performance.now();

          break;
      }

      /*
       * Interaction events carry real intent: leave the idle
       * cadence and (under reduced motion) draw one fresh static
       * frame so event-driven state is reflected without a loop.
       */
      if (detail.type !== "leave") {
        state.idleSince =
          null;
      }

      engine.start();
    };



  const handleCanvasClick =
    (
      event:
        MouseEvent
    ) => {
      const x =
        clamp(
          event.clientX -
            state.canvasRectLeft,
          0,
          state.width
        );

      const y =
        clamp(
          event.clientY -
            state.canvasRectTop,
          0,
          state.height
        );

      state.pointerTarget.x =
        x;

      state.pointerTarget.y =
        y;

      /*
       * Click particles animate through stepDelta, which is
       * permanently zero under reduced motion — spawning them
       * there would leave frozen artifacts. The click still
       * produces one fresh static frame via start().
       */
      if (!state.reducedMotion) {
        engine.addClickParticle(
          x,
          y
        );
      }

      state.idleSince =
        null;

      engine.start();
    };



  const handlePointerMove =
    (
      event:
        PointerEvent
    ) => {
      engine.updatePointer(
        event.clientX,
        event.clientY
      );

      state.pointerActive =
        true;

      /*
       * Pointer intent is present: leave idle cadence and (under
       * reduced motion) draw one fresh static frame per event.
       */
      state.idleSince =
        null;

      engine.start();
    };



  const handlePointerLeave =
    () => {
      state.pointerActive =
        false;

      state.pointerPresentSince = 0;

      state.pointerSpeedPxPerS = 0;

      state.lastSignalPointerAt = 0;

      state.idleSince =
        performance.now();
    };

  return {
    handleInteractionEvent,
    handleCanvasClick,
    handlePointerMove,
    handlePointerLeave
  };
}
