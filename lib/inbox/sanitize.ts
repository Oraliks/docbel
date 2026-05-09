import DOMPurify from "dompurify";

export interface SanitizeResult {
  html: string;
  blockedImageCount: number;
}

const ALLOWED_TAGS = [
  "a", "b", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "th", "thead", "tr", "u", "ul", "blockquote",
];

const ALLOWED_ATTR = [
  "href", "title", "alt", "data-blocked-src", "src", "style", "class",
  "target", "rel", "width", "height", "colspan", "rowspan",
];

/**
 * Sanitize raw email HTML for safe rendering. Optionally rewrites all
 * remote `<img>` tags so they don't auto-load (tracking pixels are common
 * in marketing emails). The original src is preserved in `data-blocked-src`
 * so the user can opt-in to load images per email.
 *
 * Pure-client function — uses the DOM via DOMPurify directly.
 */
export function sanitizeEmailHtml(
  html: string,
  blockRemoteImages: boolean
): SanitizeResult {
  let blockedImageCount = 0;
  let preprocessed = html;

  if (blockRemoteImages) {
    preprocessed = html.replace(
      /<img\b([^>]*?)\bsrc\s*=\s*(['"])([^'"]+)\2([^>]*)>/gi,
      (_match, before, _quote, src, after) => {
        // Allow inline data: and cid: images (cid: are inline attachments)
        if (/^(?:data:|cid:)/i.test(src)) {
          return `<img${before}src="${src}"${after}>`;
        }
        blockedImageCount++;
        return `<img${before}data-blocked-src="${src}" data-blocked="1"${after} alt="🖼️ image bloquée">`;
      }
    );
  }

  const clean = DOMPurify.sanitize(preprocessed, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|cid:|data:image\/)/i,
    ADD_ATTR: ["target"], // ensure target survives sanitization
  });

  return { html: clean, blockedImageCount };
}

/**
 * Reverse the blocking — restore original `src` from `data-blocked-src`
 * so images actually load. Used when the admin clicks "Show images".
 */
export function unblockImages(html: string): string {
  return html.replace(
    /<img\b([^>]*?)\bdata-blocked-src\s*=\s*(['"])([^'"]+)\2([^>]*?)\bdata-blocked\s*=\s*['"]?1['"]?([^>]*)>/gi,
    (_m, before, _q, src, mid, after) =>
      `<img${before}src="${src}"${mid}${after}>`
  );
}
