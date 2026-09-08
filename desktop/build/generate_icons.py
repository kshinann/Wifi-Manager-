"""One-off script that generated the icon files in this directory
(icon.png, icon.ico, icon.iconset/). Re-run if the design ever changes:

    python desktop/build/generate_icons.py

Draws the same download-arrow-on-accent-blue glyph used for the Android
app's launcher icon, at the sizes each platform's packager expects.
"""

import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BG_COLOR = (91, 141, 239, 255)  # #5B8DEF, the app's accent blue
FG_COLOR = (255, 255, 255, 255)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    s = size / 108.0  # design grid matches the Android vector icon

    # Downward arrow shaft + head.
    shaft_w = 12 * s
    cx = 54 * s
    draw.rectangle(
        [cx - shaft_w / 2, 26 * s, cx + shaft_w / 2, 62 * s], fill=FG_COLOR
    )
    head_r = 20 * s
    draw.polygon(
        [
            (cx - head_r, 56 * s),
            (cx + head_r, 56 * s),
            (cx, 56 * s + head_r * 1.15),
        ],
        fill=FG_COLOR,
    )

    # Tray/base bar.
    bar_h = 12 * s
    draw.rounded_rectangle(
        [30 * s, 80 * s - bar_h / 2, 78 * s, 80 * s + bar_h / 2],
        radius=bar_h / 2,
        fill=FG_COLOR,
    )

    return img


def main() -> None:
    master = draw_icon(1024)
    master.save(os.path.join(HERE, "icon.png"))

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    master.save(
        os.path.join(HERE, "icon.ico"),
        sizes=[(s, s) for s in ico_sizes],
    )

    iconset_dir = os.path.join(HERE, "icon.iconset")
    os.makedirs(iconset_dir, exist_ok=True)
    # Standard macOS iconset naming; converted to .icns at CI build time via
    # `iconutil` (only available on macOS, so it isn't done here).
    for base, size in [
        ("icon_16x16", 16),
        ("icon_16x16@2x", 32),
        ("icon_32x32", 32),
        ("icon_32x32@2x", 64),
        ("icon_128x128", 128),
        ("icon_128x128@2x", 256),
        ("icon_256x256", 256),
        ("icon_256x256@2x", 512),
        ("icon_512x512", 512),
        ("icon_512x512@2x", 1024),
    ]:
        draw_icon(size).save(os.path.join(iconset_dir, f"{base}.png"))

    print("Wrote icon.png, icon.ico, icon.iconset/")


if __name__ == "__main__":
    main()
