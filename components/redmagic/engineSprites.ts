/*
 * RED MAGIC ENGINE SPRITES (Runtime v2.1) — cached offscreen sprite
 * factory for the organism's glow, node, core and core-detail layers.
 *
 * Extracted from RedMagic.tsx (v2.1 modularization): sprite creation is
 * a stateless, build-time subsystem — it runs once per engine mount and
 * never touches engine state. Drawing the cached sprites stays in the
 * engine's render path; only the CONSTRUCTION lives here.
 *
 * Why sprites: every glow/node/core pass used to construct radial
 * gradients per draw call. Pre-rendering each visual into an offscreen
 * canvas once turns those passes into a single drawImage — the cached
 * equivalent of the original gradient math, pixel-for-pixel.
 */

const TAU =
  Math.PI * 2;

const GLOW_SPRITE_SIZE =
  256;

const CORE_SPRITE_SIZE =
  256;

const NODE_SPRITE_SIZE =
  64;

export function createGlowSprite():
  HTMLCanvasElement | null {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  const sprite =
    document.createElement(
      "canvas"
    );

  sprite.width =
    GLOW_SPRITE_SIZE;

  sprite.height =
    GLOW_SPRITE_SIZE;

  const context =
    sprite.getContext(
      "2d"
    );

  if (!context) {
    return null;
  }

  const half =
    GLOW_SPRITE_SIZE *
    0.5;

  const gradient =
    context.createRadialGradient(
      half,
      half,
      0,
      half,
      half,
      half
    );

  gradient.addColorStop(
    0,
    "rgba(255, 80, 20, 1)"
  );

  gradient.addColorStop(
    0.35,
    "rgba(255, 30, 10, 0.52)"
  );

  gradient.addColorStop(
    1,
    "rgba(255, 0, 0, 0)"
  );

  context.fillStyle =
    gradient;

  context.fillRect(
    0,
    0,
    GLOW_SPRITE_SIZE,
    GLOW_SPRITE_SIZE
  );

  return sprite;
}

export function createNodeSprite():
  HTMLCanvasElement | null {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  const sprite =
    document.createElement(
      "canvas"
    );

  sprite.width =
    NODE_SPRITE_SIZE;

  sprite.height =
    NODE_SPRITE_SIZE;

  const context =
    sprite.getContext(
      "2d"
    );

  if (!context) {
    return null;
  }

  const center =
    NODE_SPRITE_SIZE *
    0.5;

  const radius =
    NODE_SPRITE_SIZE *
    0.5;

  context.fillStyle =
    "rgba(255, 72, 35, 1)";

  context.beginPath();

  context.arc(
    center,
    center,
    radius * 0.9,
    0,
    TAU
  );

  context.fill();

  return sprite;
}

function drawCoreFilament(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
  startAngle: number,
  length: number,
  bend: number,
  width: number,
  alpha: number
) {
  context.beginPath();

  const segments =
    18;

  for (
    let index = 0;
    index <= segments;
    index += 1
  ) {
    const progress =
      index /
      segments;

    const angle =
      startAngle +
      progress *
        length;

    const radial =
      radius *
      (
        0.34 +
        progress *
          0.52 +
        Math.sin(
          progress *
            Math.PI *
            2
        ) *
          bend
      );

    const x =
      center +
      Math.cos(
        angle
      ) *
        radial;

    const y =
      center +
      Math.sin(
        angle
      ) *
        radial;

    if (
      index ===
      0
    ) {
      context.moveTo(
        x,
        y
      );
    } else {
      context.lineTo(
        x,
        y
      );
    }
  }

  context.lineWidth =
    width;

  context.strokeStyle =
    `rgba(255, 170, 70, ${alpha})`;

  context.stroke();
}

export function createCoreSprite():
  HTMLCanvasElement | null {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  const sprite =
    document.createElement(
      "canvas"
    );

  sprite.width =
    CORE_SPRITE_SIZE;

  sprite.height =
    CORE_SPRITE_SIZE;

  const context =
    sprite.getContext(
      "2d"
    );

  if (!context) {
    return null;
  }

  const center =
    CORE_SPRITE_SIZE *
    0.5;

  const radius =
    CORE_SPRITE_SIZE *
    0.5;

  const gradient =
    context.createRadialGradient(
      center -
        CORE_SPRITE_SIZE *
          0.1,
      center -
        CORE_SPRITE_SIZE *
          0.12,
      CORE_SPRITE_SIZE *
        0.03,
      center,
      center,
      radius
    );

  gradient.addColorStop(
    0,
    "rgba(255, 188, 72, 1)"
  );

  gradient.addColorStop(
    0.1,
    "rgba(255, 132, 38, 1)"
  );

  gradient.addColorStop(
    0.22,
    "rgba(255, 72, 22, 1)"
  );

  gradient.addColorStop(
    0.4,
    "rgba(235, 24, 14, 0.98)"
  );

  gradient.addColorStop(
    0.62,
    "rgba(172, 8, 8, 0.88)"
  );

  gradient.addColorStop(
    0.8,
    "rgba(86, 0, 4, 0.56)"
  );

  gradient.addColorStop(
    0.92,
    "rgba(30, 0, 2, 0.22)"
  );

  gradient.addColorStop(
    1,
    "rgba(8, 0, 0, 0)"
  );

  context.fillStyle =
    gradient;

  context.fillRect(
    0,
    0,
    CORE_SPRITE_SIZE,
    CORE_SPRITE_SIZE
  );

  context.save();

  context.beginPath();

  context.arc(
    center,
    center,
    radius * 0.91,
    0,
    TAU
  );

  context.clip();

  const hotRegions = [
    {
      x:
        center -
        radius *
          0.26,
      y:
        center -
        radius *
          0.18,
      radius:
        radius *
          0.11,
      alpha:
        0.7
    },
    {
      x:
        center +
        radius *
          0.2,
      y:
        center -
        radius *
          0.27,
      radius:
        radius *
          0.07,
      alpha:
        0.52
    },
    {
      x:
        center +
        radius *
          0.28,
      y:
        center +
        radius *
          0.18,
      radius:
        radius *
          0.09,
      alpha:
        0.46
    },
    {
      x:
        center -
        radius *
          0.17,
      y:
        center +
        radius *
          0.3,
      radius:
        radius *
          0.055,
      alpha:
        0.38
    }
  ];

  for (
    let index = 0;
    index <
      hotRegions.length;
    index += 1
  ) {
    const region =
      hotRegions[index];

    const regionGradient =
      context.createRadialGradient(
        region.x,
        region.y,
        0,
        region.x,
        region.y,
        region.radius
      );

    regionGradient.addColorStop(
      0,
      `rgba(255, 205, 80, ${region.alpha})`
    );

    regionGradient.addColorStop(
      0.4,
      `rgba(255, 105, 30, ${
        region.alpha *
        0.7
      })`
    );

    regionGradient.addColorStop(
      0.78,
      `rgba(205, 22, 10, ${
        region.alpha *
        0.34
      })`
    );

    regionGradient.addColorStop(
      1,
      "rgba(160, 0, 0, 0)"
    );

    context.fillStyle =
      regionGradient;

    context.beginPath();

    context.arc(
      region.x,
      region.y,
      region.radius,
      0,
      TAU
    );

    context.fill();
  }

  drawCoreFilament(
    context,
    center,
    radius,
    -2.55,
    1.4,
    0.026,
    2.2,
    0.34
  );

  drawCoreFilament(
    context,
    center,
    radius,
    -0.75,
    1.18,
    0.022,
    1.7,
    0.28
  );

  drawCoreFilament(
    context,
    center,
    radius,
    0.65,
    1.28,
    0.028,
    1.9,
    0.25
  );

  drawCoreFilament(
    context,
    center,
    radius,
    2.35,
    1.05,
    0.02,
    1.6,
    0.22
  );

  context.restore();

  return sprite;
}

export function createCoreDetailSprite():
  HTMLCanvasElement | null {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  const sprite =
    document.createElement(
      "canvas"
    );

  sprite.width =
    CORE_SPRITE_SIZE;

  sprite.height =
    CORE_SPRITE_SIZE;

  const context =
    sprite.getContext(
      "2d"
    );

  if (!context) {
    return null;
  }

  const center =
    CORE_SPRITE_SIZE *
    0.5;

  const radius =
    CORE_SPRITE_SIZE *
    0.5;

  context.save();

  context.beginPath();

  context.arc(
    center,
    center,
    radius * 0.84,
    0,
    TAU
  );

  context.clip();

  drawCoreFilament(
    context,
    center,
    radius,
    -1.9,
    1.7,
    0.035,
    1.35,
    0.3
  );

  drawCoreFilament(
    context,
    center,
    radius,
    -0.12,
    1.42,
    0.032,
    1.15,
    0.25
  );

  drawCoreFilament(
    context,
    center,
    radius,
    1.15,
    1.52,
    0.028,
    1.45,
    0.26
  );

  drawCoreFilament(
    context,
    center,
    radius,
    2.75,
    1.32,
    0.026,
    1.1,
    0.22
  );

  context.restore();

  return sprite;
}
