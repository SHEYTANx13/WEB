export type RedMagicParticleProfile = {
  pointerGain: number;
  particleImpulse: number;
};

export type RedMagicParticle = {
  x: number;
  y: number;

  spawnX: number;
  spawnY: number;

  velocityX: number;
  velocityY: number;

  size: number;

  phase: number;
  drift: number;
  twinkle: number;

  hue: number;
  saturation: number;
  lightness: number;
  hueDrift: number;

  impulseX: number;
  impulseY: number;

  revealable: boolean;
  revealRadius: number;
  revealStrength: number;

  persistentClick: boolean;
  persistentLayoutNormalized: boolean;
};

type Point = {
  x: number;
  y: number;
};

type ParticleRenderOptions = {
  context: CanvasRenderingContext2D;
  particles: RedMagicParticle[];

  width: number;
  height: number;

  centerX: number;
  centerY: number;
  radius: number;

  pointer: Point;
  pointerActive: boolean;
  pointerEnergy: number;
  charge: number;

  profile: RedMagicParticleProfile;

  time: number;
  delta: number;

  reducedMotion: boolean;

  /*
   * RUNTIME V2 SOFT ADAPTATION — `activeLimit` caps how many BASE pool
   * particles update/draw this frame (soft quality adaptation); click
   * particles appended beyond `baseCount` always run so interaction
   * feedback never disappears. Undefined = process everything (the
   * historical behaviour, used by mounts before the first adaptation).
   */
  activeLimit?: number;

  baseCount?: number;
};

type ParticleLayout = {
  width: number;
  height: number;
};

type PersistedClickParticle = {
  x: number;
  y: number;

  velocityX: number;
  velocityY: number;

  impulseX: number;
  impulseY: number;

  size: number;

  phase: number;
  drift: number;
  twinkle: number;

  hue: number;
  saturation: number;
  lightness: number;
  hueDrift: number;

  revealRadius: number;
  revealStrength: number;
};

const TAU =
  Math.PI * 2;

const PARTICLE_WRAP_MARGIN =
  80;

const PARTICLE_EDGE_MIN_ALPHA =
  0.12;

const PARTICLE_MIN_VISIBLE_ALPHA =
  0.008;

const PARTICLE_REVEAL_MIN_ALPHA =
  0.84;

const PARTICLE_REVEAL_DISTANCE_SCALE =
  0.32;

const PARTICLE_REVEAL_DISTANCE_POWER =
  1.75;

const PARTICLE_REVEAL_SIZE_BOOST =
  1.8;

const PARTICLE_REVEAL_BRIGHTNESS =
  24;

const PARTICLE_REVEAL_SATURATION =
  12;

const PARTICLE_REVEALABLE_RATIO =
  0.42;

/*
 * Full particle palette.
 *
 * This was missing from the current deployed file even though
 * createParticles() still references PARTICLE_HUES.
 */
const PARTICLE_HUES = [
  0,
  8,
  22,
  42,
  190,
  212,
  252,
  282,
  315,
  336
];

/*
 * One click-created particle per successful click,
 * with a hard maximum of 100 click-created particles
 * for the current browser tab.
 */
const MAX_PERSISTENT_CLICK_PARTICLES =
  100;

const CLICK_PARTICLE_SESSION_KEY =
  "parsaetak:red-magic:click-particles:v1";

/*
 * WeakMap preserves layout dimensions without introducing
 * React state or per-frame allocations.
 */
const particleLayouts = new WeakMap<
  RedMagicParticle[],
  ParticleLayout
>();

/*
 * Cached tab-scoped persistence state.
 *
 * Nothing here runs inside the normal particle loop.
 */
let persistedClickParticlesCache:
  PersistedClickParticle[] | null =
  null;

let persistedClickParticleCount =
  -1;

let livePersistentClickParticleCount =
  -1;

let persistentClickParticlePending =
  false;

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function smoothstep(
  value: number
) {
  const x =
    clamp(
      value,
      0,
      1
    );

  return (
    x *
    x *
    (3 - 2 * x)
  );
}

function distanceSquared(
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx =
    ax - bx;

  const dy =
    ay - by;

  return (
    dx * dx +
    dy * dy
  );
}

/*
 * PARTICLE COLOR CACHE (v2.2).
 *
 * The particle loop previously built an `hsl(h, s%, l%)` string for
 * every drawn particle on every frame — hundreds of small allocations
 * per frame, multiplied by every animation frame at 90–120 Hz. Colors
 * are now quantized (hue to 3 degrees, saturation/lightness to 3
 * percent — far below perceptual threshold) and resolved through a
 * bounded Map, so steady-state rendering reuses existing strings.
 * The cache key is a packed NUMBER (v3.1.1): even on a cache hit the
 * old `${a},${b},${c}` template key allocated a fresh string per
 * drawn particle per frame, so steady-state rendering was not actually
 * garbage-free. Numeric keys allocate nothing. The cap keeps the
 * cache bounded; an overflow clear is a rare O(1) event, never
 * per-frame work.
 */
const COLOR_STRING_CACHE = new Map<
  number,
  string
>();

const COLOR_CACHE_MAX_ENTRIES =
  4096;

function particleColor(
  hue: number,
  saturation: number,
  lightness: number
) {
  const normalizedHue =
    ((hue % 360) + 360) % 360;

  const hueStep = Math.round(
    normalizedHue / 3
  );

  const saturationStep = Math.round(
    saturation / 3
  );

  const lightnessStep = Math.round(
    lightness / 3
  );

  /*
   * Packed numeric key: hueStep ≤ 120 (6 bits used as 7),
   * saturationStep ≤ 34 (6 bits), lightnessStep ≤ 34 (6 bits).
   * Ranges never overlap, so the mapping is injective.
   */
  const key =
    hueStep * 4096 +
    saturationStep * 64 +
    lightnessStep;

  let color =
    COLOR_STRING_CACHE.get(
      key
    );

  if (color === undefined) {
    if (
      COLOR_STRING_CACHE.size >=
      COLOR_CACHE_MAX_ENTRIES
    ) {
      COLOR_STRING_CACHE.clear();
    }

    color = `hsl(${hueStep * 3}, ${
      saturationStep * 3
    }%, ${lightnessStep}%)`;

    COLOR_STRING_CACHE.set(
      key,
      color
    );
  }

  return color;
}

function createRandomGenerator(
  seed: number
) {
  let state =
    seed >>> 0;

  return () => {
    state =
      (
        state * 1664525 +
        1013904223
      ) >>> 0;

    return (
      state /
      4294967296
    );
  };
}

function getPersistedClickParticles():
  PersistedClickParticle[] {
  if (
    typeof window ===
    "undefined"
  ) {
    return [];
  }

  if (
    persistedClickParticlesCache !==
    null
  ) {
    return (
      persistedClickParticlesCache
    );
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        CLICK_PARTICLE_SESSION_KEY
      );

    if (!raw) {
      persistedClickParticlesCache =
        [];

      persistedClickParticleCount =
        0;

      livePersistentClickParticleCount =
        0;

      return (
        persistedClickParticlesCache
      );
    }

    const parsed =
      JSON.parse(raw) as unknown;

    if (
      !Array.isArray(parsed)
    ) {
      window.sessionStorage.removeItem(
        CLICK_PARTICLE_SESSION_KEY
      );

      persistedClickParticlesCache =
        [];

      persistedClickParticleCount =
        0;

      livePersistentClickParticleCount =
        0;

      return (
        persistedClickParticlesCache
      );
    }

    const result:
      PersistedClickParticle[] =
      [];

    const count =
      Math.min(
        parsed.length,
        MAX_PERSISTENT_CLICK_PARTICLES
      );

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const value =
        parsed[index] as
          | Partial<PersistedClickParticle>
          | null;

      if (
        !value ||
        typeof value.x !== "number" ||
        typeof value.y !== "number" ||
        typeof value.velocityX !== "number" ||
        typeof value.velocityY !== "number" ||
        typeof value.impulseX !== "number" ||
        typeof value.impulseY !== "number" ||
        typeof value.size !== "number" ||
        typeof value.phase !== "number" ||
        typeof value.drift !== "number" ||
        typeof value.twinkle !== "number" ||
        typeof value.hue !== "number" ||
        typeof value.saturation !== "number" ||
        typeof value.lightness !== "number" ||
        typeof value.hueDrift !== "number" ||
        typeof value.revealRadius !== "number" ||
        typeof value.revealStrength !== "number"
      ) {
        continue;
      }

      result.push({
        x:
          clamp(
            value.x,
            -1,
            2
          ),

        y:
          clamp(
            value.y,
            -1,
            2
          ),

        velocityX:
          value.velocityX,

        velocityY:
          value.velocityY,

        impulseX:
          value.impulseX,

        impulseY:
          value.impulseY,

        size:
          value.size,

        phase:
          value.phase,

        drift:
          value.drift,

        twinkle:
          value.twinkle,

        hue:
          value.hue,

        saturation:
          value.saturation,

        lightness:
          value.lightness,

        hueDrift:
          value.hueDrift,

        revealRadius:
          value.revealRadius,

        revealStrength:
          value.revealStrength
      });
    }

    persistedClickParticlesCache =
      result;

    persistedClickParticleCount =
      result.length;

    livePersistentClickParticleCount =
      result.length;

    if (
      result.length ===
      0
    ) {
      window.sessionStorage.removeItem(
        CLICK_PARTICLE_SESSION_KEY
      );
    }

    return result;
  } catch {
    persistedClickParticlesCache =
      [];

    persistedClickParticleCount =
      0;

    livePersistentClickParticleCount =
      0;

    try {
      window.sessionStorage.removeItem(
        CLICK_PARTICLE_SESSION_KEY
      );
    } catch {
      /*
       * Storage may be unavailable.
       * Rendering must continue normally.
       */
    }

    return [];
  }
}

function getPersistentClickParticleCount() {
  if (
    livePersistentClickParticleCount <
    0
  ) {
    getPersistedClickParticles();
  }

  return Math.min(
    livePersistentClickParticleCount,
    MAX_PERSISTENT_CLICK_PARTICLES
  );
}

function persistClickParticles(
  particles: RedMagicParticle[],
  width: number,
  height: number
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const safeWidth =
    Math.max(
      1,
      width
    );

  const safeHeight =
    Math.max(
      1,
      height
    );

  const records:
    PersistedClickParticle[] =
    [];

  for (
    let index = 0;
    index <
    particles.length;
    index += 1
  ) {
    const particle =
      particles[index];

    if (
      !particle.persistentClick
    ) {
      continue;
    }

    if (
      records.length >=
      MAX_PERSISTENT_CLICK_PARTICLES
    ) {
      break;
    }

    records.push({
      x:
        particle.x /
        safeWidth,

      y:
        particle.y /
        safeHeight,

      velocityX:
        particle.velocityX /
        safeWidth,

      velocityY:
        particle.velocityY /
        safeHeight,

      impulseX:
        particle.impulseX /
        safeWidth,

      impulseY:
        particle.impulseY /
        safeHeight,

      size:
        particle.size,

      phase:
        particle.phase,

      drift:
        particle.drift,

      twinkle:
        particle.twinkle,

      hue:
        particle.hue,

      saturation:
        particle.saturation,

      lightness:
        particle.lightness,

      hueDrift:
        particle.hueDrift,

      revealRadius:
        particle.revealRadius,

      revealStrength:
        particle.revealStrength
    });
  }

  if (
    records.length ===
    0
  ) {
    persistedClickParticlesCache =
      [];

    persistedClickParticleCount =
      0;

    try {
      window.sessionStorage.removeItem(
        CLICK_PARTICLE_SESSION_KEY
      );
    } catch {
      /*
       * Ignore unavailable storage.
       */
    }

    return;
  }

  try {
    window.sessionStorage.setItem(
      CLICK_PARTICLE_SESSION_KEY,
      JSON.stringify(
        records
      )
    );

    persistedClickParticlesCache =
      records;

    persistedClickParticleCount =
      records.length;

    livePersistentClickParticleCount =
      Math.max(
        livePersistentClickParticleCount,
        records.length
      );
  } catch {
    /*
     * Storage errors must never interrupt
     * the animation.
     */
  }
}

function restorePersistedClickParticles(
  particles: RedMagicParticle[]
) {
  const persisted =
    getPersistedClickParticles();

  if (
    persisted.length ===
    0
  ) {
    return;
  }

  for (
    let index = 0;
    index <
    persisted.length;
    index += 1
  ) {
    const value =
      persisted[index];

    particles.push({
      x:
        0,

      y:
        0,

      /*
       * Normalized position survives viewport changes.
       */
      spawnX:
        value.x,

      spawnY:
        value.y,

      /*
       * Normalized until first placement.
       */
      velocityX:
        value.velocityX,

      velocityY:
        value.velocityY,

      impulseX:
        value.impulseX,

      impulseY:
        value.impulseY,

      size:
        value.size,

      phase:
        value.phase,

      drift:
        value.drift,

      twinkle:
        value.twinkle,

      hue:
        value.hue,

      saturation:
        value.saturation,

      lightness:
        value.lightness,

      hueDrift:
        value.hueDrift,

      /*
       * Click particles are always visible.
       */
      revealable:
        false,

      revealRadius:
        value.revealRadius,

      revealStrength:
        value.revealStrength,

      persistentClick:
        true,

      persistentLayoutNormalized:
        true
    });
  }
}

export function createPageSeed() {
  const now =
    Date.now();

  const performanceSeed =
    Math.floor(
      performance.now() *
      1000
    );

  return (
    (
      now ^
      performanceSeed ^
      (
        now >>>
        7
      )
    ) >>> 0
  );
}

export function createParticles(
  count: number,
  seed: number
): RedMagicParticle[] {
  /*
   * The current RedMagic click path creates one particle
   * using createParticles(1, seed).
   *
   * The tab-scoped counter prevents remounts from bypassing
   * the lifetime limit.
   */
  if (
    count === 1 &&
    getPersistentClickParticleCount() >=
      MAX_PERSISTENT_CLICK_PARTICLES
  ) {
    return [];
  }

  const random =
    createRandomGenerator(
      seed
    );

  const particles =
    Array.from(
      {
        length:
          count
      },
      () => {
        const baseHue =
          PARTICLE_HUES[
            Math.floor(
              random() *
              PARTICLE_HUES.length
            )
          ];

        return {
          x:
            0,

          y:
            0,

          spawnX:
            random(),

          spawnY:
            random(),

          velocityX:
            (
              random() -
              0.5
            ) *
            0.06,

          velocityY:
            (
              random() -
              0.5
            ) *
            0.06,

          size:
            0.38 +
            random() *
            1.45,

          phase:
            random() *
            TAU,

          drift:
            0.35 +
            random() *
            1.15,

          twinkle:
            0.6 +
            random() *
            1.6,

          hue:
            baseHue +
            (
              random() -
              0.5
            ) *
            12,

          saturation:
            74 +
            random() *
            20,

          lightness:
            58 +
            random() *
            22,

          hueDrift:
            3 +
            random() *
            12,

          impulseX:
            0,

          impulseY:
            0,

          revealable:
            random() <
            PARTICLE_REVEALABLE_RATIO,

          revealRadius:
            0.65 +
            random() *
            0.7,

          revealStrength:
            0.55 +
            random() *
            0.75,

          persistentClick:
            count === 1,

          persistentLayoutNormalized:
            false
        };
      }
    );

  if (
    count === 1
  ) {
    /*
     * Increment the lifetime counter before returning the
     * new particle so the component cannot create a 101st
     * click particle.
     */
    livePersistentClickParticleCount =
      Math.min(
        livePersistentClickParticleCount +
        1,
        MAX_PERSISTENT_CLICK_PARTICLES
      );

    /*
     * The click handler supplies the final click position
     * immediately after this function returns.
     *
     * Persistence is therefore deferred until the next
     * particle-render call.
     */
    persistentClickParticlePending =
      true;
  } else if (
    count > 1
  ) {
    /*
     * Normal world initialization restores click particles
     * already stored for this browser tab.
     */
    restorePersistedClickParticles(
      particles
    );
  }

  return particles;
}

export function placeParticles(
  particles: RedMagicParticle[],
  width: number,
  height: number
) {
  const safeWidth =
    Math.max(
      1,
      width
    );

  const safeHeight =
    Math.max(
      1,
      height
    );

  const previous =
    particleLayouts.get(
      particles
    );

  /*
   * First placement.
   */
  if (
    !previous ||
    previous.width <= 0 ||
    previous.height <= 0
  ) {
    for (
      let index = 0;
      index <
      particles.length;
      index += 1
    ) {
      const particle =
        particles[index];

      particle.x =
        particle.spawnX *
        safeWidth;

      particle.y =
        particle.spawnY *
        safeHeight;

      /*
       * Restored particles carry normalized velocity/impulse
       * until this first placement establishes the real size.
       */
      if (
        particle.persistentClick &&
        particle.persistentLayoutNormalized
      ) {
        particle.velocityX *=
          safeWidth;

        particle.velocityY *=
          safeHeight;

        particle.impulseX *=
          safeWidth;

        particle.impulseY *=
          safeHeight;

        particle.persistentLayoutNormalized =
          false;
      }
    }
  } else {
    /*
     * Preserve the existing live particle field through resize.
     */
    const scaleX =
      safeWidth /
      previous.width;

    const scaleY =
      safeHeight /
      previous.height;

    if (
      Math.abs(
        scaleX - 1
      ) > 0.0001 ||
      Math.abs(
        scaleY - 1
      ) > 0.0001
    ) {
      for (
        let index = 0;
        index <
        particles.length;
        index += 1
      ) {
        const particle =
          particles[index];

        particle.x *=
          scaleX;

        particle.y *=
          scaleY;

        particle.velocityX *=
          scaleX;

        particle.velocityY *=
          scaleY;

        particle.impulseX *=
          scaleX;

        particle.impulseY *=
          scaleY;
      }
    }
  }

  particleLayouts.set(
    particles,
    {
      width:
        safeWidth,

      height:
        safeHeight
    }
  );
}

export function updateAndDrawParticles(
  options: ParticleRenderOptions
) {
  const {
    context,
    particles,

    width,
    height,

    centerX,
    centerY,
    radius,

    pointer,
    pointerActive,
    pointerEnergy,
    charge,

    profile,

    time,
    delta,

    reducedMotion,

    activeLimit,

    baseCount
  } =
    options;

  /*
   * Soft-adaptation particle cap: base-pool particles with an index at
   * or beyond the limit are skipped entirely (update AND draw); click
   * particles beyond baseCount always process. When no limit is given
   * every particle processes — identical to the pre-v2 behaviour.
   */
  const limitBaseAt =
    typeof activeLimit ===
      "number" &&
    typeof baseCount ===
      "number"
      ? Math.max(
          0,
          activeLimit
        )
      : particles.length;

  const baseBoundary =
    typeof baseCount ===
      "number"
      ? baseCount
      : 0;

  /*
   * Maintain the existing frame-rate-independent
   * simulation scaling.
   */
  const deltaScale =
    clamp(
      delta / 16,
      0.25,
      2
    );

  const impulseDecay =
    Math.pow(
      0.91,
      deltaScale
    );

  const damping =
    Math.pow(
      0.985,
      deltaScale
    );

  const driftTime =
    reducedMotion
      ? 0
      : time;

  const revealBaseRadius =
    Math.min(
      width,
      height
    ) *
    PARTICLE_REVEAL_DISTANCE_SCALE;

  const influenceRadius =
    radius *
    0.62;

  const influenceRadiusSquared =
    influenceRadius *
    influenceRadius;

  const pointerVisible =
    pointerActive &&
    !reducedMotion;

  const pointerX =
    pointer.x;

  const pointerY =
    pointer.y;

  /*
   * V2.1 MICRO-COST REMOVAL: the normalized-center distance divided the
   * half-extents for EVERY particle — with Math.max(width*0.5, 1)
   * re-evaluated per particle and Math.hypot (which V8 implements far
   * slower than a plain sqrt for two arguments). The half-extents are
   * frame-uniform; hypot -> sqrt(dx*dx + dy*dy) is numerically
   * equivalent at these magnitudes (no overflow domain) and measured
   * materially faster in the repo micro-benchmark
   * (scripts/bench-redmagic.mjs).
   */
  const halfWidth =
    Math.max(
      width * 0.5,
      1
    );

  const halfHeight =
    Math.max(
      height * 0.5,
      1
    );


  /*
   * Persistence only occurs after an actual new click.
   *
   * It is deliberately outside the hot particle loop.
   */
  if (
    persistentClickParticlePending
  ) {
    persistClickParticles(
      particles,
      width,
      height
    );

    persistentClickParticlePending =
      false;
  }

  context.globalAlpha =
    1;

  for (
    let index = 0;
    index <
    particles.length;
    index += 1
  ) {
    /*
     * Runtime v2 soft adaptation: base-pool particles at or beyond the
     * active limit skip both update and draw; click particles (index
     * beyond baseCount) always process so interaction feedback stays.
     */
    if (
      index <
        baseBoundary &&
      index >=
        limitBaseAt
    ) {
      continue;
    }

    const particle =
      particles[index];

    particle.impulseX *=
      impulseDecay;

    particle.impulseY *=
      impulseDecay;

    const waveX =
      reducedMotion
        ? 0
        : Math.sin(
            driftTime *
              0.0009 *
              particle.drift +
              particle.phase
          ) *
          0.0028;

    const waveY =
      reducedMotion
        ? 0
        : Math.cos(
            driftTime *
              0.0009 *
              (
                particle.drift *
                0.82
              ) +
              particle.phase *
                1.37
          ) *
          0.0028;

    particle.velocityX +=
      waveX *
      deltaScale;

    particle.velocityY +=
      waveY *
      deltaScale;

    particle.velocityX *=
      damping;

    particle.velocityY *=
      damping;

    particle.x +=
      particle.velocityX *
      deltaScale;

    particle.y +=
      particle.velocityY *
      deltaScale;

    particle.x +=
      particle.impulseX *
      0.003 *
      deltaScale;

    particle.y +=
      particle.impulseY *
      0.003 *
      deltaScale;

    /*
     * Continuous wrapping.
     */
    if (
      particle.x <
      -PARTICLE_WRAP_MARGIN
    ) {
      particle.x =
        width +
        PARTICLE_WRAP_MARGIN;
    } else if (
      particle.x >
      width +
      PARTICLE_WRAP_MARGIN
    ) {
      particle.x =
        -PARTICLE_WRAP_MARGIN;
    }

    if (
      particle.y <
      -PARTICLE_WRAP_MARGIN
    ) {
      particle.y =
        height +
        PARTICLE_WRAP_MARGIN;
    } else if (
      particle.y >
      height +
      PARTICLE_WRAP_MARGIN
    ) {
      particle.y =
        -PARTICLE_WRAP_MARGIN;
    }

    const centerDx =
      (particle.x -
        centerX) /
      halfWidth;

    const centerDy =
      (particle.y -
        centerY) /
      halfHeight;

    const normalizedCenterDistance =
      Math.min(
        1.6,
        Math.sqrt(
          centerDx *
            centerDx +
          centerDy *
            centerDy
        )
      );

    const centerVisibility =
      clamp(
        1 -
          normalizedCenterDistance *
          0.45,

        PARTICLE_EDGE_MIN_ALPHA,

        1
      );

    /*
     * Calculate pointer distance once.
     */
    const pointerDistanceSquared =
      pointerVisible
        ? distanceSquared(
            pointerX,
            pointerY,
            particle.x,
            particle.y
          )
        : Number.POSITIVE_INFINITY;

    let pointerDistance =
      0;

    let mouseReveal =
      0;

    if (
      pointerVisible
    ) {
      const revealRadius =
        revealBaseRadius *
        particle.revealRadius;

      const revealRadiusSquared =
        revealRadius *
        revealRadius;

      const needsPointerDistance =
        pointerDistanceSquared <
          revealRadiusSquared ||
        pointerDistanceSquared <
          influenceRadiusSquared;

      if (
        needsPointerDistance
      ) {
        pointerDistance =
          Math.sqrt(
            pointerDistanceSquared
          );
      }

      /*
       * Normal ambient particles can reveal/disappear.
       * Click-created particles remain visible.
       */
      if (
        particle.revealable &&
        pointerDistanceSquared <
          revealRadiusSquared
      ) {
        const normalizedDistance =
          clamp(
            pointerDistance /
              revealRadius,
            0,
            1
          );

        mouseReveal =
          Math.pow(
            1 -
              smoothstep(
                normalizedDistance
              ),
            PARTICLE_REVEAL_DISTANCE_POWER
          ) *
          particle.revealStrength;
      }
    }

    if (
      particle.revealable &&
      mouseReveal <=
        PARTICLE_MIN_VISIBLE_ALPHA
    ) {
      continue;
    }

    let interactionVisibility =
      0;

    if (
      pointerVisible &&
      pointerDistanceSquared <
        influenceRadiusSquared
    ) {
      interactionVisibility =
        smoothstep(
          1 -
            pointerDistance /
              influenceRadius
        ) *
        profile.pointerGain;
    }

    const twinkle =
      0.82 +
      Math.sin(
        driftTime *
          0.0025 *
          particle.twinkle +
          particle.phase
      ) *
      0.18;

    const revealIntensity =
      clamp(
        mouseReveal,
        0,
        1
      );

    const normalSize =
      particle.size *
      (
        0.5 +
        centerVisibility *
        0.5
      );

    const revealSize =
      normalSize *
      (
        1 +
        revealIntensity *
        (
          PARTICLE_REVEAL_SIZE_BOOST -
          1
        )
      );

    const size =
      revealSize *
      (
        1 +
        interactionVisibility *
        0.7 +
        charge *
        0.12
      );

    const ambientAlpha =
      particle.revealable
        ? 0
        : (
            0.15 +
            centerVisibility *
            0.85
          );

    const revealAlpha =
      particle.revealable
        ? (
            PARTICLE_REVEAL_MIN_ALPHA +
            revealIntensity *
            (
              1 -
              PARTICLE_REVEAL_MIN_ALPHA
            )
          )
        : 1;

    const interactionAlpha =
      1 +
      interactionVisibility *
      0.45;

    const alpha =
      (
        0.22 +
        pointerEnergy *
        0.08 +
        charge *
        0.06
      ) *
      ambientAlpha *
      revealAlpha *
      interactionAlpha *
      twinkle;

    if (
      alpha <=
      PARTICLE_MIN_VISIBLE_ALPHA
    ) {
      continue;
    }

    const hue =
      (
        particle.hue +
        Math.sin(
          driftTime *
            0.00055 +
          particle.phase
        ) *
        particle.hueDrift
      ) %
      360;

    const saturation =
      clamp(
        particle.saturation +
          revealIntensity *
          PARTICLE_REVEAL_SATURATION,
        55,
        100
      );

    const lightness =
      clamp(
        particle.lightness +
          revealIntensity *
          PARTICLE_REVEAL_BRIGHTNESS,
        40,
        96
      );

    context.globalAlpha =
      clamp(
        alpha,
        PARTICLE_MIN_VISIBLE_ALPHA,
        1
      );

    context.fillStyle =
      particleColor(
        hue,
        saturation,
        lightness
      );

    context.beginPath();

    context.arc(
      particle.x,
      particle.y,
      Math.max(
        0.35,
        size
      ),
      0,
      TAU
    );

    context.fill();

    /*
     * Small hot center for revealed particles.
     */
    if (
      revealIntensity >
      0.16
    ) {
      const coreSize =
        Math.max(
          0.35,
          size *
          (
            0.28 +
            revealIntensity *
            0.3
          )
        );

      context.globalAlpha =
        clamp(
          context.globalAlpha *
            (
              0.65 +
              revealIntensity *
              0.35
            ),
          PARTICLE_MIN_VISIBLE_ALPHA,
          1
        );

      context.fillStyle =
        "rgba(255, 245, 238, 0.96)";

      context.beginPath();

      context.arc(
        particle.x,
        particle.y,
        coreSize,
        0,
        TAU
      );

      context.fill();
    }
  }

  context.globalAlpha =
    1;
}
