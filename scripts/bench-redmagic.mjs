/*
 * RED MAGIC V2.1 MICRO-BENCHMARK — deterministic Node/V8 measurements for
 * the Runtime v2.1 hot-path changes, plus functional assertions for the
 * new pure policies. Zero dependencies; runs on plain Node (>= 22.6 with
 * type stripping, i.e. any Node that runs the site's other tooling).
 *
 *   node scripts/bench-redmagic.mjs
 *
 * What this file is NOT: a browser benchmark. Canvas raster cost, style
 * resolution and compositing are excluded by construction — those are
 * measured in the browser (see AGENTS.md: measurement builds with
 * NEXT_PUBLIC_RED_MAGIC_TIMING=1). This file measures the pure JS work
 * the engine performs per frame, at shapes matched to the real engine:
 *
 *   1. refresh window representative  old min-of-window vs percentile
 *                                     (robustness + cost)
 *   2. network classify + scan        six-sweep vs bucket-index-lists
 *   3. per-particle distance          Math.hypot vs sqrt(dx²+dy²)
 *   4. grid velocity decay            per-node pow vs hoisted pow
 *   5. stroke style construction      template literal vs constant
 *                                     string + globalAlpha
 *
 * Plus policy assertions (settle predicate, pressure DPR). Numbers are
 * printed, never asserted against thresholds: machines differ, and the
 * no-fabricated-metrics law applies to benchmarks too.
 */

import {
  createRefreshDeltaSampler,
  recordRefreshDelta,
  representativeWindowHz,
  isSettledFrame,
  resolvePressureDpr,
  createRefreshEstimator,
  closeRefreshWindow
} from "../components/redmagic/engineConfig.ts";

const results = {};

function bench(name, iterations, setup, run) {
  // warmup
  for (let i = 0; i < Math.min(iterations, 2000); i += 1) {
    run(setup(), i);
  }
  const runs = [];
  for (let rep = 0; rep < 5; rep += 1) {
    const state = setup();
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i += 1) {
      run(state, i);
    }
    const end = process.hrtime.bigint();
    runs.push(Number(end - start) / 1e6 / iterations); // ms per op
  }
  runs.sort((a, b) => a - b);
  const median = runs[2];
  results[name] = {
    msPerOp: Number(median.toPrecision(4)),
    ops: iterations
  };
  console.log(
    `${name.padEnd(46)} ${median.toPrecision(4)} ms/op  (${iterations} ops, median of 5)`
  );
  return median;
}

console.log("RED MAGIC v2.1 micro-benchmark (Node " + process.version + ")\n");

/* ------------------------------------------------------------------ */
/* 1. Refresh window representative: robustness                        */
/* ------------------------------------------------------------------ */

console.log("[1] Refresh representative — robustness (functional)");

{
  const scenarios = [
    {
      label: "60 Hz window, 108 samples, 2 glitches @4 ms",
      deltas: Array.from({ length: 108 }, () => 16.7),
      glitches: [4, 4.2]
    },
    {
      label: "60 Hz window, 22 samples, 2 glitches @4 ms",
      deltas: Array.from({ length: 20 }, () => 16.7),
      glitches: [4, 4.2]
    },
    {
      label: "120 Hz window, 216 samples, 5 glitches @3.5 ms",
      deltas: Array.from({ length: 216 }, () => 8.33),
      glitches: [3.5, 3.6, 3.4, 3.5, 3.7]
    },
    {
      label: "short low-fps window, 12 samples, no glitches",
      deltas: Array.from({ length: 12 }, (_, i) => 118 + (i % 3)),
      glitches: []
    }
  ];

  results.refreshRobustness = [];

  for (const s of scenarios) {
    const all = [...s.deltas, ...s.glitches];
    const minHz = 1000 / Math.min(...all);
    const sampler = createRefreshDeltaSampler();
    for (const d of all) {
      recordRefreshDelta(sampler, d);
    }
    const percentileHz = representativeWindowHz(sampler);
    results.refreshRobustness.push({
      scenario: s.label,
      oldMinWindowHz: Number(minHz.toPrecision(4)),
      newPercentileHz: percentileHz === null ? null : Number(percentileHz.toPrecision(4))
    });
    console.log(
      `    ${s.label}`.padEnd(70) +
        `  min: ${minHz.toPrecision(4)} Hz  percentile: ${percentileHz?.toPrecision(4) ?? "null"} Hz`
    );
  }

  // estimator adoption sanity: percentile feeds the estimator
  const estimator = createRefreshEstimator();
  closeRefreshWindow(estimator, 59.9);
  console.log(
    `    estimator adopts sustained 59.9 Hz window → estimate ${estimator.estimate.toPrecision(4)} Hz`
  );
  results.estimatorAdoption = estimator.estimate;
}

/* ------------------------------------------------------------------ */
/* 2. Refresh sampler cost                                             */
/* ------------------------------------------------------------------ */

console.log("\n[2] Refresh sampler cost (per window close, 600 samples)");

bench(
  "record 600 deltas + representativeWindowHz",
  20000,
  () => {
    const sampler = createRefreshDeltaSampler();
    for (let i = 0; i < 600; i += 1) {
      recordRefreshDelta(sampler, 16.7);
    }
    return sampler;
  },
  (sampler) => {
    representativeWindowHz(sampler);
    sampler.count = 600; // restore for next iteration (selection mutates order)
  }
);

/* ------------------------------------------------------------------ */
/* 3. Network classify + scan: six sweeps vs bucket lists              */
/* ------------------------------------------------------------------ */

console.log("\n[3] Network classify+scan (170 edges / 45 nodes, JS iteration cost only)");

{
  const EDGE_COUNT = 170;
  const NODE_COUNT = 45;

  const makeShape = () => ({
    nodes: Array.from({ length: NODE_COUNT }, (_, i) => ({
      x: (i * 37) % 1200,
      y: (i * 53) % 700,
      energy: ((i * 17) % 100) / 100
    })),
    edges: Array.from({ length: EDGE_COUNT }, (_, i) => ({
      a: i % NODE_COUNT,
      b: (i * 7 + 3) % NODE_COUNT,
      flow: ((i * 11) % 100) / 100
    })),
    edgeBuckets: new Uint8Array(EDGE_COUNT),
    bucketIndices: Array.from({ length: 5 }, () => new Uint16Array(EDGE_COUNT)),
    bucketCounts: new Int32Array(5)
  });

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const classifyOld = (s) => {
    // classify sweep
    for (let i = 0; i < s.edges.length; i += 1) {
      const e = s.edges[i];
      const energy = (s.nodes[e.a].energy + s.nodes[e.b].energy) * 0.5;
      const active = clamp(energy * 1.8 + e.flow * 1.4, 0, 1);
      let bucket = 4;
      if (active < 0.01) bucket = 0;
      else if (active < 0.12) bucket = 1;
      else if (active < 0.3) bucket = 2;
      else if (active < 0.62) bucket = 3;
      s.edgeBuckets[i] = bucket;
    }
    // five bucket-filtered scan sweeps
    let touched = 0;
    for (let b = 0; b < 5; b += 1) {
      for (let i = 0; i < s.edges.length; i += 1) {
        if (s.edgeBuckets[i] !== b) continue;
        const e = s.edges[i];
        touched += s.nodes[e.a].x + s.nodes[e.b].y;
      }
    }
    return touched;
  };

  const classifyNew = (s) => {
    s.bucketCounts.fill(0);
    for (let i = 0; i < s.edges.length; i += 1) {
      const e = s.edges[i];
      const energy = (s.nodes[e.a].energy + s.nodes[e.b].energy) * 0.5;
      const active = clamp(energy * 1.8 + e.flow * 1.4, 0, 1);
      let bucket = 4;
      if (active < 0.01) bucket = 0;
      else if (active < 0.12) bucket = 1;
      else if (active < 0.3) bucket = 2;
      else if (active < 0.62) bucket = 3;
      s.bucketIndices[bucket][s.bucketCounts[bucket]] = i;
      s.bucketCounts[bucket] += 1;
    }
    let touched = 0;
    for (let b = 0; b < 5; b += 1) {
      const list = s.bucketIndices[b];
      const count = s.bucketCounts[b];
      for (let m = 0; m < count; m += 1) {
        const e = s.edges[list[m]];
        touched += s.nodes[e.a].x + s.nodes[e.b].y;
      }
    }
    return touched;
  };

  const oldMs = bench("  old: classify + 5 filtered sweeps", 20000, makeShape, classifyOld);
  const newMs = bench("  new: classify into lists + 5 walks", 20000, makeShape, classifyNew);
  results.networkSweep = {
    oldMsPerFrame: Number(oldMs.toPrecision(4)),
    newMsPerFrame: Number(newMs.toPrecision(4)),
    ratio: Number((oldMs / newMs).toPrecision(3))
  };
  console.log(
    `    → bucket lists iterate ${(oldMs / newMs).toPrecision(3)}× faster than the six-sweep scan (JS side only; canvas calls unchanged)`
  );
}

/* ------------------------------------------------------------------ */
/* 4. Per-particle distance: hypot vs sqrt                             */
/* ------------------------------------------------------------------ */

console.log("\n[4] Per-particle normalized-center distance (212 particles/frame shape)");

{
  const COUNT = 212;
  const makeParticles = () =>
    Array.from({ length: COUNT }, (_, i) => ({
      x: (i * 97) % 1200 + 0.5,
      y: (i * 61) % 700 + 0.25
    }));

  const halfW = 600;
  const halfH = 350;
  const cx = 600;
  const cy = 350;

  const oldLoop = (ps) => {
    let acc = 0;
    for (let i = 0; i < ps.length; i += 1) {
      const p = ps[i];
      acc += Math.min(
        1.6,
        Math.hypot(
          (p.x - cx) / Math.max(600, 1),
          (p.y - cy) / Math.max(350, 1)
        )
      );
    }
    return acc;
  };

  const newLoop = (ps) => {
    let acc = 0;
    for (let i = 0; i < ps.length; i += 1) {
      const p = ps[i];
      const dx = (p.x - cx) / halfW;
      const dy = (p.y - cy) / halfH;
      acc += Math.min(1.6, Math.sqrt(dx * dx + dy * dy));
    }
    return acc;
  };

  const oldMs = bench("  old: Math.hypot + per-particle max()", 20000, makeParticles, oldLoop);
  const newMs = bench("  new: hoisted halves + sqrt", 20000, makeParticles, newLoop);
  results.particleDistance = {
    oldMsPerFrame: Number(oldMs.toPrecision(4)),
    newMsPerFrame: Number(newMs.toPrecision(4)),
    ratio: Number((oldMs / newMs).toPrecision(3))
  };
  console.log(`    → sqrt path is ${(oldMs / newMs).toPrecision(3)}× faster`);
}

/* ------------------------------------------------------------------ */
/* 5. Grid velocity decay: per-node pow vs hoisted                     */
/* ------------------------------------------------------------------ */

console.log("\n[5] Grid velocity decay (49 nodes/frame shape)");

{
  const NODES = 49;
  const makeNodes = () => Array.from({ length: NODES }, () => ({ velocity: 0.5 }));

  const oldLoop = (nodes) => {
    const deltaScale = 1.0;
    for (let i = 0; i < nodes.length; i += 1) {
      nodes[i].velocity *= Math.pow(0.8, deltaScale);
    }
    return nodes[0].velocity;
  };

  const newLoop = (nodes) => {
    const deltaScale = 1.0;
    const velocityDecay = Math.pow(0.8, deltaScale);
    for (let i = 0; i < nodes.length; i += 1) {
      nodes[i].velocity *= velocityDecay;
    }
    return nodes[0].velocity;
  };

  const oldMs = bench("  old: Math.pow per node", 20000, makeNodes, oldLoop);
  const newMs = bench("  new: hoisted decay factor", 20000, makeNodes, newLoop);
  results.velocityDecay = {
    oldMsPerFrame: Number(oldMs.toPrecision(4)),
    newMsPerFrame: Number(newMs.toPrecision(4)),
    ratio: Number((oldMs / newMs).toPrecision(3))
  };
  console.log(`    → hoisted decay is ${(oldMs / newMs).toPrecision(3)}× faster`);
}

/* ------------------------------------------------------------------ */
/* 6. Stroke style construction                                        */
/* ------------------------------------------------------------------ */

console.log("\n[6] Stroke style construction (3 strokes/frame shape, string cost only)");

{
  const oldStyle = (lightMultiplier) =>
    `rgba(255, 55, 40, ${0.68 * lightMultiplier})` +
    `rgba(125, 0, 0, ${0.12 * lightMultiplier})` +
    `rgba(255, 70, 48, ${(0.08 + 0.05) * (1 + lightMultiplier * 0.65)})`;

  bench(
    "  old: 3 template literals per frame",
    200000,
    () => ({ boost: 0.42, sink: "" }),
    (state) => {
      state.sink = oldStyle(state.boost);
    }
  );

  bench(
    "  new: 3 constant strings (alpha via globalAlpha)",
    200000,
    () => ({ boost: 0.42, sink: "" }),
    (state) => {
      // constants; alpha arithmetic only — the canvas globalAlpha write
      // replaces the string construction. String identity is reused.
      state.sink = "rgb(255, 55, 40)";
      state.sink = "rgb(125, 0, 0)";
      state.sink = "rgb(255, 70, 48)";
    }
  );
}

/* ------------------------------------------------------------------ */
/* 7. Policy assertions (functional, not timing)                       */
/* ------------------------------------------------------------------ */

console.log("\n[7] v2.1 policy assertions");

{
  const checks = [];
  const expect = (label, actual, wanted) => {
    const ok = actual === wanted;
    checks.push({ label, ok, actual });
    console.log(`    ${ok ? "PASS" : "FAIL"}  ${label} (got ${String(actual)})`);
  };

  // settle predicate
  expect("still pointer + settled energy → settled", isSettledFrame(true, true, 0, 0.005, 0), true);
  expect("moving pointer → not settled", isSettledFrame(true, false, 0, 0.005, 0), false);
  expect("absent pointer → settled", isSettledFrame(false, false, 0, 0.005, 0), true);
  expect("live shockwave → not settled", isSettledFrame(false, false, 1, 0.005, 0), false);
  expect("turbulence above floor → not settled", isSettledFrame(true, true, 0, 0.2, 0), false);
  expect("click particles in flight → not settled", isSettledFrame(true, true, 0, 0.005, 3), false);

  // pressure DPR
  const base = {
    currentDpr: 1.75,
    ceiling: 2,
    deviceDpr: 2,
    sustainedPoor: false,
    sustainedRecovery: false,
    performanceRatio: 0.2,
    lastChangeAt: 0,
    now: 10000
  };
  expect(
    "sustained poor lowers by coarse step",
    resolvePressureDpr({ ...base, sustainedPoor: true }),
    1.25
  );
  expect(
    "pressure floor at 1",
    resolvePressureDpr({ ...base, sustainedPoor: true, currentDpr: 1 }),
    1
  );
  expect(
    "debounce blocks change within 2.5 s",
    resolvePressureDpr({ ...base, sustainedPoor: true, lastChangeAt: 9000 }),
    1.75
  );
  expect(
    "recovery with poor ratio does not raise",
    resolvePressureDpr({ ...base, sustainedRecovery: true, performanceRatio: 0.5 }),
    1.75
  );
  expect(
    "recovery with healthy ratio raises by fine step",
    resolvePressureDpr({ ...base, sustainedRecovery: true, performanceRatio: 0.9, currentDpr: 1.25 }),
    1.5
  );
  expect(
    "recovery never exceeds static ceiling",
    resolvePressureDpr({
      ...base,
      sustainedRecovery: true,
      performanceRatio: 0.95,
      currentDpr: 1.75,
      ceiling: 1.75
    }),
    1.75
  );

  results.policyAssertions = {
    passed: checks.filter((c) => c.ok).length,
    total: checks.length
  };
}

console.log("\nMicro-benchmark complete. All numbers above are machine-specific measurements, not guarantees.");
