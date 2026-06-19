import { ImageResponse } from "next/og";

// Générateur d'IMAGE À LA UNE — template FIXE, cohérent d'un article à l'autre.
// Cadre invariant : à gauche logo + kicker + titre + sous-titre ; à droite, soit
// l'ILLUSTRATION 3D de la catégorie (param `illus`, PNG fond transparent), soit
// une scène vectorielle de repli. Seuls le texte, la COULEUR (par catégorie) et
// l'illustration changent. Rendu serveur via next/og (Satori) — aucune
// dépendance, aucun stockage.
export const runtime = "nodejs";
export const size = { width: 1280, height: 720 };
export const contentType = "image/png";

/** Coupe proprement un texte trop long. */
function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1).trimEnd() + "…" : value;
}

/** N'accepte qu'un hex #RGB / #RRGGBB, sinon retombe sur l'orange par défaut. */
function safeColor(input: string | null): string {
  if (input && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input)) return input;
  return "#F36A21";
}

/** N'accepte qu'une URL http(s) absolue (Satori va la fetch + rastériser). */
function safeIllus(input: string | null): string | null {
  if (input && /^https?:\/\/\S+$/i.test(input)) return input;
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clamp(searchParams.get("title") || "Titre de l'article", 64);
  const subtitle = clamp(searchParams.get("subtitle") || "", 88);
  const kicker = clamp(searchParams.get("kicker") || "Actualité", 26).toUpperCase();
  const color = safeColor(searchParams.get("color"));
  const illus = safeIllus(searchParams.get("illus"));

  // Sheen translucide réutilisé sur les volumes (logo, bouclier) → effet relief.
  const sheen = "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(0,0,0,0.18))";

  try {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: "#ffffff", fontFamily: "sans-serif" }}>
          {/* ───────── COLONNE GAUCHE (texte) ───────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              width: "600px",
              padding: "0 72px",
              backgroundColor: "#ffffff",
              backgroundImage: `linear-gradient(160deg, #ffffff 0%, ${color}14 100%)`,
            }}
          >
            {/* Logo (carré arrondi thémé + carré blanc intérieur) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "74px",
                height: "74px",
                borderRadius: "20px",
                backgroundColor: color,
                backgroundImage: sheen,
                boxShadow: `0 18px 40px ${color}55`,
                marginBottom: "38px",
              }}
            >
              <div style={{ display: "flex", width: "30px", height: "30px", borderRadius: "7px", background: "#ffffff" }} />
            </div>

            {/* Kicker (catégorie) */}
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                color,
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: "2px",
                marginBottom: "14px",
              }}
            >
              {kicker}
            </div>

            {/* Titre */}
            <div style={{ display: "flex", color: "#1f2a37", fontSize: "58px", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-1px" }}>
              {title}
            </div>

            {/* Filet d'accent */}
            <div style={{ display: "flex", width: "84px", height: "7px", borderRadius: "99px", backgroundColor: color, marginTop: "28px", marginBottom: subtitle ? "28px" : "0px" }} />

            {/* Sous-titre */}
            {subtitle ? (
              <div style={{ display: "flex", color: "#5b6472", fontSize: "27px", fontWeight: 500, lineHeight: 1.35 }}>
                {subtitle}
              </div>
            ) : null}
          </div>

          {/* ───────── COLONNE DROITE (illustration ou scène vectorielle) ───────── */}
          <div style={{ display: "flex", position: "relative", width: "680px", height: "100%", backgroundColor: color, overflow: "hidden" }}>
            {/* Halos de profondeur (toujours présents) */}
            <div style={{ position: "absolute", top: "-120px", right: "-80px", width: "520px", height: "520px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.35), transparent 62%)" }} />
            <div style={{ position: "absolute", bottom: "-160px", left: "-60px", width: "460px", height: "460px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,0.28), transparent 60%)" }} />

            {/* Drapeau belge (accent, toujours présent) */}
            <div style={{ position: "absolute", top: "60px", right: "60px", display: "flex", alignItems: "flex-start" }}>
              <div style={{ display: "flex", width: "3px", height: "70px", background: "rgba(255,255,255,0.55)" }} />
              <div style={{ display: "flex", marginTop: "6px" }}>
                <div style={{ display: "flex", width: "13px", height: "30px", background: "#21201e" }} />
                <div style={{ display: "flex", width: "13px", height: "30px", background: "#FFD90A" }} />
                <div style={{ display: "flex", width: "13px", height: "30px", background: "#EF3340" }} />
              </div>
            </div>

            {illus ? (
              /* ── Illustration 3D de la catégorie (PNG transparent) ── */
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "70px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={illus}
                  width={540}
                  height={540}
                  style={{ objectFit: "contain", filter: "drop-shadow(0 34px 60px rgba(0,0,0,0.38))" }}
                  alt=""
                />
              </div>
            ) : (
              /* ── Scène vectorielle de repli ── */
              <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                {/* Bâtiment officiel (silhouette discrète) */}
                <svg width="300" height="240" viewBox="0 0 100 80" style={{ position: "absolute", top: "70px", right: "56px" }}>
                  <polygon points="50,4 94,28 6,28" fill="#ffffff" opacity="0.12" />
                  <rect x="8" y="28" width="84" height="6" rx="1" fill="#ffffff" opacity="0.12" />
                  <rect x="15" y="36" width="9" height="34" fill="#ffffff" opacity="0.12" />
                  <rect x="32" y="36" width="9" height="34" fill="#ffffff" opacity="0.12" />
                  <rect x="49" y="36" width="9" height="34" fill="#ffffff" opacity="0.12" />
                  <rect x="66" y="36" width="9" height="34" fill="#ffffff" opacity="0.12" />
                  <rect x="6" y="70" width="88" height="7" rx="1" fill="#ffffff" opacity="0.12" />
                </svg>

                {/* Carte « document » (légèrement inclinée) */}
                <div
                  style={{
                    position: "absolute",
                    top: "150px",
                    left: "120px",
                    display: "flex",
                    flexDirection: "column",
                    width: "330px",
                    height: "390px",
                    padding: "30px",
                    borderRadius: "26px",
                    background: "#ffffff",
                    boxShadow: "0 40px 80px rgba(0,0,0,0.30)",
                    transform: "rotate(-4deg)",
                  }}
                >
                  <div style={{ display: "flex", color: "#1f2a37", fontSize: "22px", fontWeight: 700, marginBottom: "24px" }}>
                    Carte de contrôle
                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginBottom: "26px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "54px", height: "54px", borderRadius: "14px", backgroundColor: color, backgroundImage: sheen, marginRight: "16px" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2l7 3v6c0 4.6-3.1 8-7 9-3.9-1-7-4.4-7-9V5l7-3z" fill="#ffffff" />
                        <path d="M8.5 12l2.3 2.3 4.7-4.7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", width: "150px", height: "12px", borderRadius: "99px", background: `${color}33`, marginBottom: "9px" }} />
                      <div style={{ display: "flex", width: "110px", height: "12px", borderRadius: "99px", background: "#e9ecf1" }} />
                    </div>
                  </div>

                  {[180, 150, 165].map((w, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "8px", backgroundColor: `${color}22`, marginRight: "14px" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12.5l4 4 10-10" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div style={{ display: "flex", width: `${w}px`, height: "13px", borderRadius: "99px", background: "#eceef2" }} />
                    </div>
                  ))}

                  <svg width="150" height="40" viewBox="0 0 150 40" style={{ marginTop: "10px" }}>
                    <path d="M6 28c10-20 18 8 26-2s10-16 18-6 12 14 22 2 16-10 26-2" stroke="#b9c0ca" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Bouclier flottant (profondeur 3D) */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "96px",
                    left: "356px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "128px",
                    height: "128px",
                    borderRadius: "34px",
                    backgroundColor: color,
                    backgroundImage: sheen,
                    boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
                    transform: "rotate(7deg)",
                  }}
                >
                  <svg width="66" height="66" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l7 3v6c0 4.6-3.1 8-7 9-3.9-1-7-4.4-7-9V5l7-3z" fill="#ffffff" />
                    <path d="M8.5 12l2.3 2.3 4.7-4.7" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>

                {/* Pastille « profil » flottante */}
                <div
                  style={{
                    position: "absolute",
                    top: "200px",
                    right: "92px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "92px",
                    height: "92px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    boxShadow: "0 24px 50px rgba(0,0,0,0.28)",
                  }}
                >
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" fill={color} />
                    <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill={color} />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      ),
      { ...size, headers: { "cache-control": "public, max-age=86400, immutable" } },
    );
  } catch {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: color, color: "#fff", fontSize: 60, fontWeight: 800 }}>
          Docbel
        </div>
      ),
      { ...size },
    );
  }
}
