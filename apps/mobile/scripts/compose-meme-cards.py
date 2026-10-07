# Local tooling script (not shipped) - turns meme images into 1080x1350 P&L card backgrounds.
# "full": the meme runs full-width under the top bar, a blurred copy fills the rest, and the lower
# part fades dark. "fit": the meme sits centred in the art area (between the top bar and the
# tagline) on a solid colour or a blurred copy of itself - light memes on matching light grey.
# Sources live in assets/cards/source/ (not referenced by the app, so not bundled).
# Run: python3 scripts/compose-meme-cards.py
import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(HERE, "..", "assets", "cards")
W, H = 1080, 1350

# Art area: between the card's top bar and its tagline.
ART_TOP, ART_BOTTOM = 178, 598

MEMES = {
    # name: dict(src, mode, crop, top (full), bg (fit: "blur" or "#hex"), feather, fade)
    "stonks": dict(src="stonks-meme.jpg", mode="full", top=120, fade=(600, 820)),
    # The source has a thin black border; crop it off.
    "printer": dict(src="printer-meme.jpg", mode="full", crop=(5, 5, 587, 332), top=150, fade=(600, 780)),
    # Face kept above the numbers; the blurred sunset fills the rest of the card.
    "fine": dict(src="fine-meme.jpg", mode="fit", bg="blur", feather=40, fade=(620, 860)),
    "wojak": dict(src="wojak-meme.jpg", mode="fit", bg="#FFFFFF"),
    "notover": dict(src="notover-meme.jpg", mode="fit", bg="#F8F8F8"),
    "feelsgood": dict(src="feelsgood-meme.jpg", mode="fit", bg="#F7F7F7"),
    "rainy": dict(src="rainy-meme.jpg", mode="fit", bg="blur", feather=36, fade=(620, 860)),
}


def blurred_cover(src):
    scale = max(W / src.width, H / src.height)
    bg = src.resize((int(src.width * scale), int(src.height * scale)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    return ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(40))).enhance(0.62).convert("RGBA")


def feather_mask(w, h, top=0, bottom=0, sides=0):
    mask = Image.new("L", (w, h), 255)
    md = ImageDraw.Draw(mask)
    for i in range(max(top, bottom, sides)):
        if i < top:
            md.line([(0, i), (w, i)], fill=int(255 * i / top))
        if i < bottom:
            md.line([(0, h - 1 - i), (w, h - 1 - i)], fill=int(255 * i / bottom))
    if sides:
        side = Image.new("L", (w, h), 255)
        sd = ImageDraw.Draw(side)
        for i in range(sides):
            v = int(255 * i / sides)
            sd.line([(i, 0), (i, h)], fill=v)
            sd.line([(w - 1 - i, 0), (w - 1 - i, h)], fill=v)
        mask = Image.fromarray(__import__("numpy").minimum(__import__("numpy").array(mask), __import__("numpy").array(side)))
    return mask


def shade(card, fade, top_bar=True):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(layer)
    if top_bar:
        for y in range(0, 200):
            sd.line([(0, y), (W, y)], fill=(0, 0, 0, int(140 * (1 - y / 200))))
    if fade:
        f0, f1 = fade
        for y in range(f0, H):
            t = min(1, (y - f0) / (f1 - f0))
            # Light shade only: the picture carries on to the bottom; text shadows keep numbers readable.
            sd.line([(0, y), (W, y)], fill=(4, 4, 8, int(255 * (0.08 + 0.37 * t))))
    return Image.alpha_composite(card, layer)


def compose(spec):
    src = Image.open(os.path.join(CARDS, "source", spec["src"])).convert("RGB")
    if spec.get("crop"):
        src = src.crop(spec["crop"])

    if spec["mode"] == "full":
        card = blurred_cover(src)
        mh = int(src.height * W / src.width)
        meme = src.resize((W, mh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2)).convert("RGBA")
        meme.putalpha(feather_mask(W, mh, top=40, bottom=140))
        card.alpha_composite(meme, (0, spec["top"]))
        return shade(card, spec["fade"]).convert("RGB")

    # fit: centred in the art area, upscaled at most ~1.8x so it stays sharp.
    box_w, box_h = W - 2 * 100, ART_BOTTOM - ART_TOP
    scale = min(box_w / src.width, box_h / src.height)
    mw, mh = int(src.width * scale), int(src.height * scale)
    meme = src.resize((mw, mh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.5, percent=60, threshold=2)).convert("RGBA")
    if spec["bg"] == "blur":
        card = blurred_cover(src)
        f = spec.get("feather", 0)
        meme.putalpha(feather_mask(mw, mh, top=f, bottom=f, sides=f))
    else:
        card = Image.new("RGBA", (W, H), spec["bg"])
    card.alpha_composite(meme, ((W - mw) // 2, ART_TOP + (box_h - mh) // 2))
    if spec["bg"] == "blur":
        card = shade(card, spec.get("fade"))
    return card.convert("RGB")


for name, spec in MEMES.items():
    out = os.path.join(CARDS, name + ".jpg")
    compose(spec).save(out, quality=88, optimize=True, progressive=True)
    print(name, os.path.getsize(out) // 1024, "KB")
