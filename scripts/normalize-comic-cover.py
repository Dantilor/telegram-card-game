#!/usr/bin/env python3
"""Trim and center-crop comic cover WebP to catalog aspect (2:3 or 3:4)."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

PRESETS = {
    '2/3': (2 / 3, (1200, 1800)),
    '3/4': (3 / 4, (1200, 1600)),
}


def trim_margins(im: Image.Image, threshold: int = 32, pad: int = 1) -> Image.Image:
    w, h = im.size
    corners = [im.getpixel((0, 0)), im.getpixel((w - 1, 0)), im.getpixel((0, h - 1)), im.getpixel((w - 1, h - 1))]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    def dist(px: tuple[int, int, int]) -> int:
        return sum(abs(px[i] - bg[i]) for i in range(3))

    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            if dist(im.getpixel((x, y))) > threshold:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if not found:
        return im

    box = (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + pad + 1),
        min(h, max_y + pad + 1),
    )
    return im.crop(box)


def normalize_cover(path: Path, target_ratio: float, output_size: tuple[int, int]) -> tuple[bool, str]:
    im = Image.open(path).convert("RGB")
    original_size = im.size
    im = trim_margins(im)
    w, h = im.size
    ratio = w / h

    if ratio > target_ratio:
        new_w = int(round(h * target_ratio))
        new_h = h
    else:
        new_w = w
        new_h = int(round(w / target_ratio))

    left = max(0, (w - new_w) // 2)
    top = max(0, (h - new_h) // 2)
    cropped = im.crop((left, top, left + new_w, top + new_h))
    resized = cropped.resize(output_size, Image.Resampling.LANCZOS)
    resized.save(path, "WEBP", quality=82, method=6)
    return True, f"{original_size[0]}x{original_size[1]} -> {output_size[0]}x{output_size[1]}"


def main() -> int:
    args = sys.argv[1:]
    if len(args) < 1:
        print("Usage: normalize-comic-cover.py <cover.webp> [2/3|3/4] [...]")
        return 1

    ratio_key = '2/3'
    paths: list[Path] = []
    for arg in args:
        if arg in PRESETS:
            ratio_key = arg
        else:
            paths.append(Path(arg))

    if not paths:
        print("No cover paths provided")
        return 1

    target_ratio, output_size = PRESETS[ratio_key]
    for path in paths:
        changed, info = normalize_cover(path, target_ratio, output_size)
        if changed:
            print(f"normalized {path} ({ratio_key}): {info}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
