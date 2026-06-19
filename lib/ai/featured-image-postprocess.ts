import sharp, { type OverlayOptions } from "sharp";
import { readFile } from "fs/promises";
import path from "path";

export interface PostProcessOptions {
  title?: string | null;
  badge?: string;
}

const W = 1600;
const H = 900;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (lines.length >= maxLines) break;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.slice(0, maxChars);
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}

export async function postProcessFeaturedImage(
  input: Buffer,
  opts: PostProcessOptions = {}
): Promise<{ buffer: Buffer; ext: "jpg" }> {
  const base = sharp(input).resize(W, H, { fit: "cover" });
  const baseBuf = await base.png().toBuffer();

  const composites: OverlayOptions[] = [];

  // a) Left gradient for legibility
  const gradientSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="rgba(20,20,40,0.78)"/>
      <stop offset="0.5"  stop-color="rgba(20,20,40,0.18)"/>
      <stop offset="0.72" stop-color="rgba(20,20,40,0)"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`;
  composites.push({ input: Buffer.from(gradientSvg), top: 0, left: 0 });

  // b) Title overlay (up to 3 lines, ~18 chars each)
  if (opts.title) {
    const lines = wrap(opts.title, 18, 3);
    const fontSize = 62;
    const lineHeight = 76;
    const totalHeight = lines.length * lineHeight;
    const startY = Math.round((H - totalHeight) / 2) + fontSize;

    const textElements = lines
      .map(
        (line, i) =>
          `<text x="80" y="${startY + i * lineHeight}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`
      )
      .join("\n  ");

    const titleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${textElements}
</svg>`;
    composites.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });
  }

  // c) Badge (try to place to the right of any logo; logo is 40px wide + 8px gap = left:128)
  const badge = opts.badge ?? "Docbel · Article";
  const badgeText = escapeXml(badge);
  const charWidth = 7.5; // approximate px per char at ~13px font
  const badgePadX = 14;
  const badgePadY = 8;
  const badgeFontSize = 13;
  const badgeTextWidth = Math.ceil(badge.length * charWidth);
  const badgeW = badgeTextWidth + badgePadX * 2;
  const badgeH = badgeFontSize + badgePadY * 2;
  const badgeTop = 56;
  // Logo occupies left:80, size 40. Badge sits 8px to the right of the logo.
  const badgeLeft = 80 + 40 + 8;

  const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeW}" height="${badgeH}">
  <rect width="${badgeW}" height="${badgeH}" rx="6" ry="6" fill="#ffffffE6"/>
  <text x="${badgePadX}" y="${badgeFontSize + badgePadY - 2}" font-family="system-ui, sans-serif" font-size="${badgeFontSize}" fill="#1f2a44">${badgeText}</text>
</svg>`;
  composites.push({ input: Buffer.from(badgeSvg), top: badgeTop, left: badgeLeft });

  // d) Optional logo (app/icon.svg) — top-left corner
  try {
    const logo = await readFile(path.join(process.cwd(), "app", "icon.svg"));
    const logoPng = await sharp(logo).resize(40, 40).png().toBuffer();
    composites.push({ input: logoPng, top: 52, left: 80 });
  } catch {
    // No logo file — skip silently
  }

  const buffer = await sharp(baseBuf).composite(composites).jpeg({ quality: 88 }).toBuffer();

  return { buffer, ext: "jpg" };
}
