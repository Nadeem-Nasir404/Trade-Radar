# Local tooling script (not shipped) - generates the illustrated Anime P&L card background at
# 1080x1350 (drawn at 2x, downsampled for clean edges). The other picture cards use original memes
# (see compose-meme-cards.py). Artwork
# stays between the card's top bar and its tagline (y 190-560); the lower part fades dark for the
# numbers. Needs Pillow.
# Run: python3 scripts/generate-card-art.py
import math, random
from PIL import Image, ImageDraw, ImageFilter
S = 2
W, H = 1080 * S, 1350 * S
OUT = "/home/user/Trade-Radar/apps/mobile/assets/cards/"

def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def vgrad(stops):
    """Vertical gradient from [(t, '#hex'), ...]."""
    im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / (H - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                f = (t - t0) / (t1 - t0 or 1); a, b = rgb(c0), rgb(c1)
                d.line([(0, y), (W, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(3)))
                break
    return im.convert("RGBA")

def glow(im, cx, cy, r, color, alpha):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgb(color) + (alpha,))
    return Image.alpha_composite(im, layer.filter(ImageFilter.GaussianBlur(r * 0.45)))

def bottom_scrim(im, start=0.46, strength=0.82):
    """Darkens the lower part where the card's numbers sit."""
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for y in range(int(H * start), H):
        t = (y - H * start) / (H * (1 - start))
        d.line([(0, y), (W, y)], fill=(4, 3, 10, int(255 * strength * min(1, t * 1.25))))
    return Image.alpha_composite(im, layer)

def sparkle(d, x, y, r, color=(255, 255, 255, 230)):
    d.polygon([(x, y - r), (x + r * 0.18, y - r * 0.18), (x + r, y), (x + r * 0.18, y + r * 0.18),
               (x, y + r), (x - r * 0.18, y + r * 0.18), (x - r, y), (x - r * 0.18, y - r * 0.18)], fill=color)

def save(im, name):
    im.convert("RGB").resize((1080, 1350), Image.LANCZOS).save(OUT + name + ".jpg", quality=88, optimize=True, progressive=True)

# ---------------------------------------------------------------- Anime
def anime():
    random.seed(7)
    im = vgrad([(0, "#1B0B3F"), (0.35, "#4C1D95"), (0.7, "#3B1170"), (1, "#24094A")])
    fx, fy = 700 * S, 360 * S
    im = glow(im, fx, fy, 420 * S, "#F472B6", 120)
    im = glow(im, fx, fy, 200 * S, "#FDE68A", 150)
    # Manga focus lines radiating from the focal point, leaving a clear centre.
    lines = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lines)
    for i in range(260):
        a = random.uniform(0, 2 * math.pi); w = random.uniform(0.002, 0.011)
        r0 = random.uniform(230, 360) * S; r1 = 2200 * S
        pts = [(fx + math.cos(a) * r0, fy + math.sin(a) * r0),
               (fx + math.cos(a - w) * r1, fy + math.sin(a - w) * r1),
               (fx + math.cos(a + w) * r1, fy + math.sin(a + w) * r1)]
        d.polygon(pts, fill=(255, 255, 255, random.randint(40, 120)))
    im = Image.alpha_composite(im, lines)
    # Halftone screentone in the top-left, fading out.
    tone = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(tone)
    step = 22 * S
    for y in range(0, int(560 * S), step):
        for x in range(0, int(620 * S), step):
            f = max(0, 1 - math.hypot(x, y) / (700 * S))
            r = f * 7 * S
            if r > 0.6 * S: d.ellipse((x - r, y - r, x + r, y + r), fill=(244, 114, 182, int(110 * f)))
    im = Image.alpha_composite(im, tone)
    d = ImageDraw.Draw(im)
    for _ in range(26):
        x, y = random.uniform(80, 1000) * S, random.uniform(200, 560) * S
        sparkle(d, x, y, random.uniform(6, 20) * S, (255, 255, 255, random.randint(150, 240)))
    im = bottom_scrim(im, 0.42, 0.4)
    save(im, "anime")

anime()
import os
for n in ["anime"]: print(n, os.path.getsize(OUT + n + ".jpg") // 1024, "KB")
