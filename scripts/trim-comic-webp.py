#!/usr/bin/env python3
"""Trim near-white/near-black PDF margins from comic WebP pages."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

THRESHOLD = 32
PAD = 1
SAMPLE_STEP = 3


def corner_bg(im: Image.Image) -> tuple[int, int, int]:
    w, h = im.size
    corners = [
        im.getpixel((0, 0)),
        im.getpixel((w - 1, 0)),
        im.getpixel((0, h - 1)),
        im.getpixel((w - 1, h - 1)),
    ]
    return tuple(sum(c[i] for c in corners) // 4 for i in range(3))


def dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return sum(abs(a[i] - b[i]) for i in range(3))


def content_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    w, h = im.size
    bg = corner_bg(im)
    min_x, min_y = w, h
    max_x, max_y = 0, 0
    found = False

    for y in range(0, h, SAMPLE_STEP):
        for x in range(0, w, SAMPLE_STEP):
            if dist(im.getpixel((x, y)), bg) > THRESHOLD:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if not found:
        return None

    return (
        max(0, min_x - PAD),
        max(0, min_y - PAD),
        min(w, max_x + PAD + 1),
        min(h, max_y + PAD + 1),
    )


def trim_file(path: Path) -> tuple[bool, str]:
    im = Image.open(path).convert("RGB")
    box = content_bbox(im)
    if not box:
        return False, "no content"

    cropped = im.crop(box)
    if cropped.size == im.size:
        return False, "unchanged"

    cropped.save(path, "WEBP", quality=82, method=6)
    return True, f"{im.size[0]}x{im.size[1]} -> {cropped.size[0]}x{cropped.size[1]}"


def main() -> int:
    root = Path(__file__).resolve().parent.parent / "public" / "comics"
    if len(sys.argv) > 1:
        files = [Path(p) for p in sys.argv[1:]]
    else:
        files = sorted(root.glob("series-*/*.webp"))

    trimmed = 0
    for path in files:
        changed, info = trim_file(path)
        if changed:
            trimmed += 1
            print(f"trimmed {path.relative_to(root.parent.parent)}: {info}")

    print(f"\nDone: trimmed {trimmed}/{len(files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
