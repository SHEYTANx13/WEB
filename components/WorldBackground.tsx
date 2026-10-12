"use client";

import {
  useEffect,
  useRef
} from "react";

import type {
  CSSProperties
} from "react";

import {
  noteWorldClick,
  noteWorldPointerMove,
  noteWorldVisibility,
  subscribeWorld,
  getWorldClick,
  getWorldScene,
  getPulseToken,
  getOrganismActivity,
  isWorldHidden
} from "@/lib/worldSignals";

import styles from "@/components/WorldBackground.module.css";

/*
 * WORLD BACKGROUND — ONE CONTINUOUS LIVING SYSTEM.
 *
 * Architecture (Living Organism):
 *
 * LOOPED TIMESTABLES (CSS, compositor-only):
 *   MICRO      particles / sparks (6–17 s, per-element phase offsets)
 *   SHORT      energy wisps (31–61 s, alternating directions)
 *   MEDIUM     orbital rings (34–82 s, mixed directions)
 *   LONG       atmospheric masses + aura breathing (28–57 s)
 *   HEART      core + nucleus breathing (8.5–19 s)
 *   EVENT      transition pulse + click ripples (controller-triggered)
 *
 * COHERENCE: every layer lives inside the same field; scene moods,
 * hidden-tab suspension, and reduced motion are applied through one
 * attribute on the root, so the organism always behaves as ONE system
 * rather than a bag of independent animations.
 *
 * INTERACTION (this controller, zero React state):
 *   pointer position → nearby field distortion (transform-only)
 *   pointer energy   → shared --organism-energy variable
 *   click            → local ripple (one of six pooled elements)
 *   scene transition → coordinated pulse (single overlay element)
 *   idle             → energy decays and the loop SELF-SUSPENDS
 *
 * COST LAW: the controller writes only CSS custom properties and
 * attributes on this subtree (transform/opacity consumers only), and
 * its single rAF loop runs ONLY while there is energy to spend. A
 * settled organism costs zero JavaScript per frame. There are no
 * per-frame allocations: everything mutable lives in closed-over
 * refs/locals allocated once per mount.
 *
 * Reduced motion: calmer, not dead — high-frequency loops stop, the
 * slowest breathing layers remain at reduced amplitude (CSS media
 * query), and the controller disables ripples/pulse/pointer tracking.
 */

const RING_COUNT = 5;

const WISP_COUNT = 7;

const PARTICLE_COUNT = 24;

const RIPPLE_POOL = 6;

/*
 * Energy model constants. The organism wakes on pointer movement and
 * decays toward its scene's resting level; below EPSILON the loop
 * suspends itself.
 */
const ENERGY_GAIN = 0.0035;

/*
 * RUNTIME V2 — SHARED VISUAL/PERFORMANCE BUDGET.
 *
 * The interactive RedMagic canvas organism publishes its arousal to the
 * world-signal store. When it is already visibly responding to the same
 * pointer (activity >= ORGANISM_ACTIVE_BACKOFF), this ambient layer
 * backs off: its energy gain is scaled down proportionally and fresh
 * click ripples are suppressed (the canvas produces its own richer
 * shockwaves for the same gesture). One budget, two layers — the
 * ambient organism stays alive, it just stops duplicating the
 * interactive layer's signal.
 */
const ORGANISM_ACTIVE_BACKOFF = 0.35;

const ORGANISM_ACTIVE_GAIN_SCALE = 0.4;

const ENERGY_DECAY = 0.94;

const ENERGY_EPSILON = 0.0015;

const POINTER_LERP = 0.14;

const LOOP_IDLE_SLEEP_MS = 900;

const PULSE_ANIMATION_MS = 1100;

const BASE_ENERGY: Record<string, number> = {
  home: 0.08,
  about: 0.05,
  systems: 0.07,
  magic: 0.16,
  work: 0.06,
  library: 0.035,
  archive: 0.035
};

type ParticleStyle =
  CSSProperties &
  Record<
    "--dx" | "--dy" | "--delay" | "--duration",
    string
  >;

const PARTICLE_STYLES: ParticleStyle[] = [
  {
    left: "12%",
    top: "22%",
    "--dx": "22px",
    "--dy": "-28px",
    "--delay": "-2s",
    "--duration": "11s"
  },
  {
    left: "19%",
    top: "58%",
    "--dx": "-18px",
    "--dy": "24px",
    "--delay": "-7s",
    "--duration": "14s"
  },
  {
    left: "27%",
    top: "34%",
    "--dx": "26px",
    "--dy": "18px",
    "--delay": "-4s",
    "--duration": "12s"
  },
  {
    left: "34%",
    top: "72%",
    "--dx": "-30px",
    "--dy": "-16px",
    "--delay": "-10s",
    "--duration": "15s"
  },
  {
    left: "41%",
    top: "18%",
    "--dx": "20px",
    "--dy": "30px",
    "--delay": "-6s",
    "--duration": "13s"
  },
  {
    left: "48%",
    top: "46%",
    "--dx": "-22px",
    "--dy": "-22px",
    "--delay": "-12s",
    "--duration": "16s"
  },
  {
    left: "56%",
    top: "28%",
    "--dx": "32px",
    "--dy": "14px",
    "--delay": "-3s",
    "--duration": "12s"
  },
  {
    left: "64%",
    top: "62%",
    "--dx": "-18px",
    "--dy": "28px",
    "--delay": "-9s",
    "--duration": "14s"
  },
  {
    left: "71%",
    top: "38%",
    "--dx": "24px",
    "--dy": "-20px",
    "--delay": "-5s",
    "--duration": "13s"
  },
  {
    left: "78%",
    top: "72%",
    "--dx": "-28px",
    "--dy": "18px",
    "--delay": "-11s",
    "--duration": "15s"
  },
  {
    left: "84%",
    top: "24%",
    "--dx": "18px",
    "--dy": "-26px",
    "--delay": "-8s",
    "--duration": "12s"
  },
  {
    left: "89%",
    top: "52%",
    "--dx": "-20px",
    "--dy": "22px",
    "--delay": "-13s",
    "--duration": "17s"
  },
  {
    left: "16%",
    top: "78%",
    "--dx": "28px",
    "--dy": "-18px",
    "--delay": "-14s",
    "--duration": "16s"
  },
  {
    left: "23%",
    top: "18%",
    "--dx": "-24px",
    "--dy": "20px",
    "--delay": "-1s",
    "--duration": "13s"
  },
  {
    left: "31%",
    top: "54%",
    "--dx": "16px",
    "--dy": "-30px",
    "--delay": "-8s",
    "--duration": "14s"
  },
  {
    left: "38%",
    top: "40%",
    "--dx": "-32px",
    "--dy": "16px",
    "--delay": "-15s",
    "--duration": "18s"
  },
  {
    left: "46%",
    top: "80%",
    "--dx": "22px",
    "--dy": "24px",
    "--delay": "-5s",
    "--duration": "15s"
  },
  {
    left: "53%",
    top: "14%",
    "--dx": "-18px",
    "--dy": "-24px",
    "--delay": "-11s",
    "--duration": "13s"
  },
  {
    left: "61%",
    top: "48%",
    "--dx": "30px",
    "--dy": "-16px",
    "--delay": "-3s",
    "--duration": "16s"
  },
  {
    left: "69%",
    top: "16%",
    "--dx": "-26px",
    "--dy": "28px",
    "--delay": "-10s",
    "--duration": "14s"
  },
  {
    left: "76%",
    top: "58%",
    "--dx": "18px",
    "--dy": "20px",
    "--delay": "-6s",
    "--duration": "15s"
  },
  {
    left: "82%",
    top: "34%",
    "--dx": "-30px",
    "--dy": "-18px",
    "--delay": "-12s",
    "--duration": "17s"
  },
  {
    left: "91%",
    top: "78%",
    "--dx": "24px",
    "--dy": "16px",
    "--delay": "-4s",
    "--duration": "13s"
  },
  {
    left: "58%",
    top: "76%",
    "--dx": "-20px",
    "--dy": "-28px",
    "--delay": "-9s",
    "--duration": "16s"
  }
];

const RINGS = Array.from(
  { length: RING_COUNT },
  (_, index) => index + 1
);

const WISPS = Array.from(
  { length: WISP_COUNT },
  (_, index) => index + 1
);

const PARTICLES = Array.from(
  { length: PARTICLE_COUNT },
  (_, index) => index + 1
);

const RIPPLES = Array.from(
  { length: RIPPLE_POOL },
  (_, index) => index
);

type QualityTier = "low" | "medium" | "high";

/*
 * Perceptual quality scaling (spec: HIGH more interaction, LOW fewer
 * layers — identity preserved). Deterministic heuristics only.
 */
function resolveQualityTier(): QualityTier {
  if (typeof window === "undefined") {
    return "medium";
  }

  const navigatorWithMemory = window.navigator as Navigator & {
    deviceMemory?: number;
  };

  const deviceMemory = navigatorWithMemory.deviceMemory;

  const coarse =
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    navigator.maxTouchPoints > 0;

  if (
    (typeof deviceMemory === "number" && deviceMemory <= 2) ||
    (coarse && window.innerWidth < 700) ||
    window.innerWidth < 520
  ) {
    return "low";
  }

  if (
    !coarse &&
    window.innerWidth >= 1100 &&
    (deviceMemory === undefined || deviceMemory >= 8)
  ) {
    return "high";
  }

  return "medium";
}

type WorldBackgroundProps = {
  /*
   * Static mood for contexts outside the world shell (the blog uses
   * "archive"). The shell drives the mood through world signals
   * instead and ignores this prop.
   */
  mood?: string;
};

export default function WorldBackground({
  mood
}: WorldBackgroundProps) {
  const rootRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const rippleHostRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /*
   * Static contexts (blog) set the mood once via prop; the shell
   * context updates it through signals. Applied in an effect so the
   * attribute never participates in hydration. A static mood also
   * WINS over signal-driven moods: the blog has no scene navigation,
   * so the module default must not overwrite it.
   */
  const moodRef = useRef<string | undefined>(mood);

  useEffect(() => {
    const root =
      rootRef.current;

    if (!root || !mood) {
      return;
    }

    root.dataset.scene = mood;
  }, [mood]);

  useEffect(() => {
    const root =
      rootRef.current;

    if (!root) {
      return;
    }

    /* ---------------------------------------------------------------- */
    /* Controller state — allocated once per mount                       */
    /* ---------------------------------------------------------------- */

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    let reducedMotion =
      reducedMotionQuery.matches;

    let quality =
      resolveQualityTier();

    let energy = 0;

    let targetPointerX = 0;

    let targetPointerY = 0;

    let pointerX = 0;

    let pointerY = 0;

    let pointerEverMoved = false;

    let lastActivityAt = 0;

    let animationFrame = 0;

    let running = false;

    let seenPulseToken = getPulseToken();

    let seenClickToken = 0;

    let rippleIndex = 0;

    let pulseTimeout = 0;

    /*
     * Per-ripple animation-restart timers (one 16 ms re-add per
     * trigger). Tracked and cancelled on unmount like every other
     * timer in this effect — previously the re-add could fire against
     * a detached pooled element after teardown.
     */
    const rippleTimeouts = new Set<number>();

    let lastWrittenEnergy = -1;

    let lastWrittenX = -1;

    let lastWrittenY = -1;

    /* ---------------------------------------------------------------- */
    /* Rendering helpers — CSS variable writes only, epsilon-gated       */
    /* ---------------------------------------------------------------- */

    const writeEnergy = () => {
      const rounded =
        Math.round(energy * 100) / 100;

      if (rounded !== lastWrittenEnergy) {
        lastWrittenEnergy = rounded;

        root.style.setProperty(
          "--organism-energy",
          `${rounded}`
        );
      }
    };

    const writePointer = () => {
      const x =
        Math.round(pointerX);

      const y =
        Math.round(pointerY);

      if (x !== lastWrittenX) {
        lastWrittenX = x;

        root.style.setProperty(
          "--organism-pointer-x",
          `${x}px`
        );
      }

      if (y !== lastWrittenY) {
        lastWrittenY = y;

        root.style.setProperty(
          "--organism-pointer-y",
          `${y}px`
        );
      }
    };

    const spawnRipple = (x: number, y: number) => {
      if (reducedMotion || quality === "low") {
        return;
      }

      /*
       * Shared-budget coordination: when the interactive organism is
       * already visibly responding to this pointer, its own shockwaves
       * carry the gesture; a background ripple would duplicate the
       * same visual signal in a cheaper dialect.
       */
      if (getOrganismActivity() >= ORGANISM_ACTIVE_BACKOFF) {
        return;
      }

      const host =
        rippleHostRef.current;

      if (!host) {
        return;
      }

      const ripple =
        host.children[
          rippleIndex % host.children.length
        ] as HTMLElement | undefined;

      if (!ripple) {
        return;
      }

      rippleIndex += 1;

      ripple.style.setProperty(
        "--ripple-x",
        `${x}px`
      );

      ripple.style.setProperty(
        "--ripple-y",
        `${y}px`
      );

      /*
       * Restart the pooled element's animation without forcing layout
       * with offsetWidth reads: the animation is keyed by data-active
       * toggling between two identical states, retriggered via the
       * animation-name swap trick. Cheap and deterministic.
       */
      ripple.classList.remove(
        styles.isRippling
      );

      const rippleTimer = window.setTimeout(
        () => {
          rippleTimeouts.delete(
            rippleTimer
          );

          ripple.classList.add(
            styles.isRippling
          );
        },
        16
      );

      rippleTimeouts.add(
        rippleTimer
      );
    };

    const playPulse = () => {
      if (reducedMotion || quality === "low") {
        return;
      }

      root.dataset.pulse = "true";

      window.clearTimeout(pulseTimeout);

      pulseTimeout = window.setTimeout(() => {
        delete root.dataset.pulse;
      }, PULSE_ANIMATION_MS);
    };

    /* ---------------------------------------------------------------- */
    /* The single organism loop — self-suspending                        */
    /* ---------------------------------------------------------------- */

    const tick = () => {
      animationFrame = 0;

      if (reducedMotion || isWorldHidden()) {
        running = false;

        return;
      }

      const now =
        performance.now();

      const previousX = pointerX;

      const previousY = pointerY;

      pointerX +=
        (targetPointerX - pointerX) *
        POINTER_LERP;

      pointerY +=
        (targetPointerY - pointerY) *
        POINTER_LERP;

      const pointerSpeed = Math.abs(
        pointerX - previousX
      ) + Math.abs(
        pointerY - previousY
      );

      /*
       * Hard ceiling: bursts of fast movement may accumulate energy
       * quickly, but the organism never exceeds full saturation.
       */
      /*
       * Shared-budget gain (Runtime v2): the ambient layer's pointer
       * gain scales down while the interactive canvas organism is
       * awake — the same pointer signal is not amplified twice.
       */
      const coordinatedGain =
        ENERGY_GAIN *
        (1 -
          getOrganismActivity() *
            (1 - ORGANISM_ACTIVE_GAIN_SCALE));

      energy = Math.min(
        1,
        energy + pointerSpeed * coordinatedGain
      );

      const baseline =
        BASE_ENERGY[
          root.dataset.scene ??
            "home"
        ] ?? 0.08;

      const decayed =
        energy * ENERGY_DECAY;

      energy =
        decayed < baseline
          ? baseline + (decayed - baseline) * 0.5
          : decayed;

      if (energy < ENERGY_EPSILON) {
        energy = 0;
      }

      writeEnergy();

      if (pointerEverMoved) {
        writePointer();
      }

      const idle =
        now - lastActivityAt >
          LOOP_IDLE_SLEEP_MS &&
        energy <=
          BASE_ENERGY[
            root.dataset.scene ?? "home"
          ] + 0.001;

      if (idle) {
        running = false;

        return;
      }

      animationFrame =
        window.requestAnimationFrame(
          tick
        );
    };

    const ensureLoop = () => {
      if (
        running ||
        reducedMotion ||
        isWorldHidden()
      ) {
        return;
      }

      running = true;

      animationFrame =
        window.requestAnimationFrame(
          tick
        );
    };

    /* ---------------------------------------------------------------- */
    /* Inputs — lightweight, passive, coalesced                          */
    /* ---------------------------------------------------------------- */

    const handlePointerMove = (event: PointerEvent) => {
      targetPointerX = event.clientX;

      targetPointerY = event.clientY;

      pointerEverMoved = true;

      lastActivityAt = performance.now();

      noteWorldPointerMove(
        event.clientX,
        event.clientY
      );

      ensureLoop();
    };

    const handlePointerDown = (event: PointerEvent) => {
      lastActivityAt = performance.now();

      energy = Math.min(
        1,
        energy + 0.12
      );

      /*
       * noteWorldClick publishes the click event; the subscription
       * below is the SINGLE ripple path (publishing is synchronous),
       * so pooled elements never double-fire.
       */
      noteWorldClick(
        event.clientX,
        event.clientY
      );

      ensureLoop();
    };

    const handleVisibility = () => {
      const hidden =
        document.visibilityState !==
        "visible";

      noteWorldVisibility(hidden);

      root.dataset.hidden =
        hidden ? "true" : "false";

      if (hidden && animationFrame !== 0) {
        window.cancelAnimationFrame(
          animationFrame
        );

        animationFrame = 0;

        running = false;
      }

      if (!hidden) {
        ensureLoop();
      }
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion =
        event.matches;

      root.dataset.reduced =
        reducedMotion ? "true" : "false";

      if (reducedMotion && animationFrame !== 0) {
        window.cancelAnimationFrame(
          animationFrame
        );

        animationFrame = 0;

        running = false;
      }
    };

    const applyQuality = () => {
      quality =
        resolveQualityTier();

      root.dataset.quality = quality;
    };

    const handleResize = () => {
      applyQuality();
    };

    const handleWorldEvent = (event: string) => {
      if (event === "scene") {
        /*
         * Mood changes are pure attribute swaps: the scene mood
         * selectors and the energy baseline read data-scene. A
         * static mood prop (blog "archive") is never overridden.
         */
        if (!moodRef.current) {
          root.dataset.scene =
            getWorldScene();
        }

        return;
      }

      if (event === "pulse") {
        const token =
          getPulseToken();

        if (token !== seenPulseToken) {
          seenPulseToken = token;

          playPulse();
        }

        return;
      }

      if (event === "click") {
        const click =
          getWorldClick();

        if (click.token !== seenClickToken) {
          seenClickToken = click.token;

          spawnRipple(
            click.x,
            click.y
          );
        }

        ensureLoop();
      }
    };

    /* ---------------------------------------------------------------- */
    /* Wiring                                                            */
    /* ---------------------------------------------------------------- */

    root.dataset.scene =
      moodRef.current ??
      getWorldScene();

    root.dataset.quality = quality;

    root.dataset.reduced =
      reducedMotion ? "true" : "false";

    root.dataset.hidden =
      document.visibilityState !== "visible"
        ? "true"
        : "false";

    if (reducedMotion) {
      /*
       * Reduced motion gets calm breathing from CSS only; the
       * interaction loop, ripples, and pulses stay off.
       */
      root.style.setProperty(
        "--organism-energy",
        "0"
      );
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      { passive: true }
    );

    window.addEventListener(
      "pointerdown",
      handlePointerDown,
      { passive: true }
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
      { passive: true }
    );

    reducedMotionQuery.addEventListener(
      "change",
      handleMotionChange
    );

    window.addEventListener(
      "resize",
      handleResize,
      { passive: true }
    );

    const unsubscribeWorld =
      subscribeWorld(handleWorldEvent);

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(
          animationFrame
        );
      }

      window.clearTimeout(pulseTimeout);

      for (const rippleTimer of rippleTimeouts) {
        window.clearTimeout(
          rippleTimer
        );
      }

      rippleTimeouts.clear();

      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      reducedMotionQuery.removeEventListener(
        "change",
        handleMotionChange
      );

      window.removeEventListener(
        "resize",
        handleResize
      );

      unsubscribeWorld();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={
        styles.worldBackground
      }
      aria-hidden="true"
    >
      <div className={styles.redMagicCloud}>
        <div
          className={
            styles.organismAtmosphere
          }
        >
          <div
            className={
              styles.redMagicCloudAura
            }
          />

          <div
            className={`${styles.redMagicCloudMass} ${styles.redMagicCloudMassOne}`}
          />

          <div
            className={`${styles.redMagicCloudMass} ${styles.redMagicCloudMassTwo}`}
          />

          <div
            className={`${styles.redMagicCloudMass} ${styles.redMagicCloudMassThree}`}
          />
        </div>

        <div
          className={
            styles.organismHeart
          }
        >
          <div
            className={
              styles.redMagicCloudCore
            }
          />

          <div
            className={
              styles.redMagicCloudNucleus
            }
          />
        </div>

        <div
          className={
            styles.redMagicCloudRings
          }
        >
          {RINGS.map(
            (ring) => (
              <span
                key={ring}
                className={`${styles.redMagicCloudRing} ${styles[`redMagicCloudRing${ring}`]}`}
              />
            )
          )}
        </div>

        <div
          className={
            styles.redMagicCloudWisps
          }
        >
          {WISPS.map(
            (wisp) => (
              <span
                key={wisp}
                className={`${styles.redMagicCloudWisp} ${styles[`redMagicCloudWisp${wisp}`]}`}
              />
            )
          )}
        </div>

        <div
          className={
            styles.redMagicCloudParticles
          }
        >
          {PARTICLES.map(
            (
              particle,
              index
            ) => (
              <span
                key={particle}
                className={`${styles.redMagicCloudParticle} ${styles[`redMagicCloudParticle${particle}`]}`}
                style={
                  PARTICLE_STYLES[index]
                }
              />
            )
          )}
        </div>

        <div
          className={
            styles.redMagicCloudSparks
          }
        >
          <span
            className={`${styles.redMagicCloudSpark} ${styles.redMagicCloudSparkOne}`}
          />
          <span
            className={`${styles.redMagicCloudSpark} ${styles.redMagicCloudSparkTwo}`}
          />
          <span
            className={`${styles.redMagicCloudSpark} ${styles.redMagicCloudSparkThree}`}
          />
          <span
            className={`${styles.redMagicCloudSpark} ${styles.redMagicCloudSparkFour}`}
          />
          <span
            className={`${styles.redMagicCloudSpark} ${styles.redMagicCloudSparkFive}`}
          />
          <span
            className={`${styles.redMagicCloudSpark} ${styles.redMagicCloudSparkSix}`}
          />
        </div>
      </div>

      {/*
        * Interaction + event layers live at viewport scale (outside the
        * oversized cloud field) so pointer coordinates map 1:1.
        */}
      <div
        className={
          styles.organismPointerField
        }
      />

      {/*
        * RESONANCE (v2.2): two slow energy-scaled rings — the
        * heartbeat's echo in the shell. Invisible while the organism
        * is calm, hidden entirely on low quality / reduced motion.
        */}
      <div
        className={
          styles.organismResonance
        }
        aria-hidden="true"
      >
        <span
          className={`${styles.organismResonanceRing} ${styles.organismResonanceRingOne}`}
        />

        <span
          className={`${styles.organismResonanceRing} ${styles.organismResonanceRingTwo}`}
        />
      </div>

      <div
        ref={rippleHostRef}
        className={
          styles.organismRipples
        }
      >
        {RIPPLES.map(
          (ripple) => (
            <span
              key={ripple}
              className={
                styles.organismRipple
              }
            />
          )
        )}
      </div>

      <div
        className={
          styles.organismPulse
        }
      />

      <div
        className={
          styles.worldBackgroundVignette
        }
      />
    </div>
  );
}
