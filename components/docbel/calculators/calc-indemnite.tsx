"use client";

/**
 * Calculateur "Indemnité de rupture" — UI refondue 2026-05.
 *
 * Pattern UI aligné sur Pension + Tarif social : layout 2 colonnes
 * (form / résultat sticky), badges officiels, export PDF, mention
 * "Mis à jour le …".
 *
 * Pourquoi ce composant : quand l'employeur rompt le contrat sans faire
 * prester le préavis (ou seulement une partie), il doit verser une
 * indemnité égale à la rémunération courante correspondant à la durée
 * du préavis non presté. Cet outil calcule l'indemnité brute, applique
 * le précompte spécial SPF Finances par tranches, gère la cotisation
 * spéciale de compensation employeur (1 / 2 / 3 % selon ONSS 2026/1),
 * et cumule l'indemnité de protection pour les 3 statuts protégés
 * (femme enceinte, délégué syndical CCT 5, travailleur protégé).
 *
 * La logique pure vit dans `lib/calculators/indemnite-rupture.ts` ; ici
 * on assemble les inputs et la carte de résultat.
 */

import React, { useState } from "react";
import {
  Download,
  FileSignature,
  Info,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
import {
  calcIndemniteRupture,
  PREAVIS_MAX_SEMAINES,
  type IndemniteResult,
  type ProtectionSpeciale,
} from "@/lib/calculators/indemnite-rupture";
import {
  CalcBadge,
  CalcCard,
  CalcError,
  CalcField,
  CalcGrid,
  CalcSubmitButton,
  YesNoToggle,
  fmtEUR,
  fmtNumber,
  parseNum,
} from "./_shared";

type Oui = "oui" | "non";

/**
 * Date de mise à jour du calculateur — pilote l'affichage public et
 * l'alerte annuelle dans /admin/calculateurs.
 */
const LAST_UPDATED = "2026-05-25";

const PROTECTION_OPTIONS: {
  value: ProtectionSpeciale;
  label: string;
  hint: string;
}[] = [
  { value: "aucune", label: "Aucune", hint: "Pas de statut protégé." },
  {
    value: "femme_enceinte",
    label: "Femme enceinte (+6 mois)",
    hint: "Loi du 16 mars 1971, art. 40 : 6 mois forfaitaires.",
  },
  {
    value: "delegue_syndical",
    label: "Délégué syndical CCT 5 (+~3 ans)",
    hint: "CCT n° 5, art. 20 : 2 à 4 ans selon ancienneté.",
  },
  {
    value: "travailleur_protege",
    label: "Conseiller prévention / CPPT (+~9 mois)",
    hint: "Loi du 19 mars 1991 : 6 à 12 mois selon ancienneté.",
  },
];

const SOURCES_FOOTER = [
  {
    label: "SPF Finances — Précompte professionnel 2026",
    url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
  },
  {
    label: "ONSS — Cotisation spéciale sur indemnités de rupture",
    url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/terminationfeecontribution.html",
  },
  {
    label: "Moniteur belge — Loi du 3 juillet 1978",
    url: "https://www.ejustice.just.fgov.be",
  },
  {
    label: "SPF Emploi — Fin du contrat de travail",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/fin-du-contrat-de-travail",
  },
];

export function CalcIndemnite({ accent }: { accent: string }) {
  const [salaire, setSalaire] = useState("3500");
  const [preavis, setPreavis] = useState("12");
  const [inclureAvantages, setInclureAvantages] = useState<Oui>("non");
  const [avantages, setAvantages] = useState("");
  const [precompte, setPrecompte] = useState<Oui>("oui");
  const [protection, setProtection] = useState<ProtectionSpeciale>("aucune");

  const [result, setResult] = useState<IndemniteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reset = () => {
    setSalaire("3500");
    setPreavis("12");
    setInclureAvantages("non");
    setAvantages("");
    setPrecompte("oui");
    setProtection("aucune");
    setResult(null);
    setError(null);
  };

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const salaireNum = parseNum(salaire);
    const preavisNum = parseNum(preavis);
    const avantagesNum = parseNum(avantages);

    if (!Number.isFinite(salaireNum)) {
      setError("Indiquez un salaire brut mensuel valide.");
      return;
    }
    if (!Number.isFinite(preavisNum)) {
      setError("Indiquez une durée de préavis en semaines.");
      return;
    }

    const res = calcIndemniteRupture({
      salaireBrutMensuel: salaireNum,
      dureePreavisSemaines: preavisNum,
      avantagesAnnuels: Number.isFinite(avantagesNum) ? avantagesNum : 0,
      inclureAvantages: inclureAvantages === "oui",
      precompte: precompte === "oui",
      protectionSpeciale: protection,
    });

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  /* --------------------------------------------------------------- */
  /*  Export PDF (jspdf en import dynamique)                         */
  /* --------------------------------------------------------------- */
  const handleExportPDF = async () => {
    if (!result) return;
    setExportingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const lineGap = 6;
      let y = 20;

      // Header
      doc.setFontSize(18);
      doc.setFont("", "bold");
      doc.setTextColor(0, 51, 102);
      doc.text("DOCBEL", margin, y);
      y += 7;
      doc.setDrawColor(200, 16, 46);
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(110, 110, 110);
      doc.text("https://www.docbel.be", margin, y);
      const now = new Date();
      const dateStr = now.toLocaleDateString("fr-BE");
      const timeStr = now.toLocaleTimeString("fr-BE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(`Généré le ${dateStr} à ${timeStr}`, pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Indemnité de rupture (préavis non presté) — 2026`,
        margin,
        y,
      );
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text("Paramètres saisis", margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const protectionLabel =
        PROTECTION_OPTIONS.find((p) => p.value === protection)?.label ?? "—";

      const inputs: [string, string][] = [
        ["Salaire mensuel brut", fmtEUR(parseNum(salaire))],
        ["Préavis non presté", `${result.preavisSemaines} semaines`],
        [
          "Avantages annuels inclus",
          inclureAvantages === "oui" && parseNum(avantages) > 0
            ? `${fmtEUR(parseNum(avantages))}/an`
            : "Non",
        ],
        ["Statut de protection", protectionLabel],
        [
          "Calcul du net après précompte",
          precompte === "oui" ? "Oui" : "Non",
        ],
        [
          "Brut annuel de référence",
          `${fmtEUR(result.brutAnnuelReference)} (× 13,92)`,
        ],
      ];

      const colKey = margin + 2;
      const colVal = pageWidth / 2 + 5;
      inputs.forEach(([k, v]) => {
        doc.setTextColor(90, 90, 90);
        doc.text(k, colKey, y);
        doc.setTextColor(0, 0, 0);
        doc.setFont("", "bold");
        doc.text(v, colVal, y);
        doc.setFont("", "normal");
        y += lineGap;
      });
      y += 4;

      // Encadré INDEMNITÉ
      const boxH = 32;
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(200, 16, 46);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(155, 28, 28);
      doc.text("INDEMNITÉ DE RUPTURE — TOTAL BRUT", margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.indemniteTotalBrute), margin + 4, y + 17);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      if (precompte === "oui") {
        doc.text(
          `≈ ${fmtEUR(result.indemniteNetEstimee)} net après précompte (${fmtNumber(result.tauxPrecompteAppliquePourcent, 2)} %)`,
          margin + 4,
          y + 25,
        );
      } else {
        doc.text(
          `Brut total (précompte non calculé)`,
          margin + 4,
          y + 25,
        );
      }
      y += boxH + 8;

      // Cotisation employeur (info)
      if (result.cotisationSpecialeEmployeur > 0) {
        if (y > pageHeight - 50) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 2, 2, "FD");
        doc.setFontSize(10);
        doc.setFont("", "bold");
        doc.setTextColor(180, 83, 9);
        doc.text(
          `Cotisation spéciale employeur (${fmtNumber(result.tauxCotisationSpecialePourcent, 0)} %)`,
          margin + 4,
          y + 7,
        );
        doc.setFontSize(11);
        doc.setFont("", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(
          `${fmtEUR(result.cotisationSpecialeEmployeur)} à charge de l'employeur (Fonds de fermeture)`,
          margin + 4,
          y + 14,
        );
        doc.setFontSize(8);
        doc.text(
          "ONSS 2026/1 — n'affecte pas le net du salarié",
          margin + 4,
          y + 20,
        );
        y += 28;
      }

      // Détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text("Détail du calcul", margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        [
          "Rémunération mensuelle de base",
          fmtEUR(result.remunerationMensuelle),
        ],
        [
          "Rémunération hebdomadaire (× 3 / 13)",
          fmtEUR(result.remunerationHebdomadaire),
        ],
        [
          "Indemnité standard (hebdo × préavis)",
          fmtEUR(result.indemniteBrute),
        ],
      ];
      if (result.indemniteProtectionSupplement > 0) {
        details.push([
          "Indemnité de protection",
          fmtEUR(result.indemniteProtectionSupplement),
        ]);
      }
      details.push([
        "Total brut",
        fmtEUR(result.indemniteTotalBrute),
      ]);
      if (precompte === "oui") {
        details.push([
          "Précompte appliqué",
          `${fmtNumber(result.tauxPrecompteAppliquePourcent, 2)} %`,
        ]);
        details.push([
          "Net estimé",
          fmtEUR(result.indemniteNetEstimee),
        ]);
      }

      details.forEach(([k, v]) => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        doc.setTextColor(80, 80, 80);
        doc.text(k, colKey, y);
        doc.setFont("", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(v, pageWidth - margin, y, { align: "right" });
        doc.setFont("", "normal");
        y += lineGap;
      });
      y += 4;

      // Footer
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("", "italic");
      doc.setTextColor(120, 120, 120);
      const footer = doc.splitTextToSize(
        "Estimation indicative — Loi du 3 juillet 1978 (art. 39 et suiv.), barème précompte spécial SPF Finances 2026 par tranches (5 paliers, 17,16 → 53,50 %), cotisation spéciale de compensation employeur ONSS 2026/1 (1 / 2 / 3 % selon brut annuel ≥ 50 166 / 61 437 / 72 707 €), indemnité de protection cumulable (loi 16/03/1971, CCT 5, loi 19/03/1991). Pour un calcul officiel et personnalisé : SPF Emploi / votre secrétariat social. Sources : SPF Finances, ONSS, Moniteur belge.",
        pageWidth - margin * 2,
      );
      doc.text(footer, margin, y);
      y += footer.length * 4 + 4;

      doc.setFont("", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Docbel © 2026 | https://www.docbel.be",
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" },
      );

      doc.save(
        `docbel-indemnite-rupture-${now.toISOString().split("T")[0]}.pdf`,
      );
    } finally {
      setExportingPDF(false);
    }
  };

  const lastUpdatedFr = new Date(LAST_UPDATED).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Layout 2 colonnes : form (gauche) | résultat sticky (droite) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        {/* ---------- Colonne gauche : formulaire ---------- */}
        <CalcCard className="flex flex-col gap-4">
          {/* En-tête : icône + titre + sous-titre + bouton Reset */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                }}
              >
                <FileSignature className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  Indemnité de rupture
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  Préavis non presté — Loi du 3 juillet 1978
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 text-[11.5px] font-semibold transition"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-surface)",
                color: "var(--glass-ink-soft)",
              }}
              title="Réinitialiser le formulaire"
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country="Belgique" />
              Belgique
            </CalcBadge>
            <CalcBadge accent={accent}>Salarié 2026</CalcBadge>
            <CalcBadge accent={accent}>Données 2026</CalcBadge>
          </div>

          {/* Salaire + Préavis */}
          <CalcGrid cols={2}>
            <CalcField
              id="indemnite-salaire"
              label="Salaire mensuel brut"
              value={salaire}
              onChange={setSalaire}
              placeholder="3500"
              suffix="€"
              min={0}
              max={100000}
              step={50}
              hint="Montant indiqué sur votre fiche de paie avant retenues."
            />
            <CalcField
              id="indemnite-preavis"
              label="Durée du préavis non presté"
              value={preavis}
              onChange={setPreavis}
              placeholder="12"
              suffix="sem."
              min={0}
              max={PREAVIS_MAX_SEMAINES}
              step={1}
              hint="Voir le calculateur de préavis pour cette valeur (semaines)."
            />
          </CalcGrid>

          {/* Avantages */}
          <YesNoToggle
            label="Inclure des avantages extra-légaux ?"
            hint="Prime fin d'année, double pécule, chèques-repas annuels, assurance groupe, voiture société…"
            value={inclureAvantages}
            onChange={(v) => {
              setInclureAvantages(v);
              if (v === "non") setAvantages("");
            }}
            accent={accent}
          />

          {inclureAvantages === "oui" ? (
            <CalcField
              id="indemnite-avantages"
              label="Avantages extra-légaux annualisés"
              value={avantages}
              onChange={setAvantages}
              placeholder="ex : 4500"
              suffix="€/an"
              min={0}
              max={999999}
              step={100}
              hint="Total annuel estimé (€/an). Mensualisé (÷ 12) puis ajouté à la rémunération de base."
            />
          ) : null}

          {/* Protection spéciale */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="indemnite-protection"
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--glass-ink)]"
            >
              <ShieldAlert
                className="size-3.5"
                style={{ color: "var(--glass-ink-faint)" }}
              />
              Statut de protection spéciale
            </label>
            <select
              id="indemnite-protection"
              value={protection}
              onChange={(e) =>
                setProtection(e.target.value as ProtectionSpeciale)
              }
              className="h-11 w-full rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 text-[14px] text-[color:var(--glass-ink)] outline-none focus:border-[color:var(--glass-accent-deep)]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              {PROTECTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
              {PROTECTION_OPTIONS.find((p) => p.value === protection)?.hint}
            </p>
          </div>

          {/* Précompte */}
          <YesNoToggle
            label="Calculer le net (précompte spécial) ?"
            hint="Précompte spécial cumulé selon votre tranche de revenu annuel (barème SPF Finances 2026)."
            value={precompte}
            onChange={setPrecompte}
            accent={accent}
            yesLabel="Oui"
            noLabel="Brut seul"
          />

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={handleCalc}>
              Calculer l&apos;indemnité
            </CalcSubmitButton>
            <button
              type="button"
              onClick={reset}
              className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] text-[13px] font-semibold transition"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-surface)",
                color: "var(--glass-ink-soft)",
              }}
            >
              <RotateCcw className="size-4" />
              Réinitialiser le formulaire
            </button>
          </CalcGrid>

          {/* Info disclaimer bas form */}
          <div
            className="flex items-start gap-2 rounded-xl border-[1.5px] p-3 text-[11.5px] leading-[1.55]"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass-surface)",
              color: "var(--glass-ink-soft)",
            }}
          >
            <Info className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-ink-faint)]" />
            <div>
              <strong className="text-[color:var(--glass-ink)]">
                Estimation indicative.
              </strong>{" "}
              Le précompte réel dépend de votre situation fiscale individuelle
              (personnes à charge, conjoint, etc.). Pour un calcul officiel,
              contactez votre <strong>secrétariat social</strong> ou consultez
              le SPF Emploi.
            </div>
          </div>
        </CalcCard>

        {/* ---------- Colonne droite : résultat sticky ---------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <CalcCard
            style={{
              background: `${accent}10`,
              borderColor: `${accent}30`,
            }}
          >
            {result ? (
              <IndemniteResultPanel
                result={result}
                accent={accent}
                avecPrecompte={precompte === "oui"}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <IndemniteResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Footer : Mise à jour + sources */}
      <div className="flex flex-col gap-2">
        <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
          Calculateur mis à jour le <strong>{lastUpdatedFr}</strong> · Données
          2026 · Sources officielles :
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
          {SOURCES_FOOTER.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--glass-ink-soft)] underline-offset-2 hover:underline"
                style={{ color: accent }}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panneau résultat (rempli)                                         */
/* ------------------------------------------------------------------ */

function IndemniteResultPanel({
  result,
  accent,
  avecPrecompte,
  onExportPDF,
  exporting,
}: {
  result: IndemniteResult;
  accent: string;
  avecPrecompte: boolean;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const hasProtection = result.indemniteProtectionSupplement > 0;
  const hasCotisation = result.cotisationSpecialeEmployeur > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          Résultat estimatif
        </span>
        <span
          className="inline-flex items-center"
          title="Estimation indicative — Loi du 3 juillet 1978, barème SPF Finances 2026, cotisation spéciale ONSS 2026/1"
          aria-label="Estimation indicative — Loi du 3 juillet 1978, barème SPF Finances 2026, cotisation spéciale ONSS 2026/1"
        >
          <Info
            className="size-4"
            style={{ color: "var(--glass-ink-faint)" }}
          />
        </span>
      </div>

      <div>
        <div
          className="font-extrabold tracking-[-0.5px] text-[color:var(--glass-ink)]"
          style={{ fontSize: 36, lineHeight: 1.05 }}
        >
          {fmtEUR(result.indemniteTotalBrute)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          Brut total
        </div>
        {avecPrecompte ? (
          <div className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
            ≈ <strong>{fmtEUR(result.indemniteNetEstimee)}</strong> net après
            précompte spécial (
            {fmtNumber(result.tauxPrecompteAppliquePourcent, 2)} %)
          </div>
        ) : (
          <div className="mt-1 text-[12.5px] text-[color:var(--glass-ink-faint)]">
            Précompte non calculé
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CalcBadge accent={accent}>
            {result.preavisSemaines} sem. de préavis
          </CalcBadge>
          {hasProtection ? (
            <CalcBadge accent={accent}>+ Protection</CalcBadge>
          ) : null}
          {hasCotisation ? (
            <CalcBadge accent={accent}>
              Cot. spéciale {fmtNumber(result.tauxCotisationSpecialePourcent, 0)} %
            </CalcBadge>
          ) : null}
        </div>
      </div>

      {/* Détail du calcul */}
      <div
        className="border-t pt-3"
        style={{ borderTopColor: "var(--glass-ink-line)" }}
      >
        <div
          className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--glass-ink-faint)" }}
        >
          Détail du calcul
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Rémunération mensuelle de base
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtEUR(result.remunerationMensuelle)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Rémunération hebdomadaire (× 3 / 13)
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtEUR(result.remunerationHebdomadaire)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Indemnité standard (hebdo × {result.preavisSemaines} sem.)
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtEUR(result.indemniteBrute)}
            </span>
          </div>
          {hasProtection ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                Indemnité de protection
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {fmtEUR(result.indemniteProtectionSupplement)}
              </span>
            </div>
          ) : null}
          <div
            className="mt-1.5 flex items-baseline justify-between gap-3 border-t pt-2"
            style={{ borderTopColor: "var(--glass-ink-line)" }}
          >
            <span className="font-bold text-[color:var(--glass-ink)]">
              Total brut
            </span>
            <span className="text-[14px] font-extrabold text-[color:var(--glass-ink)]">
              {fmtEUR(result.indemniteTotalBrute)}
            </span>
          </div>
          {avecPrecompte ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[color:var(--glass-ink-soft)]">
                  Précompte spécial appliqué
                </span>
                <span className="font-semibold text-[color:var(--glass-ink)]">
                  {fmtNumber(result.tauxPrecompteAppliquePourcent, 2)} %
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold text-[color:var(--glass-ink)]">
                  Net estimé
                </span>
                <span className="text-[14px] font-extrabold text-[color:var(--glass-ink)]">
                  {fmtEUR(result.indemniteNetEstimee)}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Bloc cotisation employeur (orange info, n'affecte pas le net) */}
      {hasCotisation ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            color: "rgb(120, 53, 15)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold text-[color:rgb(180,83,9)]">
            <Info className="size-3.5" />
            Cotisation spéciale employeur (info) —{" "}
            {fmtNumber(result.tauxCotisationSpecialePourcent, 0)} %
          </div>
          <p>
            L&apos;employeur supporte{" "}
            <strong>{fmtEUR(result.cotisationSpecialeEmployeur)}</strong> au
            Fonds de fermeture (ONSS 2026/1). Cette cotisation est à sa charge
            et <strong>n&apos;affecte pas votre net</strong>.
          </p>
        </div>
      ) : null}

      {/* Bloc "À savoir" */}
      <div
        className="rounded-xl p-3 text-[11.5px] leading-[1.6]"
        style={{
          background: `${accent}10`,
          border: `1px solid ${accent}25`,
          color: "var(--glass-ink-soft)",
        }}
      >
        <div className="mb-1 flex items-center gap-1.5 font-bold text-[color:var(--glass-ink)]">
          <Info className="size-3.5" /> À savoir
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Le <strong>précompte spécial</strong> est calculé par tranches de
            revenu annuel de référence (17,16 → 53,50 %) — barème SPF Finances
            2026.
          </li>
          <li>
            La <strong>cotisation spéciale ONSS</strong> (1 / 2 / 3 %) est due
            par l&apos;employeur quand la rémunération annuelle ≥ 50 166 €.
            Elle finance le Fonds de fermeture.
          </li>
          <li>
            L&apos;<strong>indemnité de protection</strong> (femme enceinte,
            délégué syndical, conseiller prévention) est{" "}
            <strong>exonérée de cotisations sociales</strong>.
          </li>
          <li>
            La part d&apos;indemnité couvrant des prestations{" "}
            <strong>avant le 01/01/2014</strong> est exonérée de la cotisation
            spéciale employeur.
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onExportPDF}
        disabled={exporting}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: `${accent}50`,
          background: "var(--glass-surface)",
          color: accent,
        }}
      >
        <Download className="size-4" />
        {exporting ? "Génération du PDF…" : "Exporter PDF"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function IndemniteResultPlaceholder({ accent }: { accent: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        Résultat estimatif
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        Indiquez votre salaire brut mensuel et la durée du préavis non presté,
        puis cliquez sur <em>« Calculer l&apos;indemnité »</em>.
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
