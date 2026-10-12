"use client";

import {
  useEffect,
  useRef
} from "react";

import {
  emitRedMagicInteraction
} from "@/components/RedMagicInteraction";

import {
  RedMagicAudio
} from "@/components/RedMagicAudio";

import styles from "@/components/MagicInteractionLayer.module.css";

type Point = {
  x: number;
  y: number;
};

type MagicInteractionLayerProps = {
  children: React.ReactNode;

  soundEnabled: boolean;
};

const RIPPLE_COUNT = 8;

const ORBIT_THRESHOLD =
  0.012;

const FLICK_THRESHOLD =
  1.15;

const CHARGE_RATE =
  0.00082;

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function angleDelta(
  next: number,
  previous: number
) {
  return Math.atan2(
    Math.sin(
      next -
        previous
    ),
    Math.cos(
      next -
        previous
    )
  );
}

export default function MagicInteractionLayer({
  children,
  soundEnabled
}: MagicInteractionLayerProps) {
  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const interactionTargetRef =
    useRef<HTMLElement | null>(
      null
    );

  const pointerRef =
    useRef<Point>({
      x: 0,
      y: 0
    });

  const previousPointerRef =
    useRef<Point>({
      x: 0,
      y: 0
    });

  const previousTimeRef =
    useRef(0);

  const centerRef =
    useRef<Point>({
      x: 0,
      y: 0
    });

  const rectRef =
    useRef<DOMRect | null>(
      null
    );

  const angleRef =
    useRef(0);

  const orbitAccumulatorRef =
    useRef(0);

  const pointerHeldRef =
    useRef(false);

  const chargeRef =
    useRef(0);

  const rippleIndexRef =
    useRef(0);

  const audioRef =
    useRef<RedMagicAudio | null>(
      null
    );

  /*
   * First-run gate for the soundEnabled effect: the mount value is
   * applied by the creation effect with a deferred start, so the
   * effect must not construct the audio graph during hydration.
   */
  const soundEffectMountRef =
    useRef(true);

  const reducedMotionRef =
    useRef(false);

  /*
   * rAF handle for scroll-coalesced geometry updates (see
   * scheduleGeometry below).
   */
  const geometryFrameRef =
    useRef(0);

  /*
   * The leave-transition timer is retained so it can be cancelled on
   * unmount (and superseded by later interactions) instead of firing
   * against a detached element.
   */
  const interactionIdleTimeoutRef =
    useRef<number | null>(
      null
    );

  const pendingPointerRef =
    useRef<Point | null>(
      null
    );

  const pointerFrameRef =
    useRef<number | null>(
      null
    );

  /*
   * The pooled ripple elements are static JSX children — they never
   * mount, unmount, or reorder. Querying them with querySelectorAll
   * on every triggerRipple call re-walked the DOM at interaction
   * frequency; they are cached once instead. The pending-restart
   * timers are tracked per element so a same-element retrigger
   * supersedes (rather than doubles) its restart, and unmount
   * cancels every outstanding restart.
   */
  const rippleElementsRef =
    useRef<HTMLSpanElement[] | null>(
      null
    );

  const rippleRestartTimersRef =
    useRef<Map<HTMLSpanElement, number>>(
      new Map()
    );

  const updateGeometry =
    () => {
      const root =
        rootRef.current;

      if (!root) {
        return;
      }

      const rect =
        root.getBoundingClientRect();

      rectRef.current =
        rect;

      centerRef.current = {
        x:
          rect.width *
          0.5,

        y:
          rect.height *
          0.5
      };
    };

  /*
   * Scroll arrives at event frequency; each event used to force a
   * synchronous getBoundingClientRect (layout read) per tick. The
   * layer's rect only changes when the page layout around it does,
   * so scroll-driven updates are coalesced to one read per frame.
   */
  const scheduleGeometry =
    () => {
      if (
        geometryFrameRef.current !==
        0
      ) {
        return;
      }

      geometryFrameRef.current =
        window.requestAnimationFrame(
          () => {
            geometryFrameRef.current =
              0;

            updateGeometry();
          }
        );
    };

  const getCanvasTarget =
    () => {
      const cachedTarget =
        interactionTargetRef.current;

      if (cachedTarget) {
        return cachedTarget;
      }

      const root =
        rootRef.current;

      if (!root) {
        return null;
      }

      const target =
        root.querySelector(
          "canvas"
        ) ?? root;

      interactionTargetRef.current =
        target;

      return target;
    };

  const emitInteraction =
    (
      type:
        | "enter"
        | "move"
        | "impact"
        | "flick"
        | "charge"
        | "release"
        | "orbit"
        | "leave",

      x: number,
      y: number,
      velocity: number,
      proximity: number,
      energy: number,
      angle: number,
      charge: number
    ) => {
      const target =
        getCanvasTarget();

      if (!target) {
        return;
      }

      emitRedMagicInteraction(
        target,
        {
          type,
          x,
          y,
          velocity,
          proximity,
          energy,
          angle,
          charge
        }
      );
    };

  const triggerRipple =
    (
      x: number,
      y: number,
      intensity: number
    ) => {
      if (
        reducedMotionRef.current
      ) {
        return;
      }

      const root =
        rootRef.current;

      if (!root) {
        return;
      }

      /*
       * Cached once (static pooled children); invalidated on unmount
       * through rippleElementsRef cleanup. Falls back to a single
       * query if the cache has not been populated yet.
       */
      const cachedRipples =
        rippleElementsRef.current;

      const ripples =
        cachedRipples ??
        Array.from(
          root.querySelectorAll<HTMLSpanElement>(
            `.${styles.magicInteractionRipple}`
          )
        );

      rippleElementsRef.current =
        ripples;

      if (
        ripples.length === 0
      ) {
        return;
      }

      const index =
        rippleIndexRef.current %
        ripples.length;

      rippleIndexRef.current +=
        1;

      const ripple =
        ripples[index];

      ripple.style.setProperty(
        "--ripple-x",
        `${x}px`
      );

      ripple.style.setProperty(
        "--ripple-y",
        `${y}px`
      );

      ripple.style.setProperty(
        "--ripple-size",
        `${42 +
          intensity *
            120}px`
      );

      ripple.style.setProperty(
        "--ripple-strength",
        `${0.38 +
          intensity *
            0.46}`
      );

      /*
       * Restart the pooled element's animation WITHOUT forcing
       * layout: `void ripple.offsetWidth` here performed a full
       * synchronous reflow on the pointer path (including the
       * per-frame flick branch). The class is removed, then re-added
       * on the next frame — the computed animation-name change
       * between frames restarts the CSS animation, same mechanism
       * WorldBackground uses. The re-add timer is tracked so a
       * same-element retrigger supersedes the pending one and
       * unmount cancels everything.
       */
      const restartTimers =
        rippleRestartTimersRef.current;

      const pendingTimer =
        restartTimers.get(ripple);

      if (pendingTimer !== undefined) {
        window.clearTimeout(
          pendingTimer
        );

        restartTimers.delete(
          ripple
        );
      }

      ripple.classList.remove(
        styles.isActive
      );

      restartTimers.set(
        ripple,
        window.setTimeout(
          () => {
            restartTimers.delete(
              ripple
            );

            ripple.classList.add(
              styles.isActive
            );
          },
          16
        )
      );
    };

  const processPointerPosition =
    (
      x: number,
      y: number,
      now: number
    ) => {
      const rect =
        rectRef.current;

      if (!rect) {
        updateGeometry();

        return;
      }

      const previous =
        previousPointerRef.current;

      const deltaTime =
        clamp(
          now -
            previousTimeRef.current,
          1,
          50
        );

      const dx =
        x -
        previous.x;

      const dy =
        y -
        previous.y;

      const distance =
        Math.hypot(
          dx,
          dy
        );

      const velocity =
        distance /
        deltaTime;

      const center =
        centerRef.current;

      const centerDx =
        x -
        center.x;

      const centerDy =
        y -
        center.y;

      const centerDistance =
        Math.hypot(
          centerDx,
          centerDy
        );

      const maxDistance =
        Math.max(
          1,
          Math.hypot(
            center.x,
            center.y
          )
        );

      const proximity =
        1 -
        clamp(
          centerDistance /
            maxDistance,
          0,
          1
        );

      const currentAngle =
        Math.atan2(
          centerDy,
          centerDx
        );

      const deltaAngle =
        angleDelta(
          currentAngle,
          angleRef.current
        );

      orbitAccumulatorRef.current +=
        deltaAngle;

      angleRef.current =
        currentAngle;

      const flicking =
        velocity >
        FLICK_THRESHOLD;

      const orbiting =
        Math.abs(
          deltaAngle
        ) >
          ORBIT_THRESHOLD &&
        Math.abs(
          orbitAccumulatorRef.current
        ) >
          Math.PI *
            0.9 &&
        proximity >
          0.18;

      if (
        pointerHeldRef.current
      ) {
        chargeRef.current =
          clamp(
            chargeRef.current +
              deltaTime *
                CHARGE_RATE,
            0,
            1
          );
      }

      pointerRef.current = {
        x,
        y
      };

      previousPointerRef.current = {
        x,
        y
      };

      previousTimeRef.current =
        now;

      const root =
        rootRef.current;

      if (root) {
        root.style.setProperty(
          "--magic-pointer-x",
          `${x}px`
        );

        root.style.setProperty(
          "--magic-pointer-y",
          `${y}px`
        );

        root.style.setProperty(
          "--magic-proximity",
          `${proximity}`
        );

        root.style.setProperty(
          "--magic-velocity",
          `${clamp(
            velocity *
              10,
            0,
            1
          )}`
        );

        root.style.setProperty(
          "--magic-angle",
          `${currentAngle}rad`
        );

        root.style.setProperty(
          "--magic-charge",
          `${chargeRef.current}`
        );
      }

      emitInteraction(
        "move",
        x,
        y,
        velocity,
        proximity,
        proximity,
        currentAngle,
        chargeRef.current
      );

      if (
        pointerHeldRef.current
      ) {
        emitInteraction(
          "charge",
          x,
          y,
          velocity,
          proximity,
          chargeRef.current,
          currentAngle,
          chargeRef.current
        );
      }

      if (
        flicking
      ) {
        emitInteraction(
          "flick",
          x,
          y,
          velocity,
          proximity,
          clamp(
            velocity /
              10,
            0,
            1
          ),
          currentAngle,
          chargeRef.current
        );

        triggerRipple(
          x,
          y,
          clamp(
            velocity *
              0.65,
            0.35,
            1
          )
        );

        return;
      }

      if (
        orbiting
      ) {
        emitInteraction(
          "orbit",
          x,
          y,
          velocity,
          proximity,
          proximity,
          currentAngle,
          chargeRef.current
        );

        orbitAccumulatorRef.current =
          0;
      }
    };

  const flushPointerMove =
    () => {
      const pending =
        pendingPointerRef.current;

      if (!pending) {
        pointerFrameRef.current =
          null;

        return;
      }

      pendingPointerRef.current =
        null;

      pointerFrameRef.current =
        null;

      processPointerPosition(
        pending.x,
        pending.y,
        performance.now()
      );
    };

  const schedulePointerMove =
    (
      x: number,
      y: number
    ) => {
      pendingPointerRef.current = {
        x,
        y
      };

      if (
        pointerFrameRef.current !==
        null
      ) {
        return;
      }

      pointerFrameRef.current =
        window.requestAnimationFrame(
          flushPointerMove
        );
    };

  const handlePointerEnter =
    (
      event:
        React.PointerEvent<HTMLDivElement>
    ) => {
      updateGeometry();

      const rect =
        rectRef.current;

      if (!rect) {
        return;
      }

      const x =
        event.clientX -
        rect.left;

      const y =
        event.clientY -
        rect.top;

      const center =
        centerRef.current;

      const angle =
        Math.atan2(
          y -
            center.y,
          x -
            center.x
        );

      pendingPointerRef.current =
        null;

      if (
        pointerFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          pointerFrameRef.current
        );

        pointerFrameRef.current =
          null;
      }

      pointerRef.current = {
        x,
        y
      };

      previousPointerRef.current = {
        x,
        y
      };

      previousTimeRef.current =
        performance.now();

      angleRef.current =
        angle;

      orbitAccumulatorRef.current =
        0;

      emitInteraction(
        "enter",
        x,
        y,
        0,
        0,
        0,
        angle,
        chargeRef.current
      );

      triggerRipple(
        x,
        y,
        0.55
      );
    };

  const handlePointerMove =
    (
      event:
        React.PointerEvent<HTMLDivElement>
    ) => {
      const rect =
        rectRef.current;

      if (!rect) {
        updateGeometry();

        return;
      }

      schedulePointerMove(
        event.clientX -
          rect.left,
        event.clientY -
          rect.top
      );
    };

  const handlePointerDown =
    (
      event:
        React.PointerEvent<HTMLDivElement>
    ) => {
      const rect =
        rectRef.current;

      if (!rect) {
        updateGeometry();

        return;
      }

      const x =
        event.clientX -
        rect.left;

      const y =
        event.clientY -
        rect.top;

      pendingPointerRef.current =
        null;

      if (
        pointerFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          pointerFrameRef.current
        );

        pointerFrameRef.current =
          null;
      }

      processPointerPosition(
        x,
        y,
        performance.now()
      );

      const center =
        centerRef.current;

      const dx =
        x -
        center.x;

      const dy =
        y -
        center.y;

      const distance =
        Math.hypot(
          dx,
          dy
        );

      const maxDistance =
        Math.max(
          1,
          Math.hypot(
            center.x,
            center.y
          )
        );

      const proximity =
        1 -
        clamp(
          distance /
            maxDistance,
          0,
          1
        );

      const angle =
        Math.atan2(
          dy,
          dx
        );

      pointerHeldRef.current =
        true;

      chargeRef.current =
        0;

      emitInteraction(
        "impact",
        x,
        y,
        0,
        proximity,
        proximity,
        angle,
        0
      );

      triggerRipple(
        x,
        y,
        0.5 +
          proximity *
            0.5
      );
    };

  const handlePointerUp =
    (
      event?:
        React.PointerEvent<HTMLDivElement>
    ) => {
      const root =
        rootRef.current;

      if (!root) {
        return;
      }

      if (event) {
        const rect =
          rectRef.current;

        if (rect) {
          const x =
            event.clientX -
            rect.left;

          const y =
            event.clientY -
            rect.top;

          const hasPendingMove =
            pendingPointerRef.current !==
            null ||
            pointerRef.current.x !==
              x ||
            pointerRef.current.y !==
              y;

          if (hasPendingMove) {
            pendingPointerRef.current =
              null;

            if (
              pointerFrameRef.current !==
              null
            ) {
              window.cancelAnimationFrame(
                pointerFrameRef.current
              );

              pointerFrameRef.current =
                null;
            }

            processPointerPosition(
              x,
              y,
              performance.now()
            );
          }
        }
      }

      const x =
        pointerRef.current.x;

      const y =
        pointerRef.current.y;

      const center =
        centerRef.current;

      const dx =
        x -
        center.x;

      const dy =
        y -
        center.y;

      const distance =
        Math.hypot(
          dx,
          dy
        );

      const maxDistance =
        Math.max(
          1,
          Math.hypot(
            center.x,
            center.y
          )
        );

      const proximity =
        1 -
        clamp(
          distance /
            maxDistance,
          0,
          1
        );

      const charge =
        chargeRef.current;

      pointerHeldRef.current =
        false;

      emitInteraction(
        "release",
        x,
        y,
        0,
        proximity,
        charge,
        Math.atan2(
          dy,
          dx
        ),
        charge
      );

      if (
        charge >
        0.08
      ) {
        triggerRipple(
          x,
          y,
          0.35 +
            charge *
              0.65
        );
      }

      chargeRef.current =
        0;

      root.style.setProperty(
        "--magic-charge",
        "0"
      );
    };

  const handlePointerLeave =
    () => {
      const x =
        pointerRef.current.x;

      const y =
        pointerRef.current.y;

      const root =
        rootRef.current;

      pendingPointerRef.current =
        null;

      if (
        pointerFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          pointerFrameRef.current
        );

        pointerFrameRef.current =
          null;
      }

      pointerHeldRef.current =
        false;

      emitInteraction(
        "leave",
        x,
        y,
        0,
        0,
        0,
        angleRef.current,
        chargeRef.current
      );

      chargeRef.current =
        0;

      if (root) {
        root.style.setProperty(
          "--magic-charge",
          "0"
        );

        if (
          interactionIdleTimeoutRef.current !==
          null
        ) {
          window.clearTimeout(
            interactionIdleTimeoutRef.current
          );
        }

        interactionIdleTimeoutRef.current =
          window.setTimeout(
            () => {
              root.dataset.interaction =
                "idle";

              interactionIdleTimeoutRef.current =
                null;
            },
            260
          );
      }
    };

  useEffect(() => {
    const reduceMotionQuery =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

    reducedMotionRef.current =
      reduceMotionQuery.matches;

    const handleMotionChange =
      (
        event:
          MediaQueryListEvent
      ) => {
        reducedMotionRef.current =
          event.matches;
      };

    reduceMotionQuery.addEventListener(
      "change",
      handleMotionChange
    );

    updateGeometry();

    /*
     * resize is coalesced through the same rAF path as scroll: the
     * handler only performs a getBoundingClientRect read, and burst
     * resize events (window drag, devtools open) used to force one
     * synchronous layout read per event.
     */
    window.addEventListener(
      "resize",
      scheduleGeometry,
      {
        passive: true
      }
    );

    window.addEventListener(
      "scroll",
      scheduleGeometry,
      {
        passive: true
      }
    );

    const audio =
      new RedMagicAudio();

    /*
     * Deferred start (v2.8): restoring a stored ON preference here
     * must not construct the AudioContext before any user gesture —
     * the engine's one-shot gesture listeners start it from the
     * first real pointerdown / keydown instead.
     */
    audio.setEnabled(
      soundEnabled,
      {
        deferStart: true
      }
    );

    audioRef.current =
      audio;

    const target =
      getCanvasTarget();

    if (target) {
      audio.attach(
        target
      );
    }

    return () => {
      if (
        pointerFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          pointerFrameRef.current
        );

        pointerFrameRef.current =
          null;
      }

      if (
        interactionIdleTimeoutRef.current !==
        null
      ) {
        window.clearTimeout(
          interactionIdleTimeoutRef.current
        );

        interactionIdleTimeoutRef.current =
          null;
      }

      pendingPointerRef.current =
        null;

      interactionTargetRef.current =
        null;

      reduceMotionQuery.removeEventListener(
        "change",
        handleMotionChange
      );

      window.removeEventListener(
        "resize",
        scheduleGeometry
      );

      window.removeEventListener(
        "scroll",
        scheduleGeometry
      );

      for (const timer of rippleRestartTimersRef.current.values()) {
        window.clearTimeout(
          timer
        );
      }

      rippleRestartTimersRef.current.clear();

      rippleElementsRef.current =
        null;

      if (
        geometryFrameRef.current !==
        0
      ) {
        window.cancelAnimationFrame(
          geometryFrameRef.current
        );

        geometryFrameRef.current =
          0;
      }

      audio.destroy();

      audioRef.current =
        null;
    };
  }, []);

  useEffect(() => {
    /*
     * The mount run is skipped: the creation effect already applied
     * the stored preference with a deferred start (no AudioContext
     * before a user gesture). Only later prop changes — real
     * toggle clicks — (re)start or stop the graph immediately.
     */
    if (
      soundEffectMountRef.current
    ) {
      soundEffectMountRef.current =
        false;

      return;
    }

    const audio =
      audioRef.current;

    if (!audio) {
      return;
    }

    audio.setEnabled(
      soundEnabled
    );
  }, [soundEnabled]);

  return (
    <div
      ref={rootRef}
      className={
        styles.magicInteraction
      }
      onPointerEnter={
        handlePointerEnter
      }
      onPointerMove={
        handlePointerMove
      }
      onPointerDown={
        handlePointerDown
      }
      onPointerUp={
        handlePointerUp
      }
      onPointerCancel={
        handlePointerUp
      }
      onPointerLeave={
        handlePointerLeave
      }
    >
      <div
        className={
          styles.magicInteractionVisual
        }
        aria-hidden="true"
      >
        <span
          className={
            styles.magicInteractionAura
          }
        />

        <span
          className={[
            styles.magicInteractionOrbit,
            styles.magicInteractionOrbitOne
          ].join(" ")}
        />

        <span
          className={[
            styles.magicInteractionOrbit,
            styles.magicInteractionOrbitTwo
          ].join(" ")}
        />

        <span
          className={[
            styles.magicInteractionOrbit,
            styles.magicInteractionOrbitThree
          ].join(" ")}
        />

        <span
          className={[
            styles.magicInteractionAxis,
            styles.magicInteractionAxisX
          ].join(" ")}
        />

        <span
          className={[
            styles.magicInteractionAxis,
            styles.magicInteractionAxisY
          ].join(" ")}
        />

        {Array.from(
          {
            length:
              RIPPLE_COUNT
          },
          (_, index) => (
            <span
              className={
                styles.magicInteractionRipple
              }
              key={index}
            />
          )
        )}

        <span
          className={
            styles.magicInteractionReticle
          }
        />
      </div>

      <div
        className={
          styles.magicInteractionContent
        }
      >
        {children}
      </div>
    </div>
  );
}
