// One-off local tooling script (not shipped, not run by EAS) - regenerates every app icon /
// splash / notification asset from a single vector mark, so they all stay visually consistent.
// Run with: node scripts/generate-icons.js
const sharp = require("sharp");
const path = require("path");

const ASSETS = path.join(__dirname, "..", "assets");

// The "breakout" mark: a price line crossing up through a level with an arrow - reused from the
// in-app <Logo> component (src/components/logo.tsx) so the app icon and in-app wordmark read as
// the same brand, just at different scales.
const MARK_PATH = "M3 14L8 9L12 13L21 4 M15 4H21V10";

const BRAND_START = "#8B5CF6";
const BRAND_END = "#6D28D9";

function markSvg({ size, strokeWidth, color, background }) {
  // The path lives in a 24x24 box; center it with generous padding so it survives adaptive-icon
  // masking (circle/squircle/rounded-square) without clipping.
  const scale = size * 0.5 / 24;
  const offset = (size - 24 * scale) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${background ?? ""}
    <g transform="translate(${offset},${offset}) scale(${scale})">
      <path d="${MARK_PATH}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

function gradientDef(id) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BRAND_START}"/>
    <stop offset="1" stop-color="${BRAND_END}"/>
  </linearGradient></defs>`;
}

async function write(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(ASSETS, file));
  console.log("wrote", file, `${size}x${size}`);
}

async function main() {
  // Main app icon (iOS + generic + web) - full-bleed brand gradient square, white mark.
  {
    const size = 1024;
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${gradientDef("g")}
      <rect width="${size}" height="${size}" fill="url(#g)"/>
      ${markSvg({ size, strokeWidth: 2.6, color: "#ffffff" }).replace(/<svg[^>]*>|<\/svg>/g, "")}
    </svg>`;
    await write(svg, size, "icon.png");
    await write(svg, 48, "favicon.png");
  }

  // Android adaptive icon background - gradient only, no mark (foreground carries it).
  {
    const size = 512;
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      ${gradientDef("g")}
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`;
    await write(svg, size, "android-icon-background.png");
  }

  // Android adaptive icon foreground - transparent bg, white mark within the safe zone.
  {
    const size = 512;
    const svg = markSvg({ size, strokeWidth: 2.4, color: "#ffffff" });
    await write(svg, size, "android-icon-foreground.png");
  }

  // Android 13+ themed (monochrome) icon - same mark, single flat color, OS tints it itself.
  {
    const size = 432;
    const svg = markSvg({ size, strokeWidth: 2.4, color: "#ffffff" });
    await write(svg, size, "android-icon-monochrome.png");
  }

  // Splash icon - transparent bg (splash background color comes from app.json), brand-purple mark.
  {
    const size = 1024;
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${gradientDef("g")}
      ${markSvg({ size, strokeWidth: 2.2, color: "url(#g)" }).replace(/<svg[^>]*>|<\/svg>/g, "")}
    </svg>`;
    await write(svg, size, "splash-icon.png");
  }

  // Notification tray icon - Android forces these to a flat white silhouette regardless of what
  // color you give it, so author it as exactly that: bold, simple, transparent background.
  {
    const size = 256;
    const svg = markSvg({ size, strokeWidth: 3.2, color: "#ffffff" });
    await write(svg, size, "notification-icon.png");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
