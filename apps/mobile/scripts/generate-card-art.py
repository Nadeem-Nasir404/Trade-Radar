# Local tooling script (not shipped) - generates the illustrated P&L card backgrounds Anime and
# Diamond Hands (printer()/stonks() are earlier drawn versions, now replaced by the original memes) at 1080x1350 (drawn at 2x, downsampled for clean edges). Artwork
# stays between the card's top bar and its tagline (y 190-560); the lower part fades dark for the
# numbers. Needs Pillow, the repo's node_modules (for Anton) and the WenQuanYi font (for katakana).
# Run: python3 scripts/generate-card-art.py
import math, random, glob
from PIL import Image, ImageDraw, ImageFilter, ImageFont
S = 2
W, H = 1080 * S, 1350 * S
OUT = "/home/user/Trade-Radar/apps/mobile/assets/cards/"
NM = "/home/user/Trade-Radar/node_modules/.pnpm/"
ANTON = glob.glob(NM + "@expo-google-fonts+anton*/node_modules/@expo-google-fonts/anton/400Regular/*.ttf")[0]
JP = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

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

def outlined_text(im, xy, text, font, fill, stroke, sw, angle=0, anchor="mm"):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    d.text(xy, text, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor=anchor)
    if angle: layer = layer.rotate(angle, center=xy, resample=Image.BICUBIC)
    return Image.alpha_composite(im, layer)

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
    # "ゴゴゴ" menacing aura down the right edge.
    font = ImageFont.truetype(JP, 150 * S)
    for i, (x, y, ang) in enumerate([(890, 330, 12), (935, 510, -8), (880, 690, 10), (930, 870, -6)]):
        im = outlined_text(im, (x * S, y * S), "ゴ", font, (168, 85, 247, 235), (255, 255, 255, 255), 6 * S, ang)
    d = ImageDraw.Draw(im)
    for _ in range(26):
        x, y = random.uniform(80, 1000) * S, random.uniform(200, 560) * S
        sparkle(d, x, y, random.uniform(6, 20) * S, (255, 255, 255, random.randint(150, 240)))
    im = bottom_scrim(im, 0.42, 0.4)
    save(im, "anime")

# ---------------------------------------------------------------- Money printer
def bill(w, h, rot, blur=0):
    b = Image.new("RGBA", (int(w * 1.6), int(h * 2.4)), (0, 0, 0, 0)); d = ImageDraw.Draw(b)
    ox, oy = (b.width - w) / 2, (b.height - h) / 2
    d.rounded_rectangle((ox, oy, ox + w, oy + h), radius=8 * S, fill=(134, 239, 172, 255), outline=(21, 128, 61, 255), width=4 * S)
    d.rounded_rectangle((ox + 10 * S, oy + 10 * S, ox + w - 10 * S, oy + h - 10 * S), radius=6 * S, outline=(22, 163, 74, 255), width=2 * S)
    cx, cy = ox + w / 2, oy + h / 2
    d.ellipse((cx - h * 0.36, cy - h * 0.36, cx + h * 0.36, cy + h * 0.36), fill=(74, 222, 128, 255), outline=(21, 128, 61, 255), width=3 * S)
    f = ImageFont.truetype(ANTON, int(h * 0.5)); fs = ImageFont.truetype(ANTON, int(h * 0.22))
    d.text((cx, cy), "$", font=f, fill=(20, 83, 45, 255), anchor="mm")
    for (tx, ty, an) in [(ox + 22 * S, oy + 18 * S, "lt"), (ox + w - 22 * S, oy + h - 18 * S, "rb")]:
        d.text((tx, ty), "100", font=fs, fill=(20, 83, 45, 255), anchor=an)
    b = b.rotate(rot, resample=Image.BICUBIC, expand=True)
    return b.filter(ImageFilter.GaussianBlur(blur)) if blur else b

def printer():
    random.seed(11)
    im = vgrad([(0, "#06301A"), (0.4, "#0B4A26"), (0.7, "#062615"), (1, "#020D07")])
    im = glow(im, 620 * S, 330 * S, 420 * S, "#22C55E", 110)
    # Back bills blurred for depth, front bills sharp.
    for layer, n, scale, blur in [(0, 9, 0.6, 5 * S), (1, 8, 0.85, 1.5 * S), (2, 5, 1.05, 0)]:
        for _ in range(n):
            w = int(250 * S * scale); h = int(115 * S * scale)
            b = bill(w, h, random.uniform(-40, 40), blur)
            x = int(random.uniform(-60, 1100) * S); y = int(random.uniform(270, 530) * S)
            im.alpha_composite(b, (x - b.width // 2, y - b.height // 2))
    # Motion streaks.
    d = ImageDraw.Draw(im)
    for _ in range(40):
        x, y = random.uniform(0, 1080) * S, random.uniform(220, 540) * S
        d.line([(x, y), (x - random.uniform(60, 160) * S, y + random.uniform(10, 40) * S)], fill=(187, 247, 208, 70), width=3 * S)
    im = outlined_text(im, (620 * S, 340 * S), "BRRRR", ImageFont.truetype(ANTON, 190 * S), (250, 204, 21, 255), (10, 10, 0, 255), 12 * S, 8)
    im = bottom_scrim(im, 0.42, 0.86)
    save(im, "printer")

# ---------------------------------------------------------------- Stonks
def stonks():
    random.seed(3)
    im = vgrad([(0, "#0B1A3A"), (0.5, "#0B1530"), (1, "#05080F")])
    d = ImageDraw.Draw(im)
    for x in range(0, W, 54 * S): d.line([(x, 0), (x, H)], fill=(96, 165, 250, 22), width=S)
    for y in range(0, H, 54 * S): d.line([(0, y), (W, y)], fill=(96, 165, 250, 22), width=S)
    # Faint rising candles behind the arrow.
    for i in range(16):
        x = (60 + i * 64) * S; top = (400 - i * 12 + random.uniform(-30, 30)) * S; hgt = random.uniform(50, 120) * S
        up = random.random() > 0.3; c = (34, 197, 94, 70) if up else (239, 68, 68, 60)
        d.line([(x + 14 * S, top - 30 * S), (x + 14 * S, top + hgt + 30 * S)], fill=c, width=3 * S)
        d.rectangle((x, top, x + 28 * S, top + hgt), fill=c)
    im = glow(im, 820 * S, 260 * S, 360 * S, "#F97316", 90)
    pts = [(-20, 500), (220, 385), (350, 450), (600, 290), (720, 352), (860, 262)]
    pts = [(x * S, y * S) for x, y in pts]
    def band(points, width, color):
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); dd = ImageDraw.Draw(layer)
        dd.line(points, fill=color, width=width, joint="curve")
        return layer
    # Head: triangle pointing along the last segment.
    (x0, y0), (x1, y1) = pts[-2], pts[-1]
    ang = math.atan2(y1 - y0, x1 - x0); L, Wd = 120 * S, 95 * S
    tip = (x1 + math.cos(ang) * L, y1 + math.sin(ang) * L)
    left = (x1 + math.cos(ang + math.pi / 2) * Wd, y1 + math.sin(ang + math.pi / 2) * Wd)
    right = (x1 + math.cos(ang - math.pi / 2) * Wd, y1 + math.sin(ang - math.pi / 2) * Wd)
    off = 22 * S
    shadow = band([(x + off, y + off) for x, y in pts], 78 * S, (127, 29, 29, 255))
    ImageDraw.Draw(shadow).polygon([(p[0] + off, p[1] + off) for p in (tip, left, right)], fill=(127, 29, 29, 255))
    im = Image.alpha_composite(im, shadow)
    main = band(pts, 78 * S, (249, 115, 22, 255))
    ImageDraw.Draw(main).polygon([tip, left, right], fill=(249, 115, 22, 255))
    # Lighter top edge for a 3D look.
    hi = band([(x, y - 18 * S) for x, y in pts], 20 * S, (253, 186, 116, 255))
    im = Image.alpha_composite(im, main); im = Image.alpha_composite(im, hi)
    d = ImageDraw.Draw(im)
    for _ in range(14):
        sparkle(d, random.uniform(500, 1040) * S, random.uniform(200, 520) * S, random.uniform(6, 14) * S, (255, 237, 213, 200))
    im = bottom_scrim(im, 0.42, 0.86)
    save(im, "stonks")

# ---------------------------------------------------------------- Diamond hands
def diamond(im, cx, cy, size, alpha=255, blur=0):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    s = size; top = cy - s * 0.42; girdle = cy - s * 0.12; tip = (cx, cy + s * 0.62)
    tl, tr = (cx - s * 0.32, top), (cx + s * 0.32, top)
    gl, gr = (cx - s * 0.62, girdle), (cx + s * 0.62, girdle)
    m1, m2, m3 = (cx - s * 0.2, girdle), (cx, girdle), (cx + s * 0.2, girdle)
    facets = [
        ([tl, tr, m2], (186, 230, 253)), ([gl, tl, m1], (125, 211, 252)), ([tl, m1, m2], (224, 242, 254)),
        ([tr, gr, m3], (56, 189, 248)), ([tr, m2, m3], (165, 243, 252)),
        ([gl, m1, tip], (14, 116, 144)), ([m1, m2, tip], (34, 211, 238)), ([m2, m3, tip], (8, 145, 178)), ([m3, gr, tip], (21, 94, 117)),
    ]
    for poly, c in facets: d.polygon(poly, fill=c + (alpha,))
    for a, b in [(tl, tr), (gl, gr), (gl, tip), (gr, tip), (tl, m1), (tr, m3), (tl, m2), (tr, m2), (m1, tip), (m2, tip), (m3, tip), (gl, tl), (gr, tr)]:
        d.line([a, b], fill=(240, 249, 255, int(alpha * 0.7)), width=max(1, int(size / 160)))
    if blur: layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(im, layer)

def diamonds():
    random.seed(5)
    im = vgrad([(0, "#041A2E"), (0.45, "#0A2F4D"), (1, "#0B3555")])
    im = glow(im, 700 * S, 360 * S, 420 * S, "#22D3EE", 120)
    for (x, y, s, bl) in [(170, 300, 120, 3), (380, 500, 80, 4), (975, 500, 100, 3), (110, 470, 70, 5)]:
        im = diamond(im, x * S, y * S, s * S, 170, bl * S)
    im = diamond(im, 700 * S, 380 * S, 420 * S)
    d = ImageDraw.Draw(im)
    for (x, y, r) in [(920, 220, 34), (520, 230, 22), (880, 520, 18), (600, 560, 14), (430, 330, 12)]:
        sparkle(d, x * S, y * S, r * S)
    for _ in range(30):
        sparkle(d, random.uniform(60, 1020) * S, random.uniform(200, 560) * S, random.uniform(3, 9) * S, (207, 250, 254, random.randint(110, 220)))
    im = bottom_scrim(im, 0.42, 0.4)
    save(im, "diamond")

anime(); diamonds()
import os
for n in ["anime", "diamond"]: print(n, os.path.getsize(OUT + n + ".jpg") // 1024, "KB")
