"""Generates the ChargeVerse app icons: a neon lightning bolt inside a glowing
energy orb on a dark background.

Writes the legacy launcher icons, the adaptive icon layers (Android 8+) and
the 512x512 Google Play store icon. Re-run after changing the design:

    python3 tool/make_icons.py

Requires Pillow (pip install pillow).
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
STORE = ROOT / "store"

S = 1024  # master canvas; everything is drawn at this size, then downscaled
CYAN = (52, 231, 255)
VIOLET = (180, 92, 255)
BG_INNER = (16, 26, 54)
BG_OUTER = (4, 6, 14)

# Legacy icons are 48dp, adaptive layers 108dp.
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def radial(size, inner, outer, center=(0.5, 0.42), radius=0.75):
    """Radial gradient from inner to outer colour."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    cx, cy = center[0] * size, center[1] * size
    r = radius * size
    for y in range(size):
        for x in range(size):
            t = min(1.0, ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r)
            px[x, y] = tuple(int(inner[i] + (outer[i] - inner[i]) * t) for i in range(3))
    return img


def background():
    return radial(S, BG_INNER, BG_OUTER).convert("RGBA")


def bolt_polygon(scale, cx, cy):
    """A chunky lightning bolt centred on (cx, cy)."""
    pts = [(0.10, -0.50), (-0.26, 0.06), (-0.02, 0.06), (-0.12, 0.50), (0.26, -0.08), (0.02, -0.08)]
    return [(cx + x * scale, cy + y * scale) for x, y in pts]


def foreground(scale=1.0):
    """Orb ring + bolt on a transparent canvas. [scale] shrinks the artwork
    so it fits the adaptive icon safe zone."""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c = S / 2
    ring_r = 0.36 * S * scale
    ring_w = int(0.045 * S * scale)

    # Outer glow of the orb.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([c - ring_r, c - ring_r, c + ring_r, c + ring_r], outline=CYAN + (200,), width=ring_w * 3)
    glow = glow.filter(ImageFilter.GaussianBlur(0.05 * S * scale))
    layer = Image.alpha_composite(layer, glow)

    # Orb body: faint inner fill so it reads as a sphere.
    body = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.ellipse([c - ring_r, c - ring_r, c + ring_r, c + ring_r], fill=CYAN + (34,))
    layer = Image.alpha_composite(layer, body)

    # Ring with a cyan-to-violet sweep.
    ring_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(ring_mask).ellipse(
        [c - ring_r, c - ring_r, c + ring_r, c + ring_r], outline=255, width=ring_w
    )
    sweep = Image.new("RGBA", (S, S))
    sp = sweep.load()
    for y in range(S):
        t = y / S
        col = tuple(int(CYAN[i] + (VIOLET[i] - CYAN[i]) * t) for i in range(3))
        for x in range(S):
            sp[x, y] = col + (255,)
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ring.paste(sweep, (0, 0), ring_mask)
    layer = Image.alpha_composite(layer, ring)

    # Bolt: blurred glow, then a white-to-cyan core.
    poly = bolt_polygon(0.56 * S * scale, c, c)
    bglow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(bglow).polygon(poly, fill=CYAN + (255,))
    bglow = bglow.filter(ImageFilter.GaussianBlur(0.035 * S * scale))
    layer = Image.alpha_composite(layer, bglow)

    bolt_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(bolt_mask).polygon(poly, fill=255)
    core = Image.new("RGBA", (S, S))
    cp = core.load()
    for y in range(S):
        t = min(1.0, max(0.0, (y - c + 0.28 * S * scale) / (0.56 * S * scale)))
        col = tuple(int(255 + (CYAN[i] - 255) * t) for i in range(3))
        for x in range(S):
            cp[x, y] = col + (255,)
    bolt = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bolt.paste(core, (0, 0), bolt_mask)
    return Image.alpha_composite(layer, bolt)


def rounded_mask(size, radius_frac=0.22):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_frac), fill=255)
    return m


def save(img, path, size):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)
    print("wrote", path.relative_to(ROOT), f"{size}x{size}")


def main():
    bg = background()
    full = Image.alpha_composite(bg, foreground(1.0))

    # Legacy launcher icon (pre-Android 8): rounded square with transparent corners.
    legacy = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    legacy.paste(full, (0, 0), rounded_mask(S))
    for name, k in DENSITIES.items():
        save(legacy, RES / f"mipmap-{name}/ic_launcher.png", int(48 * k))

    # Adaptive icon layers. Launchers mask to the central 72dp of 108dp, and
    # only the inner 66dp is guaranteed visible, so the artwork is scaled
    # down to stay inside that safe zone.
    fg = foreground(0.62)
    for name, k in DENSITIES.items():
        save(fg, RES / f"mipmap-{name}/ic_launcher_foreground.png", int(108 * k))
        save(bg, RES / f"mipmap-{name}/ic_launcher_background.png", int(108 * k))

    adaptive = RES / "mipmap-anydpi-v26/ic_launcher.xml"
    adaptive.parent.mkdir(parents=True, exist_ok=True)
    adaptive.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        "</adaptive-icon>\n"
    )
    print("wrote", adaptive.relative_to(ROOT))

    # Google Play listing icon: 512x512, square, no transparency (Play applies
    # its own rounded mask).
    save(full.convert("RGB"), STORE / "play_icon_512.png", 512)


if __name__ == "__main__":
    main()
