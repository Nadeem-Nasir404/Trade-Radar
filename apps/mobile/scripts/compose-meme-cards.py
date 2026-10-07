# Local tooling script (not shipped) - turns landscape meme images into 1080x1350 P&L card
# backgrounds: the meme runs full-width near the top (above the card's numbers), a blurred copy
# fills the rest, and the lower part fades dark so the numbers stay readable.
# Sources live in assets/cards/source/ (not referenced by the app, so not bundled).
# Run: python3 scripts/compose-meme-cards.py
import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(HERE, "..", "assets", "cards")
W, H = 1080, 1350

# name: (source file, crop box in source px or None, top offset on the card, fade start/end y)
MEMES = {
    "stonks": ("stonks-meme.jpg", None, 120, (600, 820)),
    # The source has a thin black border; crop it off.
    "printer": ("printer-meme.jpg", (5, 5, 587, 332), 150, (600, 780)),
}


def compose(source, crop, top, fade):
    src = Image.open(os.path.join(CARDS, "source", source)).convert("RGB")
    if crop:
        src = src.crop(crop)
    # Backdrop: the meme itself, scaled to cover, blurred and darkened.
    scale = max(W / src.width, H / src.height)
    bg = src.resize((int(src.width * scale), int(src.height * scale)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(40))).enhance(0.45).convert("RGBA")

    # The meme full-width, sharpened after upscaling, with soft top and bottom edges.
    mh = int(src.height * W / src.width)
    meme = src.resize((W, mh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2)).convert("RGBA")
    mask = Image.new("L", (W, mh), 255)
    md = ImageDraw.Draw(mask)
    for y in range(40):
        md.line([(0, y), (W, y)], fill=int(255 * y / 40))
    for y in range(140):
        md.line([(0, mh - 1 - y), (W, mh - 1 - y)], fill=int(255 * y / 140))
    meme.putalpha(mask)
    bg.alpha_composite(meme, (0, top))

    # Darken behind the top bar (logo, name, status pill) and fade the lower part for the numbers.
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(0, 200):
        sd.line([(0, y), (W, y)], fill=(0, 0, 0, int(140 * (1 - y / 200))))
    f0, f1 = fade
    for y in range(f0, H):
        t = min(1, (y - f0) / (f1 - f0))
        sd.line([(0, y), (W, y)], fill=(4, 4, 8, int(255 * (0.3 + 0.64 * t))))
    return Image.alpha_composite(bg, shade).convert("RGB")


for name, (source, crop, top, fade) in MEMES.items():
    out = os.path.join(CARDS, name + ".jpg")
    compose(source, crop, top, fade).save(out, quality=88, optimize=True, progressive=True)
    print(name, os.path.getsize(out) // 1024, "KB")
