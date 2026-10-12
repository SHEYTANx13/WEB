#!/usr/bin/env python3
"""
generate-brand-raster.py — raster brand assets from the 13-point star.

Companion to scripts/generate-brand.mjs (which owns the SVG system).
This script re-implements the SAME polar construction in Python and
rasterises it with Pillow. Outputs are committed:

  public/icon.png        192x192 PNG favicon fallback (48-multiple)
  public/favicon.ico     16/32/48 multi-size legacy favicon
  public/apple-icon.png  180x180 Apple touch icon (opaque, full-bleed)
  public/icon.svg        written by generate-brand.mjs (same family)
  public/og-default.png  1200x630 default Open Graph / Twitter image
  assets/social/og-default.png   canonical copy of the same image
  assets/social/og-square.png    1200x1200 square social share variant

Deterministic: same inputs, same bytes. Run:
  python3 scripts/generate-brand-raster.py
"""

import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ----------------------------------------------------------------------
# Star mathematics — MUST stay identical to generate-brand.mjs
# ----------------------------------------------------------------------

VERTICES = 26
STEP_DEG = 360.0 / 26.0
INNER_RATIO = math.cos(5 * math.pi / 13) / math.cos(4 * math.pi / 13)
START_ANGLE_DEG = -90.0


def star_vertices(cx, cy, outer_radius, inner_radius=None):
    inner = inner_radius if inner_radius is not None else outer_radius * INNER_RATIO
    vertices = []
    for i in range(VERTICES):
        angle = math.radians(START_ANGLE_DEG + i * STEP_DEG)
        radius = outer_radius if i % 2 == 0 else inner
        vertices.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return vertices


# ----------------------------------------------------------------------
# Palette (site tokens)
# ----------------------------------------------------------------------

BG = (7, 7, 7, 255)
BG_TILE_TOP = (16, 16, 19, 255)
BG_TILE_BOTTOM = (7, 7, 7, 255)
RED = (255, 32, 32, 255)
INK = (201, 205, 212, 255)
INK_DIM = (122, 128, 138, 255)
TEXT_MAIN = (240, 242, 245, 255)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# red-hot radial ramp stops (offset, colour)
STAR_STOPS = [
    (0.0, (255, 122, 94)),
    (0.24, (255, 32, 32)),
    (0.66, (196, 14, 14)),
    (1.0, (124, 4, 4)),
]


def star_mask(size, scale, cx, cy, outer_radius):
    """Alpha mask of the 13-point star on a (size x size)*scale canvas."""
    big = size * scale
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    vertices = [
        (x * scale, y * scale)
        for (x, y) in star_vertices(cx * scale, cy * scale, outer_radius * scale)
    ]
    draw.polygon(vertices, fill=255)
    return mask


def radial_ramp_rgb(canvas_w, canvas_h, scale, cx, cy, span, stops):
    """RGB image: radial colour ramp centred on (cx, cy), radius `span`
    (final units), on a (canvas_w x canvas_h)*scale plane. Built from a
    256-step LUT — no per-pixel loops."""
    big_w, big_h = canvas_w * scale, canvas_h * scale
    d = max(2, int(span * 2 * scale))

    grad = Image.radial_gradient("L").resize((d, d), Image.Resampling.BILINEAR)
    plane = Image.new("L", (big_w, big_h), 255)
    plane.paste(grad, (int(cx * scale - d / 2), int(cy * scale - d / 2)))

    luts = [[0] * 256 for _ in range(3)]
    for v in range(256):
        t = v / 255.0
        for i in range(len(stops) - 1):
            a, ca = stops[i]
            b, cb = stops[i + 1]
            if t <= b:
                f = (t - a) / (b - a)
                for k in range(3):
                    luts[k][v] = int(ca[k] + (cb[k] - ca[k]) * f)
                break
    bands = [plane.point(luts[k]) for k in range(3)]
    return Image.merge("RGB", bands)


def radial_glow(canvas_w, canvas_h, scale, cx, cy, span, peak):
    """RGBA red glow on a (canvas_w x canvas_h)*scale canvas: alpha peaks
    at (cx, cy), fades to 0 at radius `span`."""
    big_w, big_h = canvas_w * scale, canvas_h * scale
    d = max(2, int(span * 2 * scale))

    grad = Image.radial_gradient("L").resize((d, d), Image.Resampling.BILINEAR)
    plane = Image.new("L", (big_w, big_h), 255)
    plane.paste(grad, (int(cx * scale - d / 2), int(cy * scale - d / 2)))

    alpha = plane.point(lambda v: max(0, int((255 - v) * peak / 255)))
    glow = Image.new("RGBA", (big_w, big_h), (255, 32, 32, 0))
    glow.putalpha(alpha)
    return glow


def gradient_star(canvas_w, canvas_h, scale, cx, cy, outer_radius):
    """Red-hot star as RGBA on a (canvas_w x canvas_h)*scale canvas."""
    big_w, big_h = canvas_w * scale, canvas_h * scale
    span = outer_radius * 1.02

    fill = radial_ramp_rgb(canvas_w, canvas_h, scale, cx, cy, span, STAR_STOPS).convert("RGBA")

    mask = Image.new("L", (big_w, big_h), 0)
    draw = ImageDraw.Draw(mask)
    # star_vertices already receives supersampled coordinates.
    vertices = star_vertices(cx * scale, cy * scale, outer_radius * scale)
    draw.polygon(vertices, fill=255)

    fill.putalpha(mask)
    return fill


# ----------------------------------------------------------------------
# Favicon family
# ----------------------------------------------------------------------

def gradient_tile(size, scale, rounded=True):
    big = size * scale
    tile = Image.new("RGB", (big, big))
    draw = ImageDraw.Draw(tile)
    for y in range(big):
        t = y / max(1, big - 1)
        color = tuple(int(BG_TILE_TOP[i] + (BG_TILE_BOTTOM[i] - BG_TILE_TOP[i]) * t) for i in range(3))
        draw.line([(0, y), (big, y)], fill=color)

    if not rounded:
        return tile.convert("RGBA")

    mask = Image.new("L", (big, big), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.19), fill=255)

    result = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    result.paste(tile, (0, 0), mask)
    return result


def make_icon(size):
    """Favicon tile: dark rounded square + red-hot 13-point star."""
    scale = 4
    icon = gradient_tile(size, scale)
    icon = Image.alpha_composite(icon, radial_glow(size, size, scale, size / 2, size / 2, size * 0.62, 70))
    icon = Image.alpha_composite(icon, gradient_star(size, size, scale, size / 2, size / 2, size * 0.42))
    return icon.resize((size, size), Image.Resampling.LANCZOS)


def draw_text_center(draw, text, font, cx, y, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0]
    draw.text((cx - width / 2, y), text, font=font, fill=fill)


# ----------------------------------------------------------------------
# OG images
# ----------------------------------------------------------------------

OG_W, OG_H = 1200, 630
SQ = 1200
SCALE = 2


def compose_og():
    w, h = OG_W * SCALE, OG_H * SCALE
    img = Image.new("RGBA", (w, h), BG)

    img = Image.alpha_composite(img, radial_glow(OG_W, OG_H, SCALE, 970, 315, 320, 58))
    img = Image.alpha_composite(img, gradient_star(OG_W, OG_H, SCALE, 970, 315, 178))

    draw = ImageDraw.Draw(img)
    ring_r = 178 * 1.18
    cx, cy = 970 * SCALE, 315 * SCALE
    rr = ring_r * SCALE
    draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(35, 38, 45, 255), width=2 * SCALE)
    node_x = cx + rr * math.cos(math.radians(-32))
    node_y = cy + rr * math.sin(math.radians(-32))
    draw.ellipse(
        [node_x - 5 * SCALE, node_y - 5 * SCALE, node_x + 5 * SCALE, node_y + 5 * SCALE],
        fill=RED,
    )

    name_font = ImageFont.truetype(FONT_BOLD, 104 * SCALE)
    tag_font = ImageFont.truetype(FONT_BOLD, 23 * SCALE)
    url_font = ImageFont.truetype(FONT_REGULAR, 21 * SCALE)

    draw.text((96 * SCALE, 224 * SCALE), "PARSA TAK", font=name_font, fill=TEXT_MAIN)
    draw.rectangle([96 * SCALE, 360 * SCALE, 300 * SCALE, 363 * SCALE], fill=RED)
    draw.text(
        (96 * SCALE, 390 * SCALE),
        "AI SYSTEMS · REASONING · SOFTWARE · RED MAGIC",
        font=tag_font,
        fill=INK,
    )
    draw.text((96 * SCALE, 540 * SCALE), "parsaetak.github.io/WEB", font=url_font, fill=INK_DIM)

    return img.resize((OG_W, OG_H), Image.Resampling.LANCZOS).convert("RGB")


def compose_square():
    size = SQ * SCALE
    img = Image.new("RGBA", (size, size), BG)

    img = Image.alpha_composite(img, radial_glow(SQ, SQ, SCALE, SQ / 2, 470, 560, 64))
    img = Image.alpha_composite(img, gradient_star(SQ, SQ, SCALE, SQ / 2, 470, 300))

    draw = ImageDraw.Draw(img)
    name_font = ImageFont.truetype(FONT_BOLD, 96 * SCALE)
    tag_font = ImageFont.truetype(FONT_BOLD, 25 * SCALE)

    draw_text_center(draw, "PARSA TAK", name_font, size / 2, 880 * SCALE, TEXT_MAIN)
    draw.rectangle(
        [size / 2 - 102 * SCALE, 1020 * SCALE, size / 2 + 102 * SCALE, 1023 * SCALE],
        fill=RED,
    )
    draw_text_center(
        draw,
        "AI SYSTEMS · REASONING · SOFTWARE · RED MAGIC",
        tag_font,
        size / 2,
        1052 * SCALE,
        INK,
    )

    return img.resize((SQ, SQ), Image.Resampling.LANCZOS).convert("RGB")


def main():
    public_dir = os.path.join(ROOT, "public")
    assets_social = os.path.join(ROOT, "assets", "social")
    os.makedirs(assets_social, exist_ok=True)

    # Favicon family -------------------------------------------------
    # 512px quality master → ICO frames + a 192px PNG fallback
    # (192 = 4 × 48, satisfying Google's "multiple of 48px" favicon
    # guidance while staying large enough to be crisp).
    # All favicon files live in public/ and are wired through the
    # root layout's explicit metadata.icons (deterministic link set
    # in every build mode, basePath included).
    master = make_icon(512)
    master.resize((192, 192), Image.Resampling.LANCZOS).save(
        os.path.join(public_dir, "icon.png")
    )
    master.save(os.path.join(public_dir, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

    # Apple touch icons must be FULL-BLEED squares (opaque, no rounded
    # corners) — iOS applies its own corner mask at install time.
    apple = gradient_tile(180, 4, rounded=False)
    apple = Image.alpha_composite(apple, radial_glow(180, 180, 4, 90, 90, 118, 46))
    apple = Image.alpha_composite(apple, gradient_star(180, 180, 4, 90, 90, 76))
    apple.resize((180, 180), Image.Resampling.LANCZOS).convert("RGB").save(
        os.path.join(public_dir, "apple-icon.png")
    )

    # OG family ------------------------------------------------------
    og = compose_og()
    og.save(os.path.join(public_dir, "og-default.png"), optimize=True)
    og.save(os.path.join(assets_social, "og-default.png"), optimize=True)

    square = compose_square()
    square.save(os.path.join(assets_social, "og-square.png"), optimize=True)

    for rel in (
        "public/icon.png",
        "public/favicon.ico",
        "public/apple-icon.png",
        "public/og-default.png",
    ):
        print(f"[raster] {rel}: {os.path.getsize(os.path.join(ROOT, rel))} bytes")
    print(f"[raster] assets/social/og-square.png: {os.path.getsize(os.path.join(assets_social, 'og-square.png'))} bytes")


if __name__ == "__main__":
    main()
