"""Draws the toolbar icons into extension/icons. Standard library only.

    python3 tools/make_icons.py

The mark is a timer: a solid disc with a ring and a wedge of elapsed time.
"on" is the green icon shown while the timer runs, "off" the grey idle one.
The popup header draws the same shapes in SVG (see .mark in popup.html).
"""

import math
import struct
import sys
import zlib
from pathlib import Path

SIZES = (16, 32, 48, 128)
SAMPLES = 4  # supersampling per axis

GLYPH = (0xFF, 0xFF, 0xFF)
THEMES = {
    "on": (0x4A, 0x6B, 0x3A),
    "off": (0x8B, 0x8E, 0x88),
}

# Geometry in a unit square, measured from the centre.
DISC = 0.5
RING_RADIUS = 0.32
RING_STROKE = 0.08
WEDGE_RADIUS = 0.2
WEDGE_SWEEP = 120.0  # degrees clockwise from 12 o'clock


def in_glyph(distance, angle):
    if abs(distance - RING_RADIUS) <= RING_STROKE / 2:
        return True
    return distance <= WEDGE_RADIUS and angle <= WEDGE_SWEEP


def render(size, theme):
    fill = THEMES[theme]
    rows = []
    for py in range(size):
        row = bytearray([0])  # PNG filter type: none
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    dx = (px + (sx + 0.5) / SAMPLES) / size - 0.5
                    dy = (py + (sy + 0.5) / SAMPLES) / size - 0.5
                    distance = math.hypot(dx, dy)
                    if distance > DISC:
                        continue
                    a += 1
                    angle = math.degrees(math.atan2(dx, -dy)) % 360
                    c = GLYPH if in_glyph(distance, angle) else fill
                    r, g, b = r + c[0], g + c[1], b + c[2]
            if a:
                row += bytes((round(r / a), round(g / a), round(b / a), round(255 * a / SAMPLES**2)))
            else:
                row += bytes(4)
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))


def png(size, pixels):
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(pixels, 9)) + chunk(b"IEND", b"")


def main():
    out = Path(__file__).resolve().parent.parent / "extension" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for theme in THEMES:
        for size in SIZES:
            (out / f"{theme}-{size}.png").write_bytes(png(size, render(size, theme)))
    print(f"wrote {len(THEMES) * len(SIZES)} icons to {out}")


if __name__ == "__main__":
    sys.exit(main())
