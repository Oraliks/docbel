import { ImageResponse } from "next/og";

// Open Graph image generator for shared article links.
// Renders a 1200×630 PNG used as the unfurl preview on WhatsApp / iMessage /
// social platforms when an article has no featured image.
//
// Runtime note: Satori (the engine behind ImageResponse) supports a narrow CSS
// subset. NO backdrop-filter, NO external font fetch, every flex parent with
// >1 child must declare `display: flex`. We rely on ImageResponse's built-in
// default font, so no network call at render time → reliable on Netlify.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette — mirrors the violet/mauve tokens in app/globals.css
// (--glass-status-from #7C3AED, --glass-accent-deep #5B46E5, accents 9f7cff /
// d08cff / ff8cc0). Deep indigo #2a0f4d = --glass-ink.
const VIOLET = "#7C3AED";
const VIOLET_DEEP = "#5b21b6";
const INDIGO = "#2a0f4d";
const ACCENT_A = "#9f7cff";
const ACCENT_B = "#d08cff";
const ACCENT_PINK = "#ff8cc0";

function clamp(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const title = clamp(searchParams.get("title") || "Actualité Docbel", 120);
    const cat = searchParams.get("cat")?.trim() || "";

    return new ImageResponse(
      (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
            overflow: "hidden",
            // Layered radial + linear gradients → premium, never flat.
            backgroundColor: VIOLET_DEEP,
            backgroundImage: `radial-gradient(1100px 760px at 82% -8%, ${ACCENT_A} 0%, rgba(159,124,255,0) 55%), radial-gradient(900px 700px at 8% 110%, ${ACCENT_PINK} 0%, rgba(255,140,192,0) 50%), linear-gradient(135deg, ${VIOLET} 0%, ${VIOLET_DEEP} 48%, ${INDIGO} 100%)`,
            fontFamily: "sans-serif",
            color: "#ffffff",
          }}
        >
          {/* ── Floating 3D-looking decorative tiles ───────────────────── */}
          {/* Large rounded square, rotated, soft shadow → reads as a tile. */}
          <div
            style={{
              position: "absolute",
              top: "-120px",
              right: "-90px",
              width: "440px",
              height: "440px",
              borderRadius: "72px",
              transform: "rotate(18deg)",
              backgroundImage: `linear-gradient(150deg, ${ACCENT_B} 0%, ${VIOLET} 100%)`,
              opacity: 0.55,
              boxShadow: "0 40px 90px rgba(20,4,60,0.55)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          />
          {/* Smaller tile peeking from the bottom-right, different angle. */}
          <div
            style={{
              position: "absolute",
              bottom: "-110px",
              right: "180px",
              width: "260px",
              height: "260px",
              borderRadius: "52px",
              transform: "rotate(-14deg)",
              backgroundImage: `linear-gradient(160deg, ${ACCENT_PINK} 0%, ${VIOLET} 100%)`,
              opacity: 0.4,
              boxShadow: "0 30px 70px rgba(20,4,60,0.5)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          />
          {/* Soft glowing circle for atmospheric depth. */}
          <div
            style={{
              position: "absolute",
              top: "300px",
              left: "-130px",
              width: "320px",
              height: "320px",
              borderRadius: "320px",
              backgroundImage: `radial-gradient(circle at 35% 35%, ${ACCENT_A} 0%, rgba(123,58,237,0) 70%)`,
              opacity: 0.7,
            }}
          />
          {/* Big document glyph (inline SVG) with drop-shadow → floating icon. */}
          <div
            style={{
              position: "absolute",
              top: "210px",
              right: "120px",
              display: "flex",
              transform: "rotate(8deg)",
              opacity: 0.92,
            }}
          >
            <svg
              width="220"
              height="220"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: "drop-shadow(0 22px 40px rgba(15,3,45,0.55))" }}
            >
              <path
                d="M6 2.5h7L19 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
                fill="rgba(255,255,255,0.95)"
              />
              <path d="M13 2.5 19 8h-5a1 1 0 0 1-1-1V2.5Z" fill={ACCENT_B} />
              <rect x="8" y="11" width="8" height="1.6" rx="0.8" fill={VIOLET} />
              <rect x="8" y="14.2" width="8" height="1.6" rx="0.8" fill={ACCENT_A} />
              <rect x="8" y="17.4" width="5" height="1.6" rx="0.8" fill={ACCENT_PINK} />
            </svg>
          </div>

          {/* ── Top row: glassy Docbel wordmark pill + category chip ─────── */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "14px 26px",
                borderRadius: "999px",
                backgroundColor: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.32)",
                boxShadow: "0 8px 24px rgba(15,3,45,0.35)",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "999px",
                  backgroundImage: `linear-gradient(135deg, ${ACCENT_PINK} 0%, ${ACCENT_A} 100%)`,
                  boxShadow: `0 0 16px ${ACCENT_PINK}`,
                }}
              />
              <span
                style={{
                  fontSize: "34px",
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                  color: "#ffffff",
                }}
              >
                Docbel
              </span>
            </div>

            {cat ? (
              <div
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(15,3,45,0.32)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  fontSize: "22px",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "#f3e9ff",
                }}
              >
                {clamp(cat, 28)}
              </div>
            ) : null}
          </div>

          {/* ── Title ─────────────────────────────────────────────────── */}
          <div
            style={
              {
                // -webkit-box + WebkitLineClamp = the 3-line clamp Satori
                // honours. Cast because these webkit props sit outside the
                // narrow Satori style typings.
                display: "-webkit-box",
                maxWidth: "880px",
                fontSize: "64px",
                lineHeight: 1.12,
                fontWeight: 800,
                letterSpacing: "-1.2px",
                color: "#ffffff",
                textShadow: "0 6px 30px rgba(15,3,45,0.45)",
                overflow: "hidden",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              } as React.CSSProperties
            }
          >
            {title}
          </div>

          {/* ── Bottom strip ──────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "26px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            <span>docbel.be</span>
            <span style={{ opacity: 0.6 }}>·</span>
            <span>Actualités</span>
          </div>
        </div>
      ),
      {
        ...size,
        headers: {
          "cache-control": "public, max-age=86400, immutable",
        },
      },
    );
  } catch {
    // Minimal, dependency-free fallback so the endpoint never 500s an unfurl.
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: VIOLET_DEEP,
            backgroundImage: `linear-gradient(135deg, ${VIOLET} 0%, ${INDIGO} 100%)`,
            fontFamily: "sans-serif",
            fontSize: "72px",
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          Docbel
        </div>
      ),
      size,
    );
  }
}
