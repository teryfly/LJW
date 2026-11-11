#!/usr/bin/env python3
"""
Derive every web size from the artist's originals.

    python3 scripts/prepare-images.py

Drop full-resolution scans into assets/images/originals/ using the file names from
the content doc (love-1.jpg, yixiang-1-iris.jpg, ...), run this, then run
`node build.js`. Three sizes are produced per image, plus one square cover per
series:

    assets/images/thumb/   500px   grid cells
    assets/images/         900px   detail pages and the home hero
    assets/images/full/   1600px   what "点击图片查看大图" opens

    assets/images/cover/           800px   series covers (home + gallery), centre-cropped
    assets/images/cover/thumb/     400px   the same covers for phones
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/images/originals")
OUT = os.path.join(ROOT, "assets/images")

TIERS = {
    "": (900, 80),
    "thumb": (500, 78),
    "full": (1600, 85),
}

# The four series covers have to read as one block, so they are all the same
# square. The source for each is series[].cover in data/site.json.
COVER_EDGE = 800
COVER_THUMB = 400
COVER_QUALITY = 82


def emit(img, name, folder, max_edge, quality):
    out = img.copy()
    if max(out.size) > max_edge:
        scale = max_edge / max(out.size)
        out = out.resize(
            (max(1, round(out.width * scale)), max(1, round(out.height * scale))),
            Image.LANCZOS,
        )
    dest = os.path.join(OUT, folder) if folder else OUT
    os.makedirs(dest, exist_ok=True)
    out.convert("RGB").save(
        os.path.join(dest, f"{name}.jpg"),
        quality=quality,
        optimize=True,
        progressive=True,
    )
    return out.size


def write_covers():
    """One centre-cropped square per series, all the same edge length."""
    data = json.load(open(os.path.join(ROOT, "data/site.json"), encoding="utf8"))
    for s in data["series"]:
        name = s["cover"]
        src = os.path.join(SRC, name + img_ext(name))
        if not os.path.exists(src):
            sys.exit(f"series {s['id']}: no original for cover {name}")
        img = Image.open(src)
        side = min(img.size)
        left = (img.width - side) // 2
        top = (img.height - side) // 2
        square = img.crop((left, top, left + side, top + side))
        emit(square, s["id"], "cover", COVER_EDGE, COVER_QUALITY)
        emit(square, s["id"], "cover/thumb", COVER_THUMB, COVER_QUALITY)
        print(f"  cover {s['id']}: {img.size} -> {side}px square, centre-cropped")


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"missing source dir: {SRC}")

    names = sorted(
        f[:-4] for f in os.listdir(SRC) if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )
    for name in names:
        img = Image.open(os.path.join(SRC, name + img_ext(name)))
        sizes = [emit(img, name, folder, edge, q) for folder, (edge, q) in TIERS.items()]
        print(f"  {name}: {img.size} -> {', '.join(f'{w}x{h}' for w, h in sizes)}")

    write_covers()
    write_icon()
    print("  apple-touch-icon.png")



CJK_FONTS = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]


def write_icon():
    """A 刘 tile for iOS home-screen bookmarks; matches assets/favicon.svg."""
    size = 320
    img = Image.new("RGB", (size, size), "#ffffff")
    d = ImageDraw.Draw(img)
    font = None
    for path in CJK_FONTS:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, int(size * 0.62))
            except OSError:
                font = None
            if font:
                break
    if font is None:
        print("  (no CJK font found; icon falls back to the serif initial)")
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", int(size * 0.5)
        )
    glyph = "刘" if any(os.path.exists(p) for p in CJK_FONTS) else "T"
    box = d.textbbox((0, 0), glyph, font=font)
    d.text(
        ((size - box[2] - box[0]) / 2, (size - box[3] - box[1]) / 2 - box[1]),
        glyph,
        fill="#2b2b28",
        font=font,
    )
    img.save(os.path.join(OUT, "apple-touch-icon.png"))


def img_ext(name):
    for ext in (".jpg", ".jpeg", ".png"):
        if os.path.exists(os.path.join(SRC, name + ext)):
            return ext
    return ".jpg"


if __name__ == "__main__":
    main()
