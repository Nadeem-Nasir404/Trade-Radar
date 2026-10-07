// One-off local tooling script (not shipped, not run by EAS) - regenerates every app icon /
// splash / notification asset from the brand SVGs in assets/brand/, so they all stay consistent.
// Run with: node scripts/generate-icons.js
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "assets");
const BRAND = path.join(ASSETS, "brand");

const BRAND_START = "#8B5CF6";
const BRAND_END = "#6D28D9";

// icon-dark.svg: full-bleed dark canvas with the glossy brand tile (app icon, favicon).
// icon-transparent.svg: the same tile on a transparent canvas (splash).
// mark-white.svg: the flat white arrow-and-ring glyph (adaptive foreground, monochrome, notification).
const dark = fs.readFileSync(path.join(BRAND, "icon-dark.svg"));
const transparent = fs.readFileSync(path.join(BRAND, "icon-transparent.svg"));
const mark = fs.readFileSync(path.join(BRAND, "mark-white.svg"));

async function writeFull(input, size, file) {
  await sharp(input, { density: 144 }).resize(size, size).png().toFile(path.join(ASSETS, file));
  console.log("wrote", file, `${size}x${size}`);
}

// Draws the glyph centered on a transparent square. `scale` keeps it inside the safe zone
// (adaptive icons crop to a circle; Android notifications and monochrome icons need padding too).
async function writeMark(size, scale, file) {
  const inner = Math.round(size * scale);
  const glyph = await sharp(mark, { density: 144 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: glyph, gravity: "center" }])
    .png()
    .toFile(path.join(ASSETS, file));
  console.log("wrote", file, `${size}x${size}`);
}

async function main() {
  // Main app icon (iOS + generic) and favicon - full-bleed dark canvas with the brand tile.
  await writeFull(dark, 1024, "icon.png");
  await writeFull(dark, 48, "favicon.png");

  // Android adaptive icon background - the brand gradient, matching the tile.
  {
    const size = 512;
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${BRAND_START}"/>
        <stop offset="1" stop-color="${BRAND_END}"/>
      </linearGradient></defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(ASSETS, "android-icon-background.png"));
    console.log("wrote android-icon-background.png 512x512");
  }

  // Android adaptive icon foreground - white glyph inside the 66dp safe zone.
  await writeMark(512, 0.72, "android-icon-foreground.png");

  // Android 13+ themed (monochrome) icon - same glyph, OS tints it.
  await writeMark(432, 0.72, "android-icon-monochrome.png");

  // Splash icon - the tile on transparent (splash background color comes from app.json).
  await writeFull(transparent, 1024, "splash-icon.png");

  // Notification tray icon - Android renders it as a white silhouette.
  await writeMark(256, 0.9, "notification-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
