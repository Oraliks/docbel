"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchIcon, BelgianFlag, ArrowIcon } from "./icons";
import { Tool } from "@/lib/docbel-data";
// BureauLocator retiré (composant legacy supprimé) — l'outil "bureaux"
// est rendu directement par app/outils/bureaux/page.tsx (BureauxFinder).
import { BureauCallout } from "./bureau-callout";

interface ViewProps {
  accent: string;
  colors?: Record<string, string>;
}

interface ToolViewProps extends ViewProps {
  tool: Tool;
}

// CP_DATA garde le code CP et le SMG (numérique/format BE neutre).
// Le label "nom" est résolu via i18n (clé `cpItem{code}`).
const CP_DATA: { cp: string; code: string; labelKey: string; smg: string }[] = [
  { cp: "CP 200", code: "200", labelKey: "cpItem200", smg: "1.954,99 €" },
  { cp: "CP 201", code: "201", labelKey: "cpItem201", smg: "2.018,45 €" },
  { cp: "CP 100", code: "100", labelKey: "cpItem100", smg: "1.806,16 €" },
  { cp: "CP 111", code: "111", labelKey: "cpItem111", smg: "1.950,00 €" },
  { cp: "CP 118", code: "118", labelKey: "cpItem118", smg: "1.901,22 €" },
  { cp: "CP 124", code: "124", labelKey: "cpItem124", smg: "1.933,14 €" },
  { cp: "CP 130", code: "130", labelKey: "cpItem130", smg: "2.110,00 €" },
  { cp: "CP 140", code: "140", labelKey: "cpItem140", smg: "1.877,00 €" },
  { cp: "CP 302", code: "302", labelKey: "cpItem302", smg: "1.852,00 €" },
  { cp: "CP 318", code: "318", labelKey: "cpItem318", smg: "2.050,00 €" },
  { cp: "CP 319", code: "319", labelKey: "cpItem319", smg: "2.100,00 €" },
  { cp: "CP 330", code: "330", labelKey: "cpItem330", smg: "1.980,00 €" },
];

export function CalcCP({ accent }: ViewProps) {
  const t = useTranslations("public.outils");
  const [search, setSearch] = useState("");
  // Liste résolue (labels i18n) puis filtrée sur cp + nom traduit.
  const resolved = CP_DATA.map((c) => ({
    ...c,
    nom: t(c.labelKey as Parameters<typeof t>[0]),
  }));
  const filtered = resolved.filter(
    (c) => c.cp.toLowerCase().includes(search.toLowerCase()) || c.nom.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--glass-ink-soft)", marginBottom: 16, lineHeight: 1.6 }}>
        {t("cpIntro")}
      </p>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--glass-ink-faint)",
          }}
        >
          <SearchIcon size={15} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("cpSearchPlaceholder")}
          style={{
            width: "100%",
            padding: "9px 12px 9px 36px",
            borderRadius: 10,
            border: "1.5px solid var(--glass-border)",
            background: "var(--glass-surface)",
            color: "var(--glass-ink)",
            fontSize: 13,
            fontFamily: "'Manrope', sans-serif",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = accent)}
          onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((c) => (
          <div
            key={c.cp}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>{c.cp}</div>
              <div style={{ fontSize: 12.5, color: "var(--glass-ink)", marginTop: 2 }}>{c.nom}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--glass-ink)", flexShrink: 0, marginLeft: 12 }}>
              {c.smg}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--glass-ink-soft)", fontSize: 13 }}>
            {t("cpNoResult")}
          </div>
        )}
      </div>
    </div>
  );
}

// Fonction Locator() supprimée avec BureauLocator. L'outil "bureaux" est
// désormais routé directement vers app/outils/bureaux/page.tsx.

export function Tutorial({ tool, accent }: ToolViewProps) {
  const t = useTranslations("public.outils");
  const [activeStep, setActiveStep] = useState(0);

  // Jeu d'étapes choisi par un identifiant stable (et non par le titre
  // localisé). Chaque jeu a un nombre fixe d'étapes → on mappe vers des clés
  // i18n typées via `t(x as Parameters<typeof t>[0])`.
  const variant = tool.title.includes("carte")
    ? "Carte"
    : tool.title.includes("e-Box")
    ? "Ebox"
    : "Myonem";
  const stepCount = variant === "Carte" ? 4 : variant === "Ebox" ? 3 : 4;
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    title: t(
      `tut${variant}Step${i + 1}Title` as Parameters<typeof t>[0]
    ),
    body: t(
      `tut${variant}Step${i + 1}Body` as Parameters<typeof t>[0]
    ),
  }));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            onClick={() => setActiveStep(i)}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              cursor: "pointer",
              background: i <= activeStep ? accent : "var(--glass-border)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        {t("tutorialStep", { current: activeStep + 1, total: steps.length })}
      </div>
      <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--glass-ink)", marginBottom: 12, letterSpacing: "-0.2px" }}>
        {steps[activeStep].title}
      </h4>
      <p style={{ fontSize: 13.5, color: "var(--glass-ink-soft)", lineHeight: 1.7 }}>{steps[activeStep].body}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          disabled={activeStep === 0}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            border: "1px solid var(--glass-border)",
            background: "transparent",
            color: "var(--glass-ink-soft)",
            fontWeight: 600,
            fontSize: 13,
            cursor: activeStep === 0 ? "default" : "pointer",
            opacity: activeStep === 0 ? 0.4 : 1,
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          {t("tutorialPrev")}
        </button>
        <button
          onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
          disabled={activeStep === steps.length - 1}
          style={{
            flex: 1,
            padding: "9px 18px",
            borderRadius: 9,
            border: "none",
            background: accent,
            color: "white",
            fontWeight: 700,
            fontSize: 13,
            cursor: activeStep === steps.length - 1 ? "default" : "pointer",
            opacity: activeStep === steps.length - 1 ? 0.5 : 1,
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          {t("tutorialNext")}
        </button>
      </div>
    </div>
  );
}

export function InfoPanel({ tool }: ToolViewProps) {
  const t = useTranslations("public.outils");
  const variant = tool.title.includes("ALE") ? "Ale" : "Ris";

  // 4 items (titre + corps) par variante, mappés vers des clés i18n typées.
  const content = {
    intro: t(`info${variant}Intro` as Parameters<typeof t>[0]),
    items: Array.from({ length: 4 }, (_, i) => [
      t(`info${variant}Item${i + 1}Title` as Parameters<typeof t>[0]),
      t(`info${variant}Item${i + 1}Body` as Parameters<typeof t>[0]),
    ]) as [string, string][],
  };

  return (
    <div>
      <p style={{ fontSize: 13.5, color: "var(--glass-ink-soft)", marginBottom: 20, lineHeight: 1.65 }}>{content.intro}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {content.items.map(([title, body]) => (
          <div
            key={title}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--glass-ink)", marginBottom: 5 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: "var(--glass-ink-soft)", lineHeight: 1.6 }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LinkPanel({ tool, accent }: ToolViewProps) {
  const t = useTranslations("public.outils");
  const info: Record<string, { url: string; tel: string; descKey: string }> = {
    Actiris: { url: "actiris.brussels", tel: "0800 35 123", descKey: "linkActirisDesc" },
    VDAB: { url: "vdab.be", tel: "0800 30 700", descKey: "linkVdabDesc" },
    FOREM: { url: "leforem.be", tel: "0800 93 947", descKey: "linkForemDesc" },
    ADG: { url: "adg.be", tel: "087 59 64 00", descKey: "linkAdgDesc" },
  };
  const key = Object.keys(info).find((k) => tool.title.includes(k)) || "Actiris";
  const d = info[key];
  const desc = t(d.descKey as Parameters<typeof t>[0]);
  return (
    <div>
      <div
        style={{
          padding: "20px",
          borderRadius: 14,
          background: "var(--glass-surface)",
          border: "1px solid var(--glass-border)",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 13.5, color: "var(--glass-ink-soft)", lineHeight: 1.65, marginBottom: 16 }}>{desc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--glass-ink)" }}>
            <strong>🌐 {t("linkWebsite")}</strong> <span style={{ color: accent }}>{d.url}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--glass-ink)" }}>
            <strong>📞 {t("linkPhone")}</strong> {d.tel}
          </div>
        </div>
      </div>
      <button
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 10,
          border: "none",
          background: accent,
          color: "white",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        {t("linkVisit")}
      </button>
    </div>
  );
}

export function FormFlow({ tool, accent, lang }: ToolViewProps & { lang: string }) {
  const t = useTranslations("public.outils");
  void lang; // locale gérée par next-intl désormais
  const [step, setStep] = useState(0);
  const steps = [t("formStepForm"), t("formStepPreview"), t("formStepDownload")];
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    dob: "",
    adresse: "",
    commune: "",
    nrn: "",
  });
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1600);
  };

  const fields: [string, keyof typeof formData, string, string][] = [
    [t("formFieldNom"), "nom", "Dupont", "text"],
    [t("formFieldPrenom"), "prenom", "Jean", "text"],
    [t("formFieldDob"), "dob", "01/01/1990", "text"],
    [t("formFieldNrn"), "nrn", "90.01.01-123.45", "text"],
    [t("formFieldAdresse"), "adresse", "Rue de la Loi 1", "text"],
    [t("formFieldCommune"), "commune", "Bruxelles 1000", "text"],
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 22 }}>
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => i <= step && setStep(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              border: "none",
              background: "none",
              cursor: i <= step ? "pointer" : "default",
              color: i === step ? accent : i < step ? "var(--glass-ink-soft)" : "var(--glass-ink-faint)",
              fontSize: 12.5,
              fontWeight: i === step ? 700 : 500,
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                flexShrink: 0,
                background: i === step ? accent : i < step ? `${accent}20` : "var(--glass-surface)",
                color: i === step ? "white" : i < step ? accent : "var(--glass-ink-faint)",
                fontSize: 10.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i < step ? "✓" : i + 1}
            </span>
            {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {fields.map(([label, key, ph, type]) => (
              <div key={key} style={{ gridColumn: key === "adresse" ? "1 / -1" : "auto" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--glass-ink)",
                    marginBottom: 5,
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={ph}
                  value={formData[key]}
                  onChange={(e) => setFormData((d) => ({ ...d, [key]: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 9,
                    border: "1.5px solid var(--glass-border)",
                    background: "var(--glass-surface)",
                    color: "var(--glass-ink)",
                    fontSize: 13,
                    fontFamily: "'Manrope', sans-serif",
                    outline: "none",
                    transition: "border 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = accent)}
                  onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setStep(1)}
            style={{
              marginTop: 20,
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: accent,
              color: "white",
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              fontFamily: "'Manrope', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {t("formPreviewBtn")} <ArrowIcon size={14} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div
            style={{
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
              borderRadius: 12,
              padding: "24px",
              fontFamily: "monospace",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <BelgianFlag />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--glass-ink)", marginTop: 10 }}>
                {t("previewDocHeader")}
              </div>
              <div style={{ height: 1, background: "var(--glass-border)", margin: "14px 0" }}></div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--glass-ink)", textTransform: "uppercase" }}>
                {tool.title}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--glass-ink)", lineHeight: 2 }}>
              <div>
                <strong>{t("previewNom")}</strong> {formData.nom || "DUPONT"}
              </div>
              <div>
                <strong>{t("previewPrenom")}</strong> {formData.prenom || "Jean"}
              </div>
              <div>
                <strong>{t("previewDob")}</strong> {formData.dob || "01/01/1990"}
              </div>
              <div>
                <strong>{t("previewNrn")}</strong> {formData.nrn || "90.01.01-123.45"}
              </div>
              <div>
                <strong>{t("previewAdresse")}</strong> {formData.adresse || "Rue de la Loi 1"}
              </div>
              <div>
                <strong>{t("previewCommune")}</strong> {formData.commune || "Bruxelles 1000"}
              </div>
            </div>
            <div style={{ height: 1, background: "var(--glass-border)", margin: "16px 0" }}></div>
            <div style={{ fontSize: 11, color: "var(--glass-ink-soft)", textAlign: "right" }}>
              {t("previewGeneratedAt", { date: new Date().toLocaleDateString("fr-BE") })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setStep(0)}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: "1px solid var(--glass-border)",
                background: "transparent",
                color: "var(--glass-ink-soft)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              {t("formEdit")}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "white",
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
                fontFamily: "'Manrope', sans-serif",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? t("formGenerating") : t("formGenerate")}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>✅</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--glass-ink)", marginBottom: 6 }}>{t("formReadyTitle")}</h3>
            <p style={{ fontSize: 13, color: "var(--glass-ink-soft)", marginBottom: 16 }}>
              {t("formReadyBody", { tool: tool.title.toLowerCase() })}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: `1.5px solid ${accent}`,
                  background: "transparent",
                  color: accent,
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                {t("formPdfPreview")}
              </button>
              <button
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: accent,
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                {t("formDownload")}
              </button>
            </div>
          </div>
          {/* BureauCallout AVANT le bouton download (l'étape suivante visuelle) */}
          <BureauCallout organismeCode={inferOrganismeFromTool(tool)} accent={accent} />
        </div>
      )}
    </div>
  );
}

/** Heuristique pour déduire l'organisme cible d'un outil (FormFlow démo). */
function inferOrganismeFromTool(tool: Tool): string | null {
  const t = `${tool.title} ${tool.desc}`.toLowerCase();
  if (t.includes("cpas") || t.includes("ris") || t.includes("aide sociale") || t.includes("intégration sociale"))
    return "cpas";
  if (t.includes("commune") || t.includes("hôtel de ville") || t.includes("état civil"))
    return "commune";
  if (t.includes("c4") || t.includes("c1") || t.includes("chômage") || t.includes("onem"))
    return "onem";
  if (t.includes("syndicat") || t.includes("paiement") || t.includes("capac")) return "capac";
  return null;
}
