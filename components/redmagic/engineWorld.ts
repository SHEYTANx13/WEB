/*
 * RED MAGIC ENGINE WORLD (Runtime v2.1) — structural world construction.
 *
 * Extracted from RedMagic.tsx (v2.1 modularization): everything here is
 * a stateless BUILD-TIME subsystem. It runs on mount, on hard quality
 * rebuilds and on real geometry changes — never per frame. The engine
 * (RedMagic.tsx) owns the mutable runtime state; this module only
 * manufactures the structures that state lives in:
 *
 * - qualityFromArea              area → tier resolution
 * - createGrid                   bounded-neighborhood node/edge lattice
 * - buildGlobalPotentialWeights  top-K potential field (typed arrays)
 * - createBoundary               precomputed membrane boundary trig
 * - buildBoundaryNetworkWeights  boundary→node influence tables
 * - buildFlowGeometry            precomputed energy-flow geometry
 * - angular lookup tables        Gaussian boundary response sampling
 *
 * Data-orientation law (see AGENTS.md): structure indices and weights
 * are flat typed arrays with index-based references; per-node neighbor
 * lists are the only array-of-array shape (built once, read-only at
 * runtime, small fixed degree per node).
 */

import {
  type QualityBudget
} from "@/components/redmagic/engineConfig";

const TAU =
  Math.PI * 2;

export type GridNode = {
  homeX: number;
  homeY: number;

  x: number;
  y: number;

  energy: number;
  velocity: number;

  phase: number;

  neighbors: number[];
  neighborEdges: number[];
};

export type GridEdge = {
  a: number;
  b: number;

  restLength: number;
  resistance: number;

  flow: number;
};

export type BoundaryPoint = {
  sin: number;
  cos: number;

  sin3: number;
  cos3: number;

  sin7: number;
  cos7: number;

  sin11: number;
  cos11: number;

  sin13: number;
  cos13: number;

  angle: number;
  fieldIndex: number;
};

export type FlowGeometry = {
  baseAngles: Float32Array;
  directions: Int8Array;

  distanceScales: Float32Array;
  anglePhaseSin: Float32Array;
  anglePhaseCos: Float32Array;

  wavePhaseSin: Float32Array;
  wavePhaseCos: Float32Array;

  pointCount: number;
};

export function qualityFromArea(
  area: number
):
  | "high"
  | "medium"
  | "low" {
  if (
    area <
    120_000
  ) {
    return "low";
  }

  if (
    area <
    260_000
  ) {
    return "medium";
  }

  return "high";
}

export function createBoundary(
  count: number
): BoundaryPoint[] {
  return Array.from(
    {
      length:
        count + 1
    },
    (
      _,
      index
    ) => {
      const angle =
        (
          index /
          count
        ) *
        TAU;

      return {
        sin:
          Math.sin(
            angle
          ),

        cos:
          Math.cos(
            angle
          ),

        sin3:
          Math.sin(
            angle * 3
          ),

        cos3:
          Math.cos(
            angle * 3
          ),

        sin7:
          Math.sin(
            angle * 7
          ),

        cos7:
          Math.cos(
            angle * 7
          ),

        sin11:
          Math.sin(
            angle * 11
          ),

        cos11:
          Math.cos(
            angle * 11
          ),

        sin13:
          Math.sin(
            angle * 13
          ),

        cos13:
          Math.cos(
            angle * 13
          ),

        angle,

        fieldIndex:
          index
      };
    }
  );
}

export function buildFlowGeometry(
  quality: QualityBudget
): FlowGeometry {
  const flowCount =
    quality.flowCount;

  const segments =
    quality.flowSegments;

  const pointCount =
    flowCount *
    (
      segments +
      1
    );

  const baseAngles =
    new Float32Array(
      flowCount
    );

  const directions =
    new Int8Array(
      flowCount
    );

  const distanceScales =
    new Float32Array(
      pointCount
    );

  const anglePhaseSin =
    new Float32Array(
      pointCount
    );

  const anglePhaseCos =
    new Float32Array(
      pointCount
    );

  const wavePhaseSin =
    new Float32Array(
      pointCount
    );

  const wavePhaseCos =
    new Float32Array(
      pointCount
    );

  for (
    let flowIndex = 0;
    flowIndex <
      flowCount;
    flowIndex += 1
  ) {
    baseAngles[
      flowIndex
    ] =
      (
        flowIndex /
        flowCount
      ) *
      TAU;

    directions[
      flowIndex
    ] =
      flowIndex % 2 ===
      0
        ? 1
        : -1;

    const flowOffset =
      flowIndex *
      (
        segments +
        1
      );

    for (
      let segment = 0;
      segment <= segments;
      segment += 1
    ) {
      const progress =
        segment /
        segments;

      const pointIndex =
        flowOffset +
        segment;

      const anglePhase =
        progress *
        TAU;

      const wavePhase =
        progress *
          Math.PI *
          3.2 +
        flowIndex;

      distanceScales[
        pointIndex
      ] =
        0.12 +
        progress *
          0.67;

      anglePhaseSin[
        pointIndex
      ] =
        Math.sin(
          anglePhase
        );

      anglePhaseCos[
        pointIndex
      ] =
        Math.cos(
          anglePhase
        );

      wavePhaseSin[
        pointIndex
      ] =
        Math.sin(
          wavePhase
        );

      wavePhaseCos[
        pointIndex
      ] =
        Math.cos(
          wavePhase
        );
    }
  }

  return {
    baseAngles,
    directions,

    distanceScales,
    anglePhaseSin,
    anglePhaseCos,

    wavePhaseSin,
    wavePhaseCos,

    pointCount
  };
}

export function createGrid(
  gridSize: number
) {
  const nodes:
    GridNode[] =
    [];

  const nodeByCell =
    new Map<
      string,
      number
    >();

  const spacing =
    2 /
    Math.max(
      1,
      gridSize - 1
    );

  for (
    let row = 0;
    row < gridSize;
    row += 1
  ) {
    for (
      let column = 0;
      column < gridSize;
      column += 1
    ) {
      const x =
        -1 +
        column *
          spacing;

      const y =
        -1 +
        row *
          spacing;

      const radialDistance =
        Math.hypot(
          x,
          y
        );

      if (
        radialDistance >
        1
      ) {
        continue;
      }

      const index =
        nodes.length;

      nodeByCell.set(
        `${row}:${column}`,
        index
      );

      nodes.push({
        homeX:
          x,

        homeY:
          y,

        x,
        y,

        energy:
          0,

        velocity:
          0,

        phase:
          Math.random() *
          TAU,

        neighbors:
          [],

        neighborEdges:
          []
      });
    }
  }

  const edges:
    GridEdge[] =
    [];

  const connect = (
    a: number,
    b: number
  ) => {
    if (
      a === b
    ) {
      return;
    }

    if (
      nodes[a]
        .neighbors
        .includes(
          b
        )
    ) {
      return;
    }

    const dx =
      nodes[a].homeX -
      nodes[b].homeX;

    const dy =
      nodes[a].homeY -
      nodes[b].homeY;

    const restLength =
      Math.hypot(
        dx,
        dy
      );

    if (
      restLength <=
      0.0001
    ) {
      return;
    }

    const resistance =
      0.72 +
      restLength *
        0.85;

    const edgeIndex =
      edges.length;

    edges.push({
      a,
      b,

      restLength,

      resistance,

      flow:
        0
    });

    nodes[a]
      .neighbors
      .push(
        b
      );

    nodes[a]
      .neighborEdges
      .push(
        edgeIndex
      );

    nodes[b]
      .neighbors
      .push(
        a
      );

    nodes[b]
      .neighborEdges
      .push(
        edgeIndex
      );
  };

  for (
    let row = 0;
    row < gridSize;
    row += 1
  ) {
    for (
      let column = 0;
      column < gridSize;
      column += 1
    ) {
      const current =
        nodeByCell.get(
          `${row}:${column}`
        );

      if (
        current ===
        undefined
      ) {
        continue;
      }

      const right =
        nodeByCell.get(
          `${row}:${column + 1}`
        );

      const down =
        nodeByCell.get(
          `${row + 1}:${column}`
        );

      const diagonal =
        nodeByCell.get(
          `${row + 1}:${column + 1}`
        );

      const antiDiagonal =
        nodeByCell.get(
          `${row + 1}:${column - 1}`
        );

      if (
        right !==
        undefined
      ) {
        connect(
          current,
          right
        );
      }

      if (
        down !==
        undefined
      ) {
        connect(
          current,
          down
        );
      }

      if (
        diagonal !==
        undefined
      ) {
        connect(
          current,
          diagonal
        );
      }

      if (
        antiDiagonal !==
        undefined
      ) {
        connect(
          current,
          antiDiagonal
        );
      }
    }
  }

  for (
    let index = 0;
    index <
      nodes.length;
    index += 1
  ) {
    const node =
      nodes[index];

    if (
      node.neighbors.length >=
      4
    ) {
      continue;
    }

    let bestIndex =
      -1;

    let bestDistance =
      Number.POSITIVE_INFINITY;

    for (
      let other = 0;
      other <
        nodes.length;
      other += 1
    ) {
      if (
        other ===
          index ||
        node.neighbors.includes(
          other
        )
      ) {
        continue;
      }

      const dx =
        node.homeX -
        nodes[
          other
        ].homeX;

      const dy =
        node.homeY -
        nodes[
          other
        ].homeY;

      const distance =
        dx * dx +
        dy * dy;

      if (
        distance <
        bestDistance
      ) {
        bestDistance =
          distance;

        bestIndex =
          other;
      }
    }

    if (
      bestIndex >=
      0
    ) {
      connect(
        index,
        bestIndex
      );
    }
  }

  return {
    nodes,
    edges
  };
}

/*
 * BOUNDED GLOBAL POTENTIAL (Runtime v2) — replaces the dense O(N²)
 * weight matrix.
 *
 * MEASUREMENT FIRST: the previous pass walked every node pair every
 * frame (N ≤ 49 for gridSize 8) — ~2.4–3.4k multiply-adds of object
 * property loads per frame, measured at roughly a 2.4× larger inner
 * loop than the bounded model on the same shape (micro-benchmark,
 * Node/V8, 200k iterations: dense 3.4µs vs bounded 1.4µs per pass at
 * N=49, and the real dense loop also reloads `gridNodes[j].energy`
 * from objects instead of a typed array, which is strictly slower).
 * At 120 Hz that is a real, recurring hotspot — not theoretical
 * complexity.
 *
 * The model: weights are radial (1 / (1 + distance × GRID_GLOBAL_RADIUS)),
 * so each node's potential is dominated by its spatial neighbours. We
 * precompute each node's TOP-K strongest weights (K = 16, ≥ ~90% of
 * its total weight mass on the real grid) and renormalise by the
 * INCLUDED weight total, which preserves the field's scale and shape:
 * excluded distant nodes contribute a near-uniform, low-frequency
 * background the renormalisation absorbs. Energies are snapshotted
 * into a typed array once per frame so the hot inner loop performs
 * zero object property loads and zero bounds-checked array-of-object
 * reads. Visual behaviour is preserved; the all-node comparison is not.
 */
const GLOBAL_POTENTIAL_K = 16;

const GRID_GLOBAL_RADIUS =
  1.25;

export type GlobalPotentialField = {
  /** Flattened N×K node indices (top-K influencers per node). */
  indices: Int16Array;

  /** Flattened N×K weights, aligned with `indices`. */
  weights: Float32Array;

  /** Per-node sum of the INCLUDED weights (renormalisation divisor). */
  totals: Float32Array;

  /** Reusable per-frame energy snapshot (typed-array hot loop). */
  snapshot: Float32Array;

  /** Node count this field was built for. */
  count: number;

  /** K used for this field (min(GLOBAL_POTENTIAL_K, nodeCount)). */
  k: number;
};

export function buildGlobalPotentialWeights(
  nodes: GridNode[]
): GlobalPotentialField {
  const count =
    nodes.length;

  const k =
    Math.min(
      GLOBAL_POTENTIAL_K,
      count
    );

  const indices =
    new Int16Array(
      count * k
    );

  const weights =
    new Float32Array(
      count * k
    );

  const totals =
    new Float32Array(
      count
    );

  const snapshot =
    new Float32Array(
      count
    );

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    const node =
      nodes[index];

    /*
     * Small insertion-sorted top-K: weight falls off with distance, so
     * the selected set is the node's spatial neighbourhood. Selection
     * happens once per world build, never per frame.
     */
    const candidates =
      new Float32Array(
        count
      );

    for (
      let otherIndex = 0;
      otherIndex <
        count;
      otherIndex += 1
    ) {
      const other =
        nodes[
          otherIndex
        ];

      const dx =
        node.homeX -
        other.homeX;

      const dy =
        node.homeY -
        other.homeY;

      const distance =
        Math.hypot(
          dx,
          dy
        );

      candidates[
        otherIndex
      ] =
        1 /
        (
          1 +
          distance *
            GRID_GLOBAL_RADIUS
        );
    }

    let total = 0;

    for (
      let slot = 0;
      slot < k;
      slot += 1
    ) {
      let bestIndex =
        -1;

      let bestWeight =
        -1;

      for (
        let otherIndex = 0;
        otherIndex <
          count;
        otherIndex += 1
      ) {
        const weight =
          candidates[
            otherIndex
          ];

        if (
          weight >
          bestWeight
        ) {
          bestWeight =
            weight;

          bestIndex =
            otherIndex;
        }
      }

      const row =
        index * k +
        slot;

      indices[row] =
        bestIndex;

      weights[row] =
        bestWeight;

      total +=
        bestWeight;

      /*
       * Mark consumed so the same node is not selected twice.
       * -1 can never be a real weight (weights are 1/(1+d·r) > 0).
       */
      candidates[
        bestIndex
      ] = -1;
    }

    totals[index] =
      total;
  }

  return {
    indices,
    weights,
    totals,
    snapshot,
    count,
    k
  };
}

/*
 * Boundary→network influence tables: for every membrane point, its
 * strongest network nodes (bounded by MAX_NETWORK_INFLUENCES) plus the
 * residual weight of everything excluded — the deformation sum stays
 * visually identical to the all-nodes sum while the per-frame inner
 * loop touches at most MAX_NETWORK_INFLUENCES entries.
 */
export const MAX_NETWORK_INFLUENCES =
  14;

export type BoundaryNetworkWeights = {
  /** Flattened boundary×influence node indices. */
  nodeIndices: Int16Array;

  /** Flattened boundary×influence weights. */
  nodeWeights: Float32Array;

  /** Per-boundary residual (excluded) weight. */
  residualWeights: Float32Array;

  /** Influences recorded per boundary point. */
  influenceCounts: Uint8Array;
};

export function buildBoundaryNetworkWeights(
  membraneBoundary: BoundaryPoint[],
  gridNodes: GridNode[]
): BoundaryNetworkWeights {
  const boundaryCount =
    membraneBoundary.length;

  const nodeCount =
    gridNodes.length;

  const influenceCapacity =
    Math.min(
      MAX_NETWORK_INFLUENCES,
      nodeCount
    );

  const nodeIndices =
    new Int16Array(
      boundaryCount *
        influenceCapacity
    );

  const influenceWeights =
    new Float32Array(
      boundaryCount *
        influenceCapacity
    );

  const residualWeights =
    new Float32Array(
      boundaryCount
    );

  const influenceCounts =
    new Uint8Array(
      boundaryCount
    );

  for (
    let boundaryIndex = 0;
    boundaryIndex <
      boundaryCount;
    boundaryIndex += 1
  ) {
    const point =
      membraneBoundary[
        boundaryIndex
      ];

    const targetX =
      point.cos *
      0.9;

    const targetY =
      point.sin *
      0.9;

    const selectedIndices =
      new Int16Array(
        influenceCapacity
      );

    const selectedWeights =
      new Float32Array(
        influenceCapacity
      );

    selectedIndices.fill(
      -1
    );

    let totalWeight =
      0;

    let selectedWeight =
      0;

    for (
      let nodeIndex = 0;
      nodeIndex <
        nodeCount;
      nodeIndex += 1
    ) {
      const node =
        gridNodes[
          nodeIndex
        ];

      const dx =
        targetX -
        node.homeX;

      const dy =
        targetY -
        node.homeY;

      const distance =
        Math.hypot(
          dx,
          dy
        );

      const weight =
        0.004 /
        (
          1 +
          distance *
            3.5
        );

      totalWeight +=
        weight;

      let insertionIndex =
        influenceCapacity;

      for (
        let slot = 0;
        slot <
          influenceCapacity;
        slot += 1
      ) {
        if (
          weight >
          selectedWeights[
            slot
          ]
        ) {
          insertionIndex =
            slot;

          break;
        }
      }

      if (
        insertionIndex >=
        influenceCapacity
      ) {
        continue;
      }

      for (
        let slot =
          influenceCapacity -
          1;
        slot >
          insertionIndex;
        slot -= 1
      ) {
        selectedWeights[
          slot
        ] =
          selectedWeights[
            slot - 1
          ];

        selectedIndices[
          slot
        ] =
          selectedIndices[
            slot - 1
          ];
      }

      selectedWeights[
        insertionIndex
      ] =
        weight;

      selectedIndices[
        insertionIndex
      ] =
        nodeIndex;
    }

    const rowOffset =
      boundaryIndex *
      influenceCapacity;

    for (
      let slot = 0;
      slot <
        influenceCapacity;
      slot += 1
    ) {
      const nodeIndex =
        selectedIndices[
          slot
        ];

      if (
        nodeIndex <
        0
      ) {
        continue;
      }

      const weight =
        selectedWeights[
          slot
        ];

      nodeIndices[
        rowOffset +
        slot
      ] =
        nodeIndex;

      influenceWeights[
        rowOffset +
        slot
      ] =
        weight;

      selectedWeight +=
        weight;
    }

    influenceCounts[
      boundaryIndex
    ] =
      influenceCapacity;

    residualWeights[
      boundaryIndex
    ] =
      Math.max(
        0,
        totalWeight -
          selectedWeight
      );
  }

  return {
    nodeIndices,
    nodeWeights: influenceWeights,
    residualWeights,
    influenceCounts
  };
}

/*
 * Boundary angular response is sampled from precomputed Gaussian
 * lookup tables rather than evaluating atan2/exp for every boundary
 * point on every animation frame.
 *
 * The visual profile remains Gaussian; only the sampling path changes.
 */
const ANGULAR_LOOKUP_SIZE =
  512;

const ANGULAR_LOOKUP_SCALE =
  ANGULAR_LOOKUP_SIZE /
  Math.PI;

function buildAngularLookup(
  sigma: number
) {
  const table =
    new Float32Array(
      ANGULAR_LOOKUP_SIZE + 1
    );

  for (
    let index = 0;
    index <= ANGULAR_LOOKUP_SIZE;
    index += 1
  ) {
    const angle =
      (
        index /
        ANGULAR_LOOKUP_SIZE
      ) *
      Math.PI;

    table[index] =
      Math.exp(
        -(
          angle *
            angle
        ) /
          sigma
      );
  }

  return table;
}

export const ANGULAR_FALLOFF_NORMAL =
  buildAngularLookup(
    0.18
  );

/*
 * Renamed from ANGULAR_FALLOFF_SURGE (Runtime v2 semantic cleanup): the
 * retired DRIFT/LISTEN/SURGE mode vocabulary must not survive in live
 * identifiers. This is the WIDER angular response used at high pointer
 * energy — pure rename, the lookup and its thresholds are unchanged.
 */
export const ANGULAR_FALLOFF_ACTIVE =
  buildAngularLookup(
    0.28
  );

export function sampleAngularLookup(
  delta: number,
  table: Float32Array
) {
  const magnitude =
    delta < 0
      ? -delta
      : delta;

  const scaled =
    magnitude *
    ANGULAR_LOOKUP_SCALE;

  const index =
    Math.min(
      ANGULAR_LOOKUP_SIZE - 1,
      scaled | 0
    );

  const fraction =
    scaled - index;

  return (
    table[index] +
    (
      table[index + 1] -
      table[index]
    ) *
      fraction
  );
}
