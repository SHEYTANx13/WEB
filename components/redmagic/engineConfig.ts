/*
 * RED MAGIC ENGINE CONFIG (Runtime v2) — pure configuration and policy
 * for the living organism's unified visual/CPU budget.
 *
 * This module is deliberately free of React, DOM and canvas code so the
 * budget rules, the runtime-state model, the adaptive-DPR policy, the
 * refresh-rate estimator and the interaction-energy signal model can be
 * reasoned about (and tested) independently of the engine in
 * RedMagic.tsx (orchestrator + hot path). The engine imports these
 * values and policies; it never redefines them locally.
 *
 * UNIFIED BUDGET LAW: core, network, membrane, particles, energy flows
 * and atmosphere/background effects are ONE coordinated budget. A tier
 * is not a label — it is a concrete allocation of per-frame work across
 * every layer. Quality changes must reduce (or restore) actual work.
 *
 * TWO-LEVEL ADAPTATION:
 * - SOFT (immediate): reduce the cheapest expensive layers first —
 *   active particle count, flow density, membrane draw stride, node-glow
 *   floor, secondary atmosphere passes. No structural rebuild, no pool
 *   reallocation, safe inside the hot path's frame.
 * - HARD (controlled): rebuild expensive structures — grid, membrane
 *   boundary, particle pools, edge/influence tables. Only after
 *   SUSTAINED degradation, on a settled frame (no active pointer
 *   interaction, no live shockwaves), never every frame.
 */

export type QualityName =
  | "high"
  | "medium"
  | "low";

/**
 * One tier = one coordinated allocation across all six layers of the
 * organism. `gridSize`, `particles`, `membraneSteps`, `flowCount` and
 * `flowSegments` are the historical v3.x knobs; `atmosphere` (0..1)
 * gates secondary glow/atmosphere passes and `nodeGlowFloor` raises the
 * minimum node energy that earns a glow sprite on constrained tiers.
 */
export type QualityBudget = {
  /** Network extent (gridSize² cells inside the unit circle). */
  gridSize: number;

  /** Base particle pool size (soft adaptation may draw fewer). */
  particles: number;

  /** Membrane boundary resolution (points around the star field). */
  membraneSteps: number;

  /** Energy-flow curve count. */
  flowCount: number;

  /** Points per energy-flow curve. */
  flowSegments: number;

  /** 0..1 allowance for secondary atmosphere/glow passes. */
  atmosphere: number;

  /** Minimum node energy that earns a glow pass at this tier. */
  nodeGlowFloor: number;
};

export const QUALITY_BUDGETS: Record<
  QualityName,
  QualityBudget
> = {
  high: {
    gridSize: 8,
    particles: 112,
    membraneSteps: 180,
    flowCount: 7,
    flowSegments: 28,
    atmosphere: 1,
    nodeGlowFloor: 0.018
  },

  medium: {
    gridSize: 7,
    particles: 76,
    membraneSteps: 132,
    flowCount: 5,
    flowSegments: 22,
    atmosphere: 0.8,
    nodeGlowFloor: 0.026
  },

  low: {
    gridSize: 6,
    particles: 42,
    membraneSteps: 90,
    flowCount: 4,
    flowSegments: 17,
    atmosphere: 0.55,
    nodeGlowFloor: 0.038
  }
};

/** Soft adaptation never starves the organism below this pool fraction. */
export const SOFT_PARTICLE_FLOOR = 0.55;

/*
 * RUNTIME STATES — explicit cadence model (Runtime v2).
 *
 * reduced    reduced-motion preference: one static frame, no loop
 * suspended  canvas offscreen or document hidden: no work at all
 * idle       no pointer intent (or a pointer resting still for a while)
 *            and settled energy: capped redraw rate, reduced simulation
 * ambient    organism awake at low energy: full redraw, moderate sim
 * active     pointer interaction: full redraw, full simulation
 * recovery   quality recently changed: full cadence held stable while
 *            the new budget settles (no further adaptation decisions)
 */
export type RuntimeState =
  | "reduced"
  | "suspended"
  | "idle"
  | "ambient"
  | "active"
  | "recovery";

/** Simulation time scale per state (active = 1). */
export const STATE_SIMULATION_SCALE: Record<
  RuntimeState,
  number
> = {
  reduced: 0,
  suspended: 0,
  idle: 0.32,
  ambient: 0.66,
  active: 1,
  recovery: 0.9
};

/**
 * Window without pointer movement after which a present-but-still
 * pointer falls into the idle cadence (mirrors IDLE_CADENCE_DELAY_MS).
 */
export const STILL_POINTER_IDLE_MS = 4000;

/** Energy below which a resting pointer counts as settled for idle. */
export const SETTLED_ENERGY = 0.14;

/**
 * INTERACTION SIGNAL MODEL (Runtime v2).
 *
 * The organism's arousal is a continuous function of measurable signals,
 * not a binary "pointer exists = maximum energy" switch:
 * - proximity   0..1, pointer closeness to the organism's centre
 * - speed       smoothed pointer speed, normalised by the engine
 * - dwell       0..1 presence built up over sustained contact
 * - memory      0..1 decaying afterglow of recent impulses
 * - charge      click/hold charge contribution
 */
export type InteractionSignals = {
  proximity: number;
  speed: number;
  dwell: number;
  memory: number;
  charge: number;
};

/** Pointer speed (px/s) that saturates the speed signal. */
export const SPEED_SATURATION_PX_S = 900;

/** Presence (ms of sustained nearby contact) that saturates dwell. */
export const DWELL_SATURATION_MS = 4000;

/**
 * Continuous target energy from interaction signals. Deterministic: the
 * same signal values always produce the same target. Weights are the
 * organism's temperament — proximity alone wakes but never saturates it;
 * speed dominates; charge (a deliberate act) earns the most.
 */
export function interactionTargetEnergy(
  signals: InteractionSignals
): number {
  const proximity =
    clamp01(signals.proximity) * 0.3;

  const speed =
    clamp01(signals.speed) * 0.36;

  const dwell =
    clamp01(signals.dwell) * 0.14;

  const memory =
    clamp01(signals.memory) * 0.2;

  const charge =
    clamp01(signals.charge) * 0.42;

  return clamp01(
    proximity + speed + dwell + memory + charge
  );
}

/*
 * ADAPTIVE DPR POLICY (Runtime v2).
 *
 * DPR is no longer one global constant. The target resolution derives
 * from canvas area, active quality and device constraints, with a safe
 * absolute upper bound. The engine applies the policy debounced: a
 * change only lands when it is meaningful (>= DPR_MIN_STEP), not more
 * often than DPR_CHANGE_DEBOUNCE_MS, and never on a hot interaction
 * frame — resolution switches happen on settled frames only.
 */
export const MAX_DPR = 2;

export const DPR_CHANGE_DEBOUNCE_MS = 2500;

export const DPR_MIN_STEP = 0.25;

/** Canvas area (CSS px²) above which 2× resolution buys little. */
export const LARGE_AREA_PX = 600_000;

export type DprPolicyInput = {
  deviceDpr: number;

  /** CSS pixel area of the canvas. */
  area: number;

  quality: QualityName;

  /**
   * Ratio of sustained fps to the measured refresh rate (1 = native).
   * Below 0.8 the policy holds the current DPR instead of raising it —
   * the quality controller owns degradation; DPR must not fight it.
   */
  performanceRatio: number;

  currentDpr: number;

  /** Timestamp of the last applied DPR change (performance.now()). */
  lastChangeAt: number;

  now: number;
};

/** Highest DPR the policy allows for a given quality tier and area. */
export function dprCeilingFor(
  quality: QualityName,
  area: number
): number {
  const tierCeiling =
    quality === "high"
      ? 2
      : quality === "medium"
        ? 1.75
        : 1.5;

  const areaCeiling =
    area > LARGE_AREA_PX ? 1.75 : 2;

  return Math.min(tierCeiling, areaCeiling);
}

/**
 * Resolve the DPR target for this frame. Returns the CURRENT dpr when
 * the policy declines to change (debounce window, sub-step delta,
 * degraded performance, or the target already matches).
 */
export function resolveAdaptiveDpr(
  input: DprPolicyInput
): number {
  const deviceDpr =
    input.deviceDpr > 0 ? input.deviceDpr : 1;

  const ceiling = dprCeilingFor(
    input.quality,
    input.area
  );

  const target = Math.min(
    deviceDpr,
    MAX_DPR,
    ceiling
  );

  if (target === input.currentDpr) {
    return input.currentDpr;
  }

  /*
   * Never RAISE resolution while the engine is failing to hold its
   * current frame rate — that is the quality controller's call, and
   * the two mechanisms must not fight each other.
   */
  if (
    target >
      input.currentDpr &&
    input.performanceRatio >
      0 &&
    input.performanceRatio <
      0.8
  ) {
    return input.currentDpr;
  }

  const delta = Math.abs(
    target - input.currentDpr
  );

  if (delta < DPR_MIN_STEP) {
    return input.currentDpr;
  }

  if (
    input.lastChangeAt >
      0 &&
    input.now - input.lastChangeAt <
      DPR_CHANGE_DEBOUNCE_MS
  ) {
    return input.currentDpr;
  }

  return target;
}

/*
 * MEASURED-PRESSURE DPR POLICY (Runtime v2.1).
 *
 * Before v2.1 the adaptive DPR was evaluated ONLY on resize events: a
 * sustained CPU/GPU load could degrade frame rate for minutes and the
 * backing-store resolution never responded, because no geometry change
 * ever arrived. The policy below runs on PERFORMANCE MEASUREMENT
 * boundaries (the ~1.8 s sampling windows) instead:
 *
 * - SUSTAINED degradation (the same two-window evidence the quality
 *   controller uses to demote a tier) lowers the pressure ceiling one
 *   coarse step (0.5) — real fill-rate work reduction, cheaper and
 *   faster to reverse than a structural rebuild.
 * - SUSTAINED recovery (three good windows AND a measured
 *   fps/refresh ratio ≥ DPR_RECOVERY_RATIO) restores the ceiling one
 *   fine step (0.25), never while the ratio is unknown or poor.
 * - Every change is debounced by DPR_CHANGE_DEBOUNCE_MS and bounded by
 *   the tier/area ceiling from dprCeilingFor — pressure can only lower
 *   what the static policy would allow, never raise past it.
 * - A DPR switch is a structural event: the engine resets the
 *   performance sampling window and the refresh window (a resolution
 *   change invalidates both), so the next window measures the new
 *   resolution cleanly and cannot oscillate on stale numbers.
 */
export const DPR_PRESSURE_STEP = 0.5;

export const DPR_RECOVERY_STEP = 0.25;

export const DPR_RECOVERY_RATIO = 0.85;

export type DprPressureInput = {
  currentDpr: number;

  /** Static ceiling for the active tier/area (dprCeilingFor). */
  ceiling: number;

  deviceDpr: number;

  /** Two consecutive bad windows (quality-demotion evidence). */
  sustainedPoor: boolean;

  /** Three consecutive good windows. */
  sustainedRecovery: boolean;

  /** fps / refresh estimate (0 = unknown). */
  performanceRatio: number;

  /** performance.now() of the last applied DPR change. */
  lastChangeAt: number;

  now: number;
};

/** Lower bound for the pressure path — never below 1× resolution. */
export const DPR_FLOOR = 1;

/**
 * Resolve the pressure-adjusted DPR target. Returns the CURRENT dpr
 * when the policy declines to change.
 */
export function resolvePressureDpr(
  input: DprPressureInput
): number {
  if (
    input.lastChangeAt >
      0 &&
    input.now - input.lastChangeAt <
      DPR_CHANGE_DEBOUNCE_MS
  ) {
    return input.currentDpr;
  }

  if (
    input.sustainedPoor &&
    input.currentDpr >
      DPR_FLOOR
  ) {
    return Math.max(
      DPR_FLOOR,

      input.currentDpr -
        DPR_PRESSURE_STEP
    );
  }

  if (input.sustainedRecovery) {
    /*
     * Restore only on sustained recovery with a known, healthy
     * measured ratio — and never past the static ceiling.
     */
    if (
      input.performanceRatio >
        0 &&
      input.performanceRatio >=
        DPR_RECOVERY_RATIO
    ) {
      const target = Math.min(
        input.ceiling,
        input.deviceDpr > 0
          ? input.deviceDpr
          : 1,
        MAX_DPR
      );

      if (
        target >
        input.currentDpr +
          (DPR_RECOVERY_STEP -
            0.01)
      ) {
        return Math.min(
          target,

          input.currentDpr +
            DPR_RECOVERY_STEP
        );
      }
    }
  }

  return input.currentDpr;
}

/*
 * HARD-REBUILD SETTLE PREDICATE (Runtime v2.1).
 *
 * A structural rebuild executes only on a settled frame. Pre-v2.1 the
 * predicate required the pointer to have LEFT the canvas, so a pointer
 * resting motionless on the organism — stillness threshold passed,
 * interaction energy settled — kept every pending rebuild waiting
 * forever (measured: no rebuild within 15 s of stillness; the 12 s
 * timeout only relaxed the cadence gate, not the settle predicate).
 * The still-pointer idle model already defines "settled": once the
 * pointer has crossed STILL_POINTER_IDLE_MS without movement and its
 * energy fell under SETTLED_ENERGY, it is as settled as an absent
 * pointer. The predicate below accepts both.
 */
export function isSettledFrame(
  /** Pointer currently on the canvas. */
  pointerActive: boolean,

  /** Stillness + settled-energy thresholds both passed. */
  pointerStillIdle: boolean,

  /** Live shockwaves. */
  shockwaveCount: number,

  /** Interaction turbulence (settles under 0.01). */
  turbulence: number,

  /** Transient click particles still in flight. */
  clickParticleCount: number
): boolean {
  /*
   * Positional parameters, not an input record: the gate runs every
   * frame while a rebuild is pending and must not allocate.
   */
  return (
    (!pointerActive ||
      pointerStillIdle) &&
    shockwaveCount ===
      0 &&
    turbulence <
      0.01 &&
    clickParticleCount ===
      0
  );
}

/*
 * REFRESH-RATE ESTIMATION (Runtime v2, hardened in v2.1).
 *
 * The browser does not expose the display's native refresh rate, but
 * requestAnimationFrame delivers frames at that rate, so the fastest
 * SUSTAINED inter-frame interval IS the native interval. The estimator:
 * - initialises conservatively at 0 (unknown → relative thresholds use
 *   conservative fallback lines),
 * - adopts a window only when it is SUSTAINED faster (3% above the
 *   current estimate) — scheduling jitter cannot manufacture a boost,
 * - decays: if observed windows run at less than half the estimate for
 *   VALIDATION_WINDOWS consecutive windows (a display-context change —
 *   monitor switch, power-saving throttle — not transient jank), the
 *   estimate resets to the observed rate,
 * - suspends cleanly: hidden tabs and idle-cadence gaps produce no
 *   deltas at all, so windows reopen fresh instead of trusting stale
 *   fast numbers.
 *
 * V2.1 HARDENING — the window's representative interval is no longer
 * the raw MINIMUM. A single unusually-short RAF interval (a double
 * commit, a timer glitch) used to poison the whole window and could
 * pin the estimate at a phantom 200+ Hz, which then permanently
 * depressed the relative quality thresholds. Valid raw deltas are now
 * collected into a bounded, allocation-free typed-array buffer (reused
 * across windows) and the representative is the ~5th-percentile delta
 * (partial selection, no sort, no allocation): a handful of outlier
 * intervals can no longer define the display. Sampling also resets on
 * real geometry/DPR changes (see the engine's resize/applyDpr paths)
 * — a resolution switch invalidates the open window.
 */
export const REFRESH_VALIDATION_WINDOWS = 6;

/** Bounded per-window raw-delta buffer (240 Hz × 1.8 s ≈ 432 + headroom). */
export const REFRESH_SAMPLE_CAPACITY = 600;

/** Windows with fewer valid deltas than this report "no estimate". */
export const REFRESH_MIN_SAMPLES = 8;

/** Representative = this percentile of the window's valid deltas. */
export const REFRESH_PERCENTILE = 0.05;

/*
 * Minimum rank of the representative. A percentile alone degrades on
 * short windows (a 1.8 s window at low frame rates collects ~15
 * samples, where 5% is rank 1 — the raw minimum again). The floor of
 * 3 keeps the estimator robust against up to two glitch intervals
 * regardless of window length, and errs toward UNDER-estimating the
 * refresh rate, which only ever makes the quality thresholds more
 * forgiving — never trigger-happy.
 */
export const REFRESH_MIN_RANK = 3;

export type RefreshEstimator = {
  /** Current estimate in Hz; 0 = unknown. */
  estimate: number;

  /** Consecutive windows observed below half the estimate. */
  slowStreak: number;
};

export function createRefreshEstimator(): RefreshEstimator {
  return { estimate: 0, slowStreak: 0 };
}

/*
 * Reusable raw-delta sampler. `deltas` is allocated ONCE per engine
 * mount and mutated in place — recording a delta on the frame path
 * performs exactly one bounds-checked typed-array write.
 */
export type RefreshDeltaSampler = {
  deltas: Float32Array;

  /** Valid deltas recorded so far in the open window. */
  count: number;
};

export function createRefreshDeltaSampler(): RefreshDeltaSampler {
  return {
    deltas: new Float32Array(
      REFRESH_SAMPLE_CAPACITY
    ),

    count: 0
  };
}

/** Record one valid raw inter-frame delta (ms). Capacity-bounded. */
export function recordRefreshDelta(
  sampler: RefreshDeltaSampler,
  delta: number
): void {
  if (
    sampler.count <
    REFRESH_SAMPLE_CAPACITY
  ) {
    sampler.deltas[
      sampler.count
    ] = delta;

    sampler.count += 1;
  }
}

/** Invalidate the open window (suspension, idle gap, geometry change). */
export function resetRefreshDeltaSampler(
  sampler: RefreshDeltaSampler
): void {
  sampler.count = 0;
}

/**
 * Robust representative interval for the closed window, in Hz.
 * Returns null when the window carried too few valid deltas.
 *
 * The k-th smallest delta (k ≈ 5% of samples, minimum rank 3 — see
 * REFRESH_MIN_RANK) is found with a bounded partial selection over the
 * reused buffer — no sort, no allocation, O(k·n) with k ≤ 30. Deltas
 * already rejected at record time (< 3 ms or > 34 ms) never reach the
 * buffer.
 */
export function representativeWindowHz(
  sampler: RefreshDeltaSampler
): number | null {
  const count =
    sampler.count;

  if (
    count <
    REFRESH_MIN_SAMPLES
  ) {
    return null;
  }

  const deltas =
    sampler.deltas;

  const k = Math.min(
    count - 1,

    Math.max(
      REFRESH_MIN_RANK,

      Math.ceil(
        count *
          REFRESH_PERCENTILE
      )
    )
  );

  for (
    let slot = 0;
    slot < k;
    slot += 1
  ) {
    let minIndex =
      slot;

    for (
      let scan =
        slot + 1;
      scan < count;
      scan += 1
    ) {
      if (
        deltas[scan] <
        deltas[minIndex]
      ) {
        minIndex =
          scan;
      }
    }

    const swapped =
      deltas[slot];

    deltas[slot] =
      deltas[minIndex];

    deltas[minIndex] =
      swapped;
  }

  const representative =
    deltas[
      k - 1
    ];

  return (
    representative >
    0
      ? 1000 /
        representative
      : null
  );
}

export type RefreshWindowResult = {
  /** Updated estimate after this window. */
  estimate: number;

  /** True when the estimate changed this window (telemetry event). */
  changed: boolean;
};

/**
 * Close one sampling window. `windowHz` is the window's representative
 * interval (see representativeWindowHz); pass null when the window
 * produced no valid deltas (suspended, idle-capped — the window is
 * skipped).
 */
export function closeRefreshWindow(
  estimator: RefreshEstimator,
  windowHz: number | null
): RefreshWindowResult {
  if (windowHz === null) {
    return {
      estimate: estimator.estimate,
      changed: false
    };
  }

  let changed = false;

  if (
    estimator.estimate === 0 ||
    windowHz >
      estimator.estimate * 1.03
  ) {
    estimator.estimate = Math.min(
      240,
      windowHz
    );

    estimator.slowStreak = 0;

    changed = true;
  } else if (
    estimator.estimate > 0 &&
    windowHz <
      estimator.estimate * 0.5
  ) {
    /*
     * Sustained collapse: a genuine display-context change decays the
     * stale fast estimate instead of letting it stand forever. Requires
     * VALIDATION_WINDOWS consecutive slow windows; isolated jank or a
     * few dropped frames never reach that.
     */
    estimator.slowStreak += 1;

    if (
      estimator.slowStreak >=
      REFRESH_VALIDATION_WINDOWS
    ) {
      estimator.estimate = windowHz;

      estimator.slowStreak = 0;

      changed = true;
    }
  } else {
    estimator.slowStreak = 0;
  }

  return {
    estimate: estimator.estimate,
    changed
  };
}

/** Suspensions (hidden tab, idle cadence) invalidate the open window. */
export function suspendRefreshWindow(
  estimator: RefreshEstimator
): void {
  estimator.slowStreak = 0;
}

function clamp01(value: number): number {
  return Math.max(
    0,
    Math.min(1, value)
  );
}
