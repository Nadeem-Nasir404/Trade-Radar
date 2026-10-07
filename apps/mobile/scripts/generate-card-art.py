# Local tooling script (not shipped) - generates the drawn Minimal P&L card background at
# 1080x1350 (drawn at 2x, downsampled for clean edges). The other picture cards use original memes
# (see compose-meme-cards.py). Needs Pillow.
# Run: python3 scripts/generate-card-art.py
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

def save(im, name):
    im.convert("RGB").resize((1080, 1350), Image.LANCZOS).save(OUT + name + ".jpg", quality=88, optimize=True, progressive=True)

# ---------------------------------------------------------------- Minimal (glass)
def minimal():
    """Soft blurred colour blobs and rings, with a frosted-glass panel behind the numbers."""
    im = vgrad([(0, "#F8F7FC"), (1, "#EEF0F7")])
    blobs = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(blobs)
    for x, y, r, c, a in [(860, 230, 300, "#A78BFA", 235), (130, 470, 230, "#F9A8D4", 230), (840, 1110, 330, "#7DD3FC", 225),
                          (300, 110, 160, "#FDBA74", 170), (110, 1250, 210, "#C4B5FD", 200)]:
        d.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), fill=rgb(c) + (a,))
    im = Image.alpha_composite(im, blobs.filter(ImageFilter.GaussianBlur(55 * S)))
    rings = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(rings)
    for r, a in [(170, 120), (250, 90), (330, 60)]:
        d.ellipse(((860 - r) * S, (230 - r) * S, (860 + r) * S, (230 + r) * S), outline=(255, 255, 255, a), width=3 * S)
    im = Image.alpha_composite(im, rings.filter(ImageFilter.GaussianBlur(1.5 * S)))

    # Frosted glass: the backdrop inside the panel is blurred harder and lifted towards white.
    x0, y0, x1, y1, rad = 52 * S, 572 * S, 1028 * S, 1204 * S, 44 * S
    mask = Image.new("L", im.size, 0); ImageDraw.Draw(mask).rounded_rectangle((x0, y0, x1, y1), radius=rad, fill=255)
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 24 * S, x1, y1 + 24 * S), radius=rad, fill=(60, 50, 110, 40))
    im = Image.alpha_composite(im, shadow.filter(ImageFilter.GaussianBlur(36 * S)))
    frost = im.filter(ImageFilter.GaussianBlur(40 * S))
    frost = Image.alpha_composite(frost, Image.new("RGBA", im.size, (255, 255, 255, 140)))
    im.paste(frost, (0, 0), mask)
    edge = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(edge)
    d.rounded_rectangle((x0, y0, x1, y1), radius=rad, outline=(255, 255, 255, 230), width=3 * S)
    # Light catching the top edge.
    hl = Image.new("L", im.size, 0)
    ImageDraw.Draw(hl).rounded_rectangle((x0, y0, x1, y0 + 90 * S), radius=rad, fill=70)
    hl = Image.composite(hl, Image.new("L", im.size, 0), mask).filter(ImageFilter.GaussianBlur(20 * S))
    white = Image.new("RGBA", im.size, (255, 255, 255, 255)); white.putalpha(hl)
    im = Image.alpha_composite(Image.alpha_composite(im, white), edge)
    save(im, "minimal")

minimal()
import os
for n in ["minimal"]: print(n, os.path.getsize(OUT + n + ".jpg") // 1024, "KB")
