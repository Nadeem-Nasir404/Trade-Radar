# Local tooling script (not shipped) - turns meme images into 1080x1350 P&L card backgrounds.
# "full": the meme runs full-width under the top bar, a blurred copy fills the rest, and the lower
# part fades under a light shade. "fit": the meme sits centred in the art area (between the top bar and the
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
    "feelsgood": dict(src="feelsgood-meme.jpg", mode="fit", bg="#F7F7F7"),
    "rainy": dict(src="rainy-meme.jpg", mode="fit", bg="blur", feather=36, fade=(620, 860)),
    # Wolf of Wall Street stills, full-bleed behind the numbers.
    "wolf": dict(src="wolf-meme.jpg", mode="full", top=0, fade=(470, 720), max_alpha=0.55),
    "wolfpen": dict(src="wolfpen-meme.jpg", mode="full", top=110, fade=(620, 860)),
    # Cropped from the left so Leo sits nearer the middle, clear of the numbers.
    "wolfyacht": dict(src="wolfyacht-meme.jpg", mode="full", crop=(120, 0, 683, 449), top=90, fade=(600, 880)),
    # Statue starts at the sunglasses band so the face sits in the art area; a green shade (not black) under the numbers.
    "stoic": dict(src="stoic-meme.jpg", mode="full", crop=(0, 420, 736, 1308), top=0, fade=(520, 800), tint=(4, 30, 12), max_alpha=0.6),
    "patrick": dict(src="patrick-meme.jpg", mode="full", crop=(110, 40, 736, 666), top=0, fade=(560, 820)),
    "peter": dict(src="peter-meme.jpg", mode="full", crop=(40, 30, 716, 706), top=0, fade=(470, 740), max_alpha=0.6),
    # Tom sits low on the left where the numbers go, so he and the stacks are framed in the art area instead.
    "tom": dict(src="tom-meme.jpg", mode="fit", crop=(90, 330, 735, 905), bg="blur", feather=36, box=(118, 608, 30), fade=(620, 860)),
    "apuyacht": dict(src="apuyacht-meme.jpg", mode="full", crop=(40, 20, 716, 696), top=0, fade=(470, 740), max_alpha=0.6),
    "catpump": dict(src="catpump-meme.jpg", mode="full", top=0, fade=(480, 760), max_alpha=0.6),
    # Face cropped clear of the source's green frame; the cut sides fade into white.
    "onepercent": dict(src="onepercent-meme.jpg", mode="fit", crop=(0, 230, 668, 930), bg="#FFFFFF", box=(118, 608, 30), edge_fade=dict(sides=16, bottom=40)),
    # I Am Atomic: titles cropped off. The red-moon poster runs full-bleed under a purple shade;
    # the black-and-white one is just the moon, set in the art area on black.
    "atomic": dict(src="atomic-meme.jpg", mode="full", crop=(0, 150, 857, 1200), top=0, fade=(520, 800), tint=(36, 8, 40), max_alpha=0.6),
    "atomicmoon": dict(src="atomicmoon-meme.jpg", mode="fit", crop=(75, 258, 675, 858), bg="#000000", box=(112, 608, 30)),
    # Loss memes.
    "bogdanoff": dict(src="bogdanoff-meme.jpg", mode="fit", crop=(74, 74, 480, 480), bg="blur", feather=30, box=(176, 604, 30), fade=(620, 860)),
    "pepedump": dict(src="pepedump-meme.jpg", mode="full", top=110, fade=(600, 840)),
    # Bear on its own red: framed in the art area over a darker red so the numbers stay readable.
    "bear": dict(src="bear-meme.jpg", mode="fit", bg=("#C21129", "#3A0810"), feather=60, box=(112, 608, 30)),
    # Gigachad and Bateman stills, faces in the art area.
    "gigaphone": dict(src="gigaphone-meme.jpg", mode="full", crop=(0, 90, 736, 736), top=0, fade=(520, 800)),
    "gigadesk": dict(src="gigadesk-meme.jpg", mode="full", top=70, fade=(540, 820)),
    "bateman": dict(src="bateman-meme.jpg", mode="full", crop=(0, 90, 735, 878), top=0, fade=(520, 800)),
    # Stickers: cut out of their grey backdrop and set larger on a soft tinted gradient.
    "diamond": dict(src="diamond-meme.jpg", mode="fit", crop=(0, 232, 750, 712), cutout=True, box=(118, 608, 30), edge_fade=dict(bottom=70), bg=("#DCEFFF", "#FFFFFF"), glow="#BFE3FF"),
    "moneyrain": dict(src="moneyrain-meme.jpg", mode="fit", crop=(0, 96, 387, 446), cutout=True, box=(118, 608, 30), edge_fade=dict(bottom=60, top=30, sides=70), bg=("#DDF7E6", "#FFFFFF"), glow="#BBF7D0"),
    # Poster without its title; a soft plum tint (not black) behind the numbers keeps the pastels.
    "kurumi": dict(src="kurumi-meme.jpg", mode="full", crop=(0, 0, 466, 468), top=0, fade=(470, 760), tint=(110, 22, 88), max_alpha=0.6),
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


def shade(card, fade, top_bar=True, tint=(4, 4, 8), max_alpha=0.45):
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
            sd.line([(0, y), (W, y)], fill=(*tint, int(255 * (0.08 + (max_alpha - 0.08) * t))))
    return Image.alpha_composite(card, layer)


def cutout(img, tolerance=18):
    """Makes the flat backdrop transparent by flood-filling from the border (enclosed whites stay)."""
    rgba = img.convert("RGBA")
    marker = (255, 0, 255)
    filled = img.copy()
    for x, y in [(0, 0), (img.width - 1, 0), (0, img.height - 1), (img.width - 1, img.height - 1)]:
        ImageDraw.floodfill(filled, (x, y), marker, thresh=tolerance)
    import numpy as np
    alpha = np.where(np.all(np.array(filled) == marker, axis=-1), 0, 255).astype("uint8")
    # Soften the cut edge a touch so it doesn't look jagged when scaled up.
    rgba.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
    return rgba


def gradient(top, bottom):
    a, b = Image.new("RGBA", (W, H), top), Image.new("RGBA", (W, H), bottom)
    mask = Image.linear_gradient("L").resize((W, H))
    return Image.composite(b, a, mask)


def compose(spec):
    src = Image.open(os.path.join(CARDS, "source", spec["src"])).convert("RGB")
    if spec.get("crop"):
        src = src.crop(spec["crop"])

    if spec["mode"] == "full":
        card = blurred_cover(src)
        mh = int(src.height * W / src.width)
        meme = src.resize((W, mh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2)).convert("RGBA")
        meme.putalpha(feather_mask(W, mh, top=40 if spec["top"] else 0, bottom=140))
        card.alpha_composite(meme, (0, spec["top"]))
        extra = {k: spec[k] for k in ("tint", "max_alpha") if k in spec}
        return shade(card, spec["fade"], **extra).convert("RGB")

    # fit: centred in the art area (or a custom box), upscaled at most ~1.8x so it stays sharp.
    top, bottom, margin = spec.get("box", (ART_TOP, ART_BOTTOM, 100))
    box_w, box_h = W - 2 * margin, bottom - top
    scale = min(box_w / src.width, box_h / src.height)
    mw, mh = int(src.width * scale), int(src.height * scale)
    art = cutout(src) if spec.get("cutout") else src.convert("RGBA")
    meme = art.resize((mw, mh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.5, percent=60, threshold=2))
    f = spec.get("feather", 0)
    if f:
        meme.putalpha(feather_mask(mw, mh, top=f, bottom=f, sides=f))
    if spec.get("edge_fade"):
        # Where the source cuts the art off (the waist, the bills at the edges), fade it out instead of a hard edge.
        import numpy as np
        a = np.array(meme.getchannel("A")).astype("float32")
        a *= np.array(feather_mask(mw, mh, **spec["edge_fade"])).astype("float32") / 255
        meme.putalpha(Image.fromarray(a.astype("uint8")))
    if spec["bg"] == "blur":
        card = blurred_cover(src)
    elif isinstance(spec["bg"], tuple):
        card = gradient(*spec["bg"])
    else:
        card = Image.new("RGBA", (W, H), spec["bg"])
    if spec.get("glow"):
        # Blur only the mask: blurring a coloured shape on a transparent layer would bleed black into it.
        mask = Image.new("L", (W, H), 0)
        cy = top + box_h // 2
        ImageDraw.Draw(mask).ellipse((W / 2 - 420, cy - 260, W / 2 + 420, cy + 260), fill=255)
        card = Image.composite(Image.new("RGBA", (W, H), spec["glow"]), card, mask.filter(ImageFilter.GaussianBlur(90)))
    card.alpha_composite(meme, ((W - mw) // 2, top + (box_h - mh) // 2))
    if spec["bg"] == "blur":
        card = shade(card, spec.get("fade"))
    return card.convert("RGB")


for name, spec in MEMES.items():
    out = os.path.join(CARDS, name + ".jpg")
    compose(spec).save(out, quality=88, optimize=True, progressive=True)
    print(name, os.path.getsize(out) // 1024, "KB")
