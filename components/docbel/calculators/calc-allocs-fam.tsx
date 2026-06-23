"use client";

/**
 * Calculateur "Allocations familiales" — UI refondue 2026-05.
 *
 * Pattern UI aligné sur Brut/Net + Pécule : layout 2 colonnes
 * (form / résultat sticky), badges officiels, export PDF, mention
 * "Mis à jour le …".
 *
 * Pourquoi ce composant : depuis la régionalisation, un parent belge n'a
 * plus une réponse simple à "combien je vais toucher par mois ?". Chaque
 * région a son organisme officiel (FAMIWAL / FAMIRIS / Groeipakket /
 * Kindergeld DG), son barème indexé, sa date pivot et ses suppléments.
 * Ce calc donne un ordre de grandeur réaliste avant que l'utilisateur
 * contacte sa caisse.
 *
 * La logique pure vit dans `lib/calculators/allocs-fam.ts` ; ici on
 * assemble les inputs (région, enfants dynamiques, revenu, monoparen-
 * talité, handicap, orphelin) et la carte de résultat.
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Baby,
  Download,
  Info,
  Plus,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
import {
  calcAllocsFam,
  type AllocsFamResult,
  type OrphelinStatus,
  type Region,
} from "@/lib/calculators/allocs-fam";
import {
  CalcBadge,
  CalcCard,
  CalcError,
  CalcField,
  CalcGrid,
  CalcSelect,
  CalcSubmitButton,
  ResultRow,
  YesNoToggle,
  fmtEUR,
  parseNum,
} from "./_shared";

type MonoYesNo = "oui" | "non";
type HandicapYesNo = "oui" | "non";

interface EnfantRow {
  /** Identifiant local pour la clé React (n'affecte pas le calcul). */
  uid: number;
  /** Année de naissance saisie sous forme de string (parsée au calcul). */
  anneeNaissance: string;
  /** Enfant en situation de handicap reconnu (catégorie médiane). */
  handicap: HandicapYesNo;
  /** Statut d'orphelin de l'enfant. */
  orphelin: OrphelinStatus;
}

/**
 * Date de mise à jour du calculateur — pilote l'affichage public et
 * l'alerte annuelle dans /admin/calculateurs.
 */
const LAST_UPDATED = "2026-05-25";

const ANNEE_COURANTE = new Date().getFullYear();
const DEFAUT_ANNEE_ENFANT = ANNEE_COURANTE - 5; // ex : 2021 si on est en 2026

let _uid = 0;
const nextUid = () => ++_uid;

const newEnfant = (): EnfantRow => ({
  uid: nextUid(),
  anneeNaissance: String(DEFAUT_ANNEE_ENFANT),
  handicap: "non",
  orphelin: "aucun",
});

/**
 * Régions disponibles + clés i18n (label/hint/badge). Les libellés et
 * hints sont externalisés en next-intl ; on garde ici uniquement la liste
 * ordonnée des valeurs et la correspondance value → clés de traduction.
 */
const REGION_VALUES: Region[] = [
  "wallonie",
  "bruxelles",
  "flandre",
  "germanophone",
];

const REGION_KEYS: Record<
  Region,
  { label: string; hint: string; badge: string }
> = {
  wallonie: {
    label: "afRegionWallonieLabel",
    hint: "afRegionWallonieHint",
    badge: "afBadgeWallonie",
  },
  bruxelles: {
    label: "afRegionBruxellesLabel",
    hint: "afRegionBruxellesHint",
    badge: "afBadgeBruxelles",
  },
  flandre: {
    label: "afRegionFlandreLabel",
    hint: "afRegionFlandreHint",
    badge: "afBadgeFlandre",
  },
  germanophone: {
    label: "afRegionGermanophoneLabel",
    hint: "afRegionGermanophoneHint",
    badge: "afBadgeGermanophone",
  },
};

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

export function CalcAllocsFam({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");

  // Clés dynamiques → cast vers le type de clé attendu par t() (typage strict).
  const tk = (key: string) => t(key as Parameters<typeof t>[0]);
  // Reconstruit les options de région (label + hint) avec les libellés
  // traduits. Utilisé par le <CalcSelect> ET par le PDF (find → label).
  const REGION_OPTIONS = REGION_VALUES.map((value) => ({
    value,
    label: tk(REGION_KEYS[value].label),
    hint: tk(REGION_KEYS[value].hint),
  }));

  const [region, setRegion] = useState<Region>("wallonie");
  const [revenu, setRevenu] = useState("50000");
  const [monoparental, setMonoparental] = useState<MonoYesNo>("non");
  const [enfants, setEnfants] = useState<EnfantRow[]>([newEnfant()]);
  const [result, setResult] = useState<AllocsFamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reset = () => {
    setRegion("wallonie");
    setRevenu("50000");
    setMonoparental("non");
    setEnfants([newEnfant()]);
    setResult(null);
    setError(null);
  };

  const addEnfant = () => {
    if (enfants.length >= 10) return;
    setEnfants((prev) => [...prev, newEnfant()]);
  };

  const removeEnfant = (uid: number) => {
    setEnfants((prev) => prev.filter((e) => e.uid !== uid));
  };

  const updateEnfant = (uid: number, patch: Partial<EnfantRow>) => {
    setEnfants((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e)),
    );
  };

  const onCalc = () => {
    setError(null);
    setResult(null);

    if (enfants.length === 0) {
      setError(t("afErrorNoChild"));
      return;
    }

    const rev = parseNum(revenu);
    const parsedEnfants = enfants.map((e) => ({
      anneeNaissance: parseNum(e.anneeNaissance),
      handicap: e.handicap === "oui",
      orphelin: e.orphelin,
    }));

    const out = calcAllocsFam({
      region,
      enfants: parsedEnfants,
      revenuMenageAnnuel: isNaN(rev) ? 0 : rev,
      monoparental: monoparental === "oui",
    });

    if ("error" in out) {
      setError(out.error);
      return;
    }
    setResult(out);
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
      doc.text(t("afPdfGeneratedAt", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        t("afPdfTitle", { region: result.regionLabel }),
        margin,
        y,
      );
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("afPdfParams"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const inputs: [string, string][] = [
        [t("afPdfRegion"), REGION_OPTIONS.find((r) => r.value === region)?.label ?? region],
        [t("afPdfRevenu"), fmtEUR(parseNum(revenu) || 0)],
        [t("afPdfMono"), monoparental === "oui" ? t("afPdfYes") : t("afPdfNo")],
        [t("afPdfNbChildren"), String(enfants.length)],
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

      // Encadré TOTAL MENSUEL
      const boxH = 28;
      doc.setFillColor(248, 244, 252);
      doc.setDrawColor(159, 124, 255);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(90, 42, 140);
      doc.text(t("afPdfTotalMensuel"), margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.totalMensuel), margin + 4, y + 17);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        t("afPdfTotalSub", { x: fmtEUR(result.bonusRentreeAnnuel) }),
        margin + 4,
        y + 24,
      );
      y += boxH + 8;

      // Détail par enfant
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("afPdfDetailPerChild"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      result.detail.forEach((d) => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("", "bold");
        doc.setTextColor(0, 51, 102);
        doc.text(
          t("afPdfChildHeading", { rang: d.rang, count: d.age }),
          colKey,
          y,
        );
        doc.setFont("", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(fmtEUR(d.total), pageWidth - margin, y, { align: "right" });
        y += lineGap;

        doc.setFont("", "normal");
        doc.setTextColor(80, 80, 80);
        const rows: [string, string][] = [
          ["  " + t("afSuppBase"), fmtEUR(d.montantBase)],
        ];
        if (d.supplementSocial)
          rows.push(["  " + t("afSuppSocial"), `+ ${fmtEUR(d.supplementSocial)}`]);
        if (d.supplementMonoparental)
          rows.push([
            "  " + t("afSuppMono"),
            `+ ${fmtEUR(d.supplementMonoparental)}`,
          ]);
        if (d.supplementHandicap)
          rows.push([
            "  " + t("afSuppHandicap"),
            `+ ${fmtEUR(d.supplementHandicap)}`,
          ]);
        if (d.supplementOrphelin)
          rows.push([
            "  " + t("afSuppOrphelin"),
            `+ ${fmtEUR(d.supplementOrphelin)}`,
          ]);
        if (d.supplement3eEnfant)
          rows.push([
            "  " + t("afSuppLargeFamille"),
            `+ ${fmtEUR(d.supplement3eEnfant)}`,
          ]);
        rows.forEach(([k, v]) => {
          doc.text(k, colKey, y);
          doc.text(v, pageWidth - margin, y, { align: "right" });
          y += lineGap;
        });
        y += 1;
      });

      // Bonus + naissance
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.setFontSize(11);
      doc.text(t("afPdfBonusTitle"), margin, y);
      y += 6;
      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(t("afPdfBonusRentree"), colKey, y);
      doc.setFont("", "bold");
      doc.text(fmtEUR(result.bonusRentreeAnnuel), pageWidth - margin, y, {
        align: "right",
      });
      y += lineGap;
      if (result.allocationNaissanceTotale > 0) {
        doc.setFont("", "normal");
        doc.text(
          t("afPdfBonusNaissance", { annee: ANNEE_COURANTE }),
          colKey,
          y,
        );
        doc.setFont("", "bold");
        doc.text(
          fmtEUR(result.allocationNaissanceTotale),
          pageWidth - margin,
          y,
          { align: "right" },
        );
        y += lineGap;
      }
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
        t("afPdfFooter"),
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

      doc.save(`docbel-allocations-familiales-${now.toISOString().split("T")[0]}.pdf`);
    } finally {
      setExportingPDF(false);
    }
  };

  const lastUpdatedFr = new Date(LAST_UPDATED).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const regionHint =
    REGION_OPTIONS.find((o) => o.value === region)?.hint ?? "";

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
                <Baby className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  {t("afTitle")}
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  {t("afSubtitle")}
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
              title={t("afResetFormTitle")}
            >
              <RotateCcw className="size-3.5" />
              {t("afReset")}
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country="Belgique" />
              Belgique
            </CalcBadge>
            <CalcBadge accent={accent}>Régions 2026</CalcBadge>
            <CalcBadge accent={accent}>Données 2026</CalcBadge>
          </div>

          {/* Région */}
          <CalcSelect<Region>
            id="allocs-region"
            label={t("afFieldRegionLabel")}
            hint={regionHint}
            value={region}
            onChange={setRegion}
            options={REGION_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          />

          {/* Revenu + monoparental */}
          <CalcGrid cols={2}>
            <CalcField
              id="allocs-revenu"
              label={t("afFieldRevenuLabel")}
              hint={t("afFieldRevenuHint")}
              value={revenu}
              onChange={setRevenu}
              placeholder="ex : 50000"
              min={0}
              max={500000}
              step={1000}
              suffix="€"
            />
            <YesNoToggle
              label={t("afFieldMonoLabel")}
              hint={t("afFieldMonoHint")}
              value={monoparental}
              onChange={setMonoparental}
              accent={accent}
            />
          </CalcGrid>

          {/* ----- Liste dynamique d'enfants ---------------------------- */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--glass-ink)]">
                <Users className="size-3.5" />
                {t("afChildrenCount", { n: enfants.length })}
              </span>
              <button
                type="button"
                onClick={addEnfant}
                disabled={enfants.length >= 10}
                className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: accent,
                  color: accent,
                  background: `${accent}10`,
                }}
              >
                <Plus className="size-3.5" />
                {t("afAddChild")}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {enfants.map((enfant, idx) => (
                <div
                  key={enfant.uid}
                  className="flex flex-col gap-3 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3"
                >
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <CalcField
                        id={`allocs-enfant-${enfant.uid}`}
                        label={t("afChildBirthYearLabel", { n: idx + 1 })}
                        value={enfant.anneeNaissance}
                        onChange={(v) =>
                          updateEnfant(enfant.uid, { anneeNaissance: v })
                        }
                        placeholder={String(DEFAUT_ANNEE_ENFANT)}
                        min={2000}
                        max={ANNEE_COURANTE}
                        step={1}
                      />
                    </div>
                    {enfants.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeEnfant(enfant.uid)}
                        aria-label={t("afRemoveChildAria", { n: idx + 1 })}
                        className="mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[color:var(--glass-border)] text-[color:var(--glass-ink-faint)] transition hover:border-amber-300 hover:text-amber-700"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>

                  <CalcGrid cols={2}>
                    <YesNoToggle
                      label={t("afFieldHandicapLabel")}
                      hint={t("afFieldHandicapHint")}
                      value={enfant.handicap}
                      onChange={(v) =>
                        updateEnfant(enfant.uid, { handicap: v })
                      }
                      accent={accent}
                    />
                    <CalcSelect<OrphelinStatus>
                      id={`allocs-orphelin-${enfant.uid}`}
                      label={t("afFieldOrphelinLabel")}
                      value={enfant.orphelin}
                      onChange={(v) =>
                        updateEnfant(enfant.uid, { orphelin: v })
                      }
                      options={[
                        { value: "aucun", label: t("afOrphelinAucun") },
                        { value: "un_parent", label: t("afOrphelinUnParent") },
                        { value: "deux_parents", label: t("afOrphelinDeuxParents") },
                      ]}
                    />
                  </CalcGrid>
                </div>
              ))}
            </div>
          </div>

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={onCalc}>
              {t("afSubmit")}
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
              {t("afResetForm")}
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
              {t.rich("afDisclaimerBody", {
                strong: (chunks) => (
                  <strong className="text-[color:var(--glass-ink)]">
                    {chunks}
                  </strong>
                ),
              })}
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
              <AllocsFamResultPanel
                result={result}
                region={region}
                accent={accent}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <AllocsFamResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Footer : Mise à jour + sources */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        {t.rich("afFooter", {
          date: lastUpdatedFr,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panneau résultat (rempli)                                         */
/* ------------------------------------------------------------------ */

function AllocsFamResultPanel({
  result,
  region,
  accent,
  onExportPDF,
  exporting,
}: {
  result: AllocsFamResult;
  region: Region;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const t = useTranslations("public.outils");
  const tk = (key: string) => t(key as Parameters<typeof t>[0]);
  const aHandicap = result.detail.some((d) => (d.supplementHandicap ?? 0) > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("afResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("afResultInfoTitle")}
          aria-label={t("afResultInfoTitle")}
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
          {fmtEUR(result.totalMensuel)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          {t("afPerMonth", { count: result.detail.length })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CalcBadge accent={accent}>{tk(REGION_KEYS[region].badge)}</CalcBadge>
          <span className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
            {t("afPaidByCaisse")}
          </span>
        </div>
      </div>

      {/* Détail par enfant */}
      <div
        className="border-t pt-3"
        style={{ borderTopColor: "var(--glass-ink-line)" }}
      >
        <div
          className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--glass-ink-faint)" }}
        >
          {t("afDetailPerChild")}
        </div>
        <div className="flex flex-col gap-2">
          {result.detail.map((d) => (
            <div
              key={d.rang}
              className="rounded-xl bg-[color:var(--glass-surface)] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-[color:var(--glass-ink)]">
                  {t("afChildLabel", { n: d.rang })}
                  <span className="ml-1.5 text-[color:var(--glass-ink-soft)]">
                    {t("afChildAge", { count: d.age })}
                  </span>
                </span>
                <span className="text-[14px] font-extrabold text-[color:var(--glass-ink)]">
                  {fmtEUR(d.total)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                <ResultRow label={t("afSuppBase")} value={fmtEUR(d.montantBase)} />
                {d.supplementSocial ? (
                  <ResultRow
                    label={t("afSuppSocial")}
                    value={fmtEUR(d.supplementSocial)}
                    direction="plus"
                  />
                ) : null}
                {d.supplementMonoparental ? (
                  <ResultRow
                    label={t("afSuppMono")}
                    value={fmtEUR(d.supplementMonoparental)}
                    direction="plus"
                  />
                ) : null}
                {d.supplementHandicap ? (
                  <ResultRow
                    label={t("afSuppHandicap")}
                    value={fmtEUR(d.supplementHandicap)}
                    direction="plus"
                  />
                ) : null}
                {d.supplementOrphelin ? (
                  <ResultRow
                    label={t("afSuppOrphelin")}
                    value={fmtEUR(d.supplementOrphelin)}
                    direction="plus"
                  />
                ) : null}
                {d.supplement3eEnfant ? (
                  <ResultRow
                    label={t("afSuppLargeFamille")}
                    value={fmtEUR(d.supplement3eEnfant)}
                    direction="plus"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bloc bonus rentrée + allocation naissance */}
      <div
        className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
        style={{
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          color: "#1E40AF",
        }}
      >
        <div className="mb-1 flex items-center gap-1.5 font-bold">
          <Info className="size-3.5" /> {t("afBonusTitle")}
        </div>
        <ul className="text-[#1E3A8A]">
          <li>
            {t.rich("afBonusRentree", {
              x: fmtEUR(result.bonusRentreeAnnuel),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          {result.allocationNaissanceTotale > 0 ? (
            <li className="mt-1">
              {t.rich("afBonusNaissance", {
                annee: ANNEE_COURANTE,
                x: fmtEUR(result.allocationNaissanceTotale),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          ) : null}
        </ul>
      </div>

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
          <Info className="size-3.5" /> {t("afKnowTitle")}
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            {t.rich("afKnowRegion", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("afKnowSocial", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          {aHandicap ? (
            <li>
              {t.rich("afKnowHandicap", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          ) : null}
          <li>
            {t.rich("afKnowContact", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
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
        {exporting ? t("afExporting") : t("afDownloadPdf")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function AllocsFamResultPlaceholder({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("afResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        {t.rich("afPlaceholder", {
          em: (chunks) => <em>{chunks}</em>,
        })}
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
