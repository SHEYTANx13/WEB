/*
 * redmagic/engineConstants.ts — the organism's shared constants,
 * types and math helpers (v4.0.1).
 *
 * Mechanically extracted from the module header of the old
 * components/RedMagic.tsx: the tuning constants, the engine-local
 * types, the organism profile and the small math helpers are
 * unchanged. The subsystem-profiling gate (RED_MAGIC_TIMING) is a
 * build-time constant — see the preserved comment below.
 */

import {
  type QualityBudget,
  type QualityName
} from "@/components/redmagic/engineConfig";

const RED_MAGIC_TIMING =
process.env.NEXT_PUBLIC_RED_MAGIC_TIMING ===
"1";

type Point = {
x: number;
y: number;
};

type Shockwave = {
x: number;
y: number;

angle: number;

age: number;
strength: number;

angularInfluence: Float32Array;
};

/*
 * QualityName and the unified per-tier budget live in
 * redmagic/engineConfig.ts (Runtime v2) — one coordinated allocation
 * across core, network, membrane, particles, flows and atmosphere.
 * `Quality` survives as a legacy alias for the budget shape.
 */
type Quality =
QualityBudget;

type ModeProfile = {
timeScale: number;

energyCeiling: number;
energyFloor: number;

pointerGain: number;
coreGain: number;

responseLag: number;

particleImpulse: number;

turbulenceGain: number;

shockwaveGain: number;

recovery: number;

gridConductance: number;
globalPotentialGain: number;
};

/*
 * ONE ORGANISM, ONE PROFILE (v3.6): the DRIFT / LISTEN / SURGE
 * modes are retired. The organism runs its balanced baseline and
 * lets interaction energy do all the shaping — the same law the
 * sound engine follows.
 */
const ORGANISM_PROFILE: ModeProfile = {
timeScale: 1,

energyCeiling: 1,
energyFloor: 0,

pointerGain: 1,
coreGain: 1,

responseLag: 0.018,

particleImpulse: 0.7,

turbulenceGain: 1,

shockwaveGain: 1,

recovery: 1,

gridConductance: 0.18,

globalPotentialGain: 0.045
};

const TAU =
Math.PI * 2;

const MAX_SHOCKWAVES =
5;

const SHOCKWAVE_DURATION =
820;

/*
 * Idle cadence (v2.8, Runtime v2): after this long without pointer
 * intent — or with a pointer resting still while its energy has
 * settled — the ambient organism drops from full vsync to a capped
 * redraw rate. The canvas redraw — clear plus membrane, network, node
 * sprites and glow passes — is the engine's dominant cost; capping idle
 * redraws cuts that cost to roughly a quarter on high-refresh displays
 * while the drift stays visibly alive. Any pointer movement, click, or
 * interaction event restores the full rate instantly. The simulation
 * scales per runtime state come from STATE_SIMULATION_SCALE in
 * redmagic/engineConfig.ts.
 */
const IDLE_CADENCE_DELAY_MS =
4000;

const IDLE_FRAME_INTERVAL_MS =
33;

const GRID_ENERGY_DECAY =
0.94;

const GRID_IDLE_ENERGY =
0.008;

const GRID_MAX_NODE_ENERGY =
1.4;

const GRID_GLOBAL_RADIUS =
1.25;

const GRID_ROUTE_BONUS =
0.018;

const GRID_FLOW_LIMIT =
0.16;

const GRID_POINTER_RADIUS =
0.72;

const GRID_POINTER_CONTRIBUTION =
0.025;

const CORE_ROTATION_SPEED =
0.00008;

const CORE_DETAIL_ROTATION_SPEED =
0.000125;

const CORE_MOVEMENT_SPEED =
0.00135;

const CORE_MOVEMENT_AMPLITUDE =
0.014;

const MAX_CLICK_PARTICLES =
100;

const PARTICLE_WRAP_MARGIN =
80;

const CLICK_LIGHT_BOOST_MAX =
1;

const CLICK_LIGHT_DECAY =
0.965;

const CLICK_LIGHT_DECAY_REFERENCE_MS =
16;


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
  (
    3 -
    2 * x
  )
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

/* The engine-local types are shared by every redmagic module. */
export type { Point, Shockwave, Quality, ModeProfile };

export {
  RED_MAGIC_TIMING,
  ORGANISM_PROFILE,
  TAU,
  MAX_SHOCKWAVES,
  SHOCKWAVE_DURATION,
  IDLE_CADENCE_DELAY_MS,
  IDLE_FRAME_INTERVAL_MS,
  GRID_ENERGY_DECAY,
  GRID_IDLE_ENERGY,
  GRID_MAX_NODE_ENERGY,
  GRID_GLOBAL_RADIUS,
  GRID_ROUTE_BONUS,
  GRID_FLOW_LIMIT,
  GRID_POINTER_RADIUS,
  GRID_POINTER_CONTRIBUTION,
  CORE_ROTATION_SPEED,
  CORE_DETAIL_ROTATION_SPEED,
  CORE_MOVEMENT_SPEED,
  CORE_MOVEMENT_AMPLITUDE,
  MAX_CLICK_PARTICLES,
  PARTICLE_WRAP_MARGIN,
  CLICK_LIGHT_BOOST_MAX,
  CLICK_LIGHT_DECAY,
  CLICK_LIGHT_DECAY_REFERENCE_MS,
  clamp,
  smoothstep,
  distanceSquared
};
