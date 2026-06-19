import { ImageResponse } from "next/og";

// Compose l'image à la une finale (1600×900) à partir de l'image générée par
// l'IA : image en fond plein cadre + dégradé de lisibilité à gauche, puis logo,
// badge et titre ajoutés EN CODE (l'IA ne dessine pas le texte).
//
// ⚠️ Rendu via next/og (Satori + resvg-wasm) — comme /api/og et /api/featured —
// donc AUCUN binaire natif. On a abandonné `sharp` ici : sa lib native (libvips)
// ne se charge pas de façon fiable sur le runtime serverless Linux de Netlify
// (ERR_DLOPEN_FAILED libvips-cpp.so). next/og fonctionne déjà en prod sur ce
// projet.

const W = 1600;
const H = 900;

export interface PostProcessOptions {
  title?: string | null;
  badge?: string;
  /** Couleur d'accent (logo + ombre). Défaut : violet de marque Docbel. */
  accent?: string;
}

export async function postProcessFeaturedImage(
  input: Buffer,
  opts: PostProcessOptions = {}
): Promise<{ buffer: Buffer; ext: "png" }> {
  const title = (opts.title ?? "").trim();
  const badge = opts.badge ?? "Docbel · Article";
  const accent = opts.accent || "#7C3AED";
  const bg = `data:image/png;base64,${input.toString("base64")}`;
  const sheen = "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(0,0,0,0.18))";

  // Style du titre : retour à la ligne automatique (Satori) + clamp 4 lignes.
  // `WebkitBoxOrient` n'est pas dans le type CSS standard → cast.
  const titleStyle = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 4,
    overflow: "hidden",
    color: "#ffffff",
    fontSize: 64,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-1.5px",
    textShadow: "0 2px 18px rgba(0,0,0,0.45)",
  } as React.CSSProperties;

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          fontFamily: "sans-serif",
          backgroundColor: "#1f2a44",
        }}
      >
        {/* Image IA en fond, plein cadre */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bg}
          width={W}
          height={H}
          alt=""
          style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }}
        />

        {/* Dégradé de lisibilité à gauche */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            backgroundImage:
              "linear-gradient(90deg, rgba(18,18,38,0.82) 0%, rgba(18,18,38,0.34) 42%, rgba(18,18,38,0) 70%)",
          }}
        />

        {/* Logo + badge (haut gauche) */}
        <div style={{ position: "absolute", top: 54, left: 72, display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: accent,
              backgroundImage: sheen,
              boxShadow: `0 10px 24px ${accent}55`,
              marginRight: 14,
            }}
          >
            <div style={{ display: "flex", width: 18, height: 18, borderRadius: 5, background: "#ffffff" }} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 36,
              padding: "0 16px",
              borderRadius: 99,
              backgroundColor: "rgba(255,255,255,0.92)",
              color: "#1f2a44",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {badge}
          </div>
        </div>

        {/* Titre — zone gauche, sur le dégradé */}
        {title ? (
          <div style={{ position: "absolute", left: 72, top: 0, width: 720, height: H, display: "flex", alignItems: "center" }}>
            <div style={titleStyle}>{title}</div>
          </div>
        ) : null}
      </div>
    ),
    { width: W, height: H }
  );

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, ext: "png" };
}
