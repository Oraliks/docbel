"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  FileUp,
  Info,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  calculerAgr,
  ctEntriesOf,
  planCtMerge,
  type AgrGlobalInput,
  type CategorieFamiliale,
  type CategorieTravailleur,
  type CtOccupationRef,
  type GrilleEntry,
  type OccupationInput,
  type ParsedWech505,
  type ParsedWech506,
} from "@/lib/agr";
import { exportAgrPdf } from "@/lib/agr/export-pdf";

const MAX_OCC = 4;

/** Champ numérique d'une occupation. */
type NumKey =
  | "q" | "s" | "ybrut" | "salaireTheoriqueMois" | "salaireTheoriqueHeure"
  | "heures" | "heuresV" | "heuresA" | "fermetureTotal" | "pw1" | "pr"
  | "soldeS32" | "soldeQ4" | "joursNI";

/** Champs « heures » où verser un code à vérifier. */
type BucketField = "heures" | "heuresV" | "heuresA" | "pw1" | "pr" | "fermetureTotal";
const BUCKETS: { label: string; field: BucketField }[] = [
  { label: "Heures", field: "heures" },
  { label: "Vacances", field: "heuresV" },
  { label: "Absence", field: "heuresA" },
  { label: "PW", field: "pw1" },
  { label: "PR", field: "pr" },
  { label: "Fermeture", field: "fermetureTotal" },
];

/** Lignes du tableau des occupations (ordre d'affichage = façon Excel). */
type RowSpec =
  | { kind: "ident" }
  | { kind: "periode" }
  | { kind: "cat" }
  | { kind: "qinfo" }
  | { kind: "requalif" }
  | { kind: "num"; label: string; field: NumKey };

const ROWS: RowSpec[] = [
  { kind: "ident" },
  { kind: "periode" },
  { kind: "num", label: "Facteur Q", field: "q" },
  { kind: "num", label: "Facteur S", field: "s" },
  { kind: "cat" },
  { kind: "qinfo" },
  { kind: "num", label: "Y-Brut (€)", field: "ybrut" },
  { kind: "num", label: "Sal. théo. / mois (€)", field: "salaireTheoriqueMois" },
  { kind: "num", label: "Sal. théo. / heure (€)", field: "salaireTheoriqueHeure" },
  { kind: "num", label: "Heures (HT)", field: "heures" },
  { kind: "num", label: "Vacances (V)", field: "heuresV" },
  { kind: "num", label: "Absence (A)", field: "heuresA" },
  { kind: "num", label: "Fermeture", field: "fermetureTotal" },
  { kind: "num", label: "PW (CT)", field: "pw1" },
  { kind: "num", label: "PR", field: "pr" },
  { kind: "num", label: "Solde S×3,2", field: "soldeS32" },
  { kind: "num", label: "Solde Q×4", field: "soldeQ4" },
  { kind: "num", label: "Jours NI", field: "joursNI" },
  { kind: "requalif" },
];

/** Métadonnées d'affichage + rapprochement par occupation (issues de la DRS). */
interface OccMeta {
  filename?: string;
  niss?: string | null;
  nom?: string | null;
  employeurOnss?: string | null;
  periode?: string | null;
  moisDebut?: string | null;
  moisFin?: string | null;
  /** Entrées CT (codes 5.x) déjà comptées — pour dédupliquer un WECH 505. */
  ctEntries?: GrilleEntry[];
  codesAVerifier?: { code: string; heures: number; libelle: string }[];
}

interface ParseResult {
  filename: string;
  /** "506" = C131B (AGR) ; "505" = C3.2 (chômage temporaire). */
  kind?: "506" | "505";
  parsed?: ParsedWech506 | ParsedWech505;
  error?: string;
  detail?: string;
}

function emptyOccupation(): OccupationInput {
  return {
    qinfo: 2, q: 0, s: 0, categorieTravailleur: "1O",
    ybrut: 0, salaireTheoriqueHeure: 0, salaireTheoriqueMois: 0,
    heures: 0, heuresV: 0, heuresA: 0, requalifier: false,
    soldeS32: 0, soldeQ4: 0, pw1: 0, pw2: 0, pr: 0,
    fermetureTotal: 0, joursNI: 0,
  };
}

function parsedToOccupation(p: ParsedWech506): OccupationInput {
  return {
    qinfo: p.qinfo, q: p.q, s: p.s,
    categorieTravailleur: p.categorieTravailleur ?? "1O",
    ybrut: p.ybrut,
    salaireTheoriqueHeure: p.salaireTheoriqueHeure,
    salaireTheoriqueMois: p.salaireTheoriqueMois,
    heures: p.buckets.heures, heuresV: p.buckets.heuresV, heuresA: p.buckets.heuresA,
    requalifier: false, soldeS32: 0, soldeQ4: 0,
    pw1: p.buckets.pw1, pw2: 0, pr: p.buckets.pr,
    fermetureTotal: p.buckets.fermetureTotal, joursNI: 0,
  };
}

/** Construit les métadonnées d'occupation (identité + CT déjà comptées). */
function metaFromWech506(filename: string, p: ParsedWech506): OccMeta {
  return {
    filename,
    niss: p.niss,
    nom: p.nomTravailleur,
    employeurOnss: p.employeurOnss,
    periode: p.moisReference ? `${p.moisReference.debut} – ${p.moisReference.fin}` : null,
    moisDebut: p.moisReference?.debut ?? null,
    moisFin: p.moisReference?.fin ?? null,
    ctEntries: ctEntriesOf(p.grille),
    codesAVerifier: p.codesAVerifier,
  };
}

function eur(x: number | null): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return x.toLocaleString("fr-BE", { style: "currency", currency: "EUR" });
}

/** Parse une saisie numérique FR/EN (« 66,31 » ou « 66.31 »). */
function toNum(s: string): number {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

const fourEmpty = <T,>(make: () => T): T[] => Array.from({ length: MAX_OCC }, make);

/** Représentation texte (FR, virgule décimale) d'une valeur numérique. */
function fmtNum(v: number): string {
  return v === 0 ? "" : String(v).replace(".", ",");
}

export function CalculAgrClient() {
  const [occupations, setOccupations] = useState<OccupationInput[]>(() => fourEmpty(emptyOccupation));
  const [metas, setMetas] = useState<OccMeta[]>(() => fourEmpty(() => ({})));
  const [global, setGlobal] = useState<Omit<AgrGlobalInput, "occupations">>({
    allocationJournaliere: 0, demiAllocation: 0, categorieFamiliale: "A",
    ageAuMoins21: true, soldeJ: 0, moisDecembre: false, cumulTempsPartiel: true,
    joursCC: 0, incapaciteOuSanctionTotalite: false, bareme: "010426",
  });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => calculerAgr({ ...global, occupations }), [global, occupations]);
  const hasData = occupations.some((o) => o.q > 0);
  const filenames = metas.map((m) => m.filename).filter(Boolean) as string[];

  const setG = <K extends keyof typeof global>(k: K, v: (typeof global)[K]) =>
    setGlobal((g) => ({ ...g, [k]: v }));

  const patchOcc = useCallback((i: number, patch: Partial<OccupationInput>) => {
    setOccupations((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }, []);

  const clearOcc = useCallback((i: number) => {
    setOccupations((prev) => prev.map((o, j) => (j === i ? emptyOccupation() : o)));
    setMetas((prev) => prev.map((m, j) => (j === i ? {} : m)));
  }, []);

  const assignCode = useCallback(
    (i: number, field: BucketField, heures: number, code: string, label: string) => {
      setOccupations((prev) =>
        prev.map((o, j) => (j === i ? { ...o, [field]: Math.round((o[field] + heures) * 100) / 100 } : o)),
      );
      setMetas((prev) =>
        prev.map((m, j) =>
          j === i ? { ...m, codesAVerifier: m.codesAVerifier?.filter((c) => c.code !== code) } : m,
        ),
      );
      toast.success(`Code ${code} → ${label} (+${heures} h)`);
    },
    [],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportAgrPdf({
        global, occupations,
        metas: metas.map((m) => ({ filename: m.filename, nom: m.nom, periode: m.periode })),
        result,
      });
      toast.success("PDF généré.");
    } catch {
      toast.error("Échec de la génération du PDF.");
    } finally {
      setExporting(false);
    }
  }, [global, occupations, metas, result]);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
      if (files.length === 0) {
        setUploadError("Veuillez déposer des fichiers PDF (WECH 506 / 505).");
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        files.slice(0, MAX_OCC).forEach((f) => fd.append("files", f));
        const res = await fetch("/api/partenaire/calcul-agr/parse", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Erreur ${res.status}`);
        }
        const { results } = (await res.json()) as { results: ParseResult[] };

        // Copies de travail (modèle à 4 colonnes). Les WECH 506 remplissent les
        // colonnes libres (Q ≤ 0) ; les WECH 505 (chômage temporaire) sont
        // fusionnés dans l'occupation correspondante (NISS + nom + ONSS + mois).
        const occs = [...occupations];
        const mets = [...metas];
        const freeSlots = occs.map((o, i) => (o.q <= 0 ? i : -1)).filter((i) => i >= 0);
        const drs505: { filename: string; parsed: ParsedWech505 }[] = [];
        const parseErrors: string[] = [];
        const warnings: string[] = [];
        let loaded = 0;

        for (const r of results) {
          if (r.error || !r.parsed) {
            parseErrors.push(`${r.filename} : ${r.error ?? "échec"}${r.detail ? ` — ${r.detail}` : ""}`);
            continue;
          }
          if (r.kind === "505") {
            drs505.push({ filename: r.filename, parsed: r.parsed as ParsedWech505 });
            continue;
          }
          // WECH 506 → occupation, dans la 1ʳᵉ colonne libre.
          const p = r.parsed as ParsedWech506;
          const slot = freeSlots.shift();
          if (slot === undefined) {
            warnings.push(`${r.filename} : aucune colonne libre (max ${MAX_OCC} occupations).`);
            continue;
          }
          occs[slot] = parsedToOccupation(p);
          mets[slot] = metaFromWech506(r.filename, p);
          loaded++;
          toast.success(`DRS chargée : ${mets[slot].nom ?? r.filename}`, {
            description: mets[slot].periode ?? undefined,
          });
          if (p.codesAVerifier.length > 0) {
            toast.warning(`${r.filename} : ${p.codesAVerifier.length} code(s) à classer`);
          }
        }

        // Fusion des WECH 505 : rapprochement par identité + mois, déduplication
        // (pas de double comptage si le 506 contient déjà les codes 5.x).
        for (const { filename, parsed } of drs505) {
          const refs: CtOccupationRef[] = mets.map((m) => ({
            niss: m.niss ?? null,
            nom: m.nom ?? null,
            employeurOnss: m.employeurOnss ?? null,
            moisDebut: m.moisDebut ?? null,
            moisFin: m.moisFin ?? null,
            ctEntries: m.ctEntries ?? [],
          }));
          const plan = planCtMerge(parsed, refs);
          if (plan.status === "merged" && plan.matchedIndex !== null) {
            const idx = plan.matchedIndex;
            occs[idx] = {
              ...occs[idx],
              pw1: Math.round((occs[idx].pw1 + plan.addPw) * 100) / 100,
              fermetureTotal: Math.round((occs[idx].fermetureTotal + plan.addFermeture) * 100) / 100,
            };
            mets[idx] = { ...mets[idx], ctEntries: [...(mets[idx].ctEntries ?? []), ...plan.newEntries] };
            loaded++;
            toast.success(`${filename} : ${plan.message}`);
          } else if (plan.status === "duplicate") {
            toast.info(`${filename} : ${plan.message}`);
          } else {
            toast.warning(`${filename} : ${plan.message}`);
            warnings.push(`${filename} : ${plan.message}`);
          }
        }

        parseErrors.forEach((e) => toast.error(e));
        const banner = [...parseErrors, ...warnings];
        if (banner.length) setUploadError(banner.join(" · "));

        if (loaded > 0) {
          setOccupations(occs);
          setMetas(mets);
          // Défile en douceur vers le résultat.
          requestAnimationFrame(() =>
            resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Échec de l'upload.";
        setUploadError(msg);
        toast.error(msg);
      } finally {
        setUploading(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    },
    [occupations, metas],
  );

  const reset = () => {
    setOccupations(fourEmpty(emptyOccupation));
    setMetas(fourEmpty(() => ({})));
    setGlobal((g) => ({ ...g, allocationJournaliere: 0, demiAllocation: 0, soldeJ: 0, joursCC: 0 }));
    setUploadError(null);
  };

  const codesToVerify = metas
    .map((m, i) => ({ i, meta: m }))
    .filter((x) => (x.meta.codesAVerifier?.length ?? 0) > 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Calculator className="size-6 text-violet-600" />
            Calcul AGR
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Déposez le(s) WECH 506 : les données sont extraites automatiquement et l’allocation
            de garantie de revenus est calculée. Jusqu’à {MAX_OCC} occupations (double/triple emploi).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="size-4" /> Réinitialiser
        </Button>
      </div>

      {/* Zone d'upload */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-0 p-0 sm:flex-row sm:items-stretch">
          <div className="flex items-center gap-2 px-5 py-4 text-sm font-medium text-muted-foreground sm:w-44 sm:border-r">
            <FileUp className="size-4 text-violet-600" /> WECH 506 / 505
          </div>
          <div className="flex-1 p-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? "border-violet-500 bg-violet-50" : "border-muted-foreground/25 hover:border-violet-400"
              }`}
            >
              {uploading ? (
                <Loader2 className="size-7 animate-spin text-violet-600" />
              ) : (
                <Upload className="size-7 text-violet-600" />
              )}
              <p className="text-sm font-medium">
                {uploading ? "Extraction en cours…" : "Glissez les WECH 506 (AGR) et 505 (chômage temp.) ici, ou cliquez"}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF · 506 = 1 occupation · 505 = chômage temporaire rattaché · max {MAX_OCC}
              </p>
              <input ref={fileInput} type="file" accept="application/pdf" multiple hidden
                onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </div>
          </div>
        </CardContent>
      </Card>
      {uploadError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Attention</AlertTitle>
          <AlertDescription className="break-words">{uploadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Paramètres du dossier */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paramètres du dossier</CardTitle>
              <CardDescription>Données du dossier chômage (hors WECH 506).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <NumField label="Allocation journalière (€)" value={global.allocationJournaliere}
                onChange={(v) => setG("allocationJournaliere", v)} />
              <NumField label="Demi-allocation (€)" value={global.demiAllocation}
                onChange={(v) => setG("demiAllocation", v)} />
              <div className="space-y-1.5">
                <Label className="text-xs">Catégorie familiale</Label>
                <Select value={global.categorieFamiliale}
                  onValueChange={(v) => setG("categorieFamiliale", v as CategorieFamiliale)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A — chef de ménage</SelectItem>
                    <SelectItem value="N">N — isolé</SelectItem>
                    <SelectItem value="B1">B1 — cohabitant 1ʳᵉ pér.</SelectItem>
                    <SelectItem value="B2">B2 — cohabitant 2ᵉ pér.</SelectItem>
                    <SelectItem value="P">P — cohabitant forfait</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Solde J (jours)" value={global.soldeJ} onChange={(v) => setG("soldeJ", v)} />
              <NumField label="Jours CC" value={global.joursCC} onChange={(v) => setG("joursCC", v)} />
              <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 md:col-span-3">
                <CheckRow label="Mois de décembre" checked={global.moisDecembre}
                  onChange={(v) => setG("moisDecembre", v)} />
                <CheckRow label="Cumul temps partiel" checked={global.cumulTempsPartiel}
                  onChange={(v) => setG("cumulTempsPartiel", v)} />
                <CheckRow label="Incapacité/sanction tout le mois" checked={global.incapaciteOuSanctionTotalite}
                  onChange={(v) => setG("incapaciteOuSanctionTotalite", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Occupations — tableau */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Occupations</CardTitle>
                <span className="text-xs text-muted-foreground">(jusqu’à {MAX_OCC})</span>
                {filenames.map((f) => (
                  <Badge key={f} variant="secondary" className="max-w-[180px] truncate">
                    <FileUp className="size-3" /> {f}
                  </Badge>
                ))}
              </div>
              <CardDescription className="flex items-center gap-1">
                <Info className="size-3" /> Une colonne par occupation. Renseignez les colonnes ou
                déposez un WECH 506 par occupation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <OccupationsTable
                occupations={occupations}
                metas={metas}
                onPatch={patchOcc}
                onClear={clearOcc}
              />
            </CardContent>
          </Card>

          {/* Codes à classer */}
          {codesToVerify.map(({ i, meta }) => (
            <Alert key={i}>
              <AlertTriangle className="size-4" />
              <AlertTitle className="text-sm">
                Occupation {i + 1}{meta.nom ? ` — ${meta.nom}` : ""} : codes à classer (
                {meta.codesAVerifier!.length})
              </AlertTitle>
              <AlertDescription className="space-y-2 text-xs">
                <p>Ces codes ne sont pas mappés automatiquement. Versez-les dans le bon champ :</p>
                {meta.codesAVerifier!.map((c) => (
                  <div key={c.code} className="rounded-md border bg-background/60 p-2">
                    <div className="mb-1.5">
                      <span className="font-medium">{c.code}</span> — {c.libelle} : <strong>{c.heures} h</strong>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {BUCKETS.map((b) => (
                        <Button key={b.field} variant="outline" size="sm" className="h-6 px-2 text-[11px]"
                          onClick={() => assignCode(i, b.field, c.heures, c.code, b.label)}>
                          → {b.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          ))}
        </div>

        {/* Colonne résultat (sticky) */}
        <div ref={resultRef} className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
          <ResultPanel
            result={result}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((s) => !s)}
            onExport={handleExport}
            exporting={exporting}
            canExport={hasData}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── tableau occupations ─────────────────────────── */

function OccupationsTable({
  occupations,
  metas,
  onPatch,
  onClear,
}: {
  occupations: OccupationInput[];
  metas: OccMeta[];
  onPatch: (i: number, patch: Partial<OccupationInput>) => void;
  onClear: (i: number) => void;
}) {
  const cols = [0, 1, 2, 3];
  const active = (i: number) => occupations[i].q > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky left-0 z-10 min-w-[150px] bg-muted/40 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              #
            </th>
            {cols.map((i) => (
              <th key={i} className="min-w-[150px] border-l px-2 py-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="font-semibold">{i + 1}</span>
                  <Badge
                    variant={active(i) ? "default" : "secondary"}
                    className={active(i) ? "bg-violet-600" : "text-muted-foreground"}
                  >
                    {active(i) ? "Actif" : "Inactif"}
                  </Badge>
                  {(active(i) || metas[i].filename) && (
                    <button
                      onClick={() => onClear(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Vider l'occupation ${i + 1}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, r) => (
            <tr key={r} className="border-b last:border-b-0">
              <th className="sticky left-0 z-10 min-w-[150px] bg-background px-3 py-1 text-left text-xs font-medium text-muted-foreground">
                {rowLabel(row)}
              </th>
              {cols.map((i) => (
                <td
                  key={i}
                  className={`border-l px-1 py-0.5 text-center align-middle ${
                    active(i) ? "" : "bg-muted/20"
                  }`}
                >
                  <Cell row={row} occ={occupations[i]} meta={metas[i]} onChange={(p) => onPatch(i, p)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rowLabel(row: RowSpec): string {
  switch (row.kind) {
    case "ident": return "Identité";
    case "periode": return "Période";
    case "cat": return "Cat. trav.";
    case "qinfo": return "Qinfo";
    case "requalif": return "Requalifier A → V";
    case "num": return row.label;
  }
}

function Cell({
  row,
  occ,
  meta,
  onChange,
}: {
  row: RowSpec;
  occ: OccupationInput;
  meta: OccMeta;
  onChange: (patch: Partial<OccupationInput>) => void;
}) {
  const cellInput =
    "h-8 w-full rounded border-0 bg-transparent px-1 text-center text-sm tabular-nums outline-none focus:bg-violet-50";

  switch (row.kind) {
    case "ident":
      return <span className="block truncate text-xs">{meta.nom ?? "—"}</span>;
    case "periode":
      return <span className="block truncate text-[11px] text-muted-foreground">{meta.periode ?? "—"}</span>;
    case "cat":
      return (
        <Select value={occ.categorieTravailleur}
          onValueChange={(v) => onChange({ categorieTravailleur: v as CategorieTravailleur })}>
          <SelectTrigger className="mx-auto h-8 w-[110px] border-0 bg-transparent focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1O">1O — ouvrier privé</SelectItem>
            <SelectItem value="1E">1E — employé privé</SelectItem>
            <SelectItem value="2E">2E — employé public</SelectItem>
            <SelectItem value="2P">2P — ouvrier public</SelectItem>
            <SelectItem value="3">3 — statutaire</SelectItem>
          </SelectContent>
        </Select>
      );
    case "qinfo":
      return (
        <Select value={String(occ.qinfo)} onValueChange={(v) => onChange({ qinfo: Number(v) as 2 | 3 })}>
          <SelectTrigger className="mx-auto h-8 w-[90px] border-0 bg-transparent focus:ring-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 — même Q</SelectItem>
            <SelectItem value="3">3 — Q moyen</SelectItem>
          </SelectContent>
        </Select>
      );
    case "requalif":
      return (
        <Checkbox
          className="mx-auto"
          checked={occ.requalifier}
          onCheckedChange={(v) => onChange({ requalifier: v === true })}
        />
      );
    case "num":
      return (
        <NumCell
          className={cellInput}
          value={occ[row.field]}
          onChange={(v) => onChange({ [row.field]: v } as Partial<OccupationInput>)}
        />
      );
  }
}

/** Saisie numérique d'une cellule du tableau : virgule décimale autorisée. */
function NumCell({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  // Texte saisi conservé tel quel (« 66, », « 1,5 ») pour ne pas avaler la
  // virgule ; resynchronisé si la valeur change de l'extérieur (upload, reset).
  const [text, setText] = useState(() => fmtNum(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (toNum(text) !== value) setText(fmtNum(value));
  }
  return (
    <input
      inputMode="decimal"
      className={className}
      value={text}
      placeholder="—"
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^-?\d*[.,]?\d*$/.test(raw)) return;
        setText(raw);
        onChange(toNum(raw));
      }}
    />
  );
}

/* ─────────────────────────── champs paramètres ─────────────────────────── */

function NumField({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  // Texte saisi conservé tel quel, pour autoriser les états transitoires
  // (« 66, », « 0, », « 1,5 ») sans que la virgule soit avalée par un
  // reformatage immédiat du nombre contrôlé.
  const [text, setText] = useState(() => fmtNum(value));

  // Resynchronise pendant le rendu quand la valeur change de l'extérieur
  // (upload DRS, reset, code « à vérifier »…) sans écraser la saisie en cours.
  // Pattern React « ajuster l'état à partir d'une prop » (sans useEffect).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (toNum(text) !== value) setText(fmtNum(value));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="decimal"
        value={text}
        placeholder="0"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value;
          // N'accepte que chiffres, un séparateur décimal (, ou .) et un signe.
          if (raw !== "" && !/^-?\d*[.,]?\d*$/.test(raw)) return;
          setText(raw);
          onChange(toNum(raw));
        }}
      />
    </div>
  );
}

function CheckRow({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

/* ─────────────────────────── panneau résultat ─────────────────────────── */

function ResultPanel({
  result, showDetails, onToggleDetails, onExport, exporting, canExport,
}: {
  result: ReturnType<typeof calculerAgr>;
  showDetails: boolean;
  onToggleDetails: () => void;
  onExport: () => void;
  exporting: boolean;
  canExport: boolean;
}) {
  const i = result.intermediaires;
  return (
    <Card className="border-violet-200">
      <CardHeader className="bg-violet-50/60">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="size-5 text-violet-600" /> Résultat AGR (brut)
        </CardTitle>
        <CardDescription>Salaire de référence : {eur(result.salaireReference)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {result.erreur ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{result.erreur}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="rounded-lg bg-violet-600 px-4 py-3 text-white shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-wide text-violet-100">
                AGR brut — Barème 57/-
              </div>
              <div key={result.bareme57 ?? "x"}
                className="text-3xl font-bold tabular-nums duration-300 animate-in fade-in">
                {eur(result.bareme57)}
              </div>
              {result.motif57 && <div className="text-xs text-violet-100">{result.motif57}</div>}
            </div>
            <ResultRow label="Barème 05/-" value={eur(result.bareme05)} motif={result.motif05} big />
            <Separator />
            <ResultRow label="Chômage temporaire" value={eur(result.chomageTemporaire)} />
            <ResultRow label="Total 57 (AGR+CT+CC)" value={eur(result.total57)} />
            <ResultRow label="Total 05 (AGR+CT+CC)" value={eur(result.total05)} />
          </>
        )}

        <Button variant="ghost" size="sm" className="w-full" onClick={onToggleDetails}>
          {showDetails ? "Masquer" : "Afficher"} les résultats intermédiaires
        </Button>
        {showDetails && (
          <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
            <Detail k="Nombre d'occupations" v={i.nombreOccupations} />
            <Detail k="F1 (allocations)" v={i.f1} />
            <Detail k="F2 (alloc. jour)" v={i.f2} />
            <Detail k="F3 / F4" v={`${i.f3} / ${i.f4}`} />
            <Detail k="VTL total" v={i.vtlTot} />
            <Detail k="Bonus total" v={i.bonusTot} />
            <Detail k="Salaire imposable" v={eur(i.totalSalaireImposable)} />
            <Detail k="Retenues (PP)" v={eur(i.totalRetenues)} />
            <Detail k="Y net BIS" v={eur(i.totalYnetBis)} />
            <Separator className="my-1.5" />
            <Detail k="Formule 1A" v={eur(i.formule1A)} />
            <Detail k="Formule 1B" v={eur(i.formule1B)} />
            <Detail k="Formule 2A" v={eur(i.formule2A)} />
            <Detail k="Formule 2B" v={eur(i.formule2B)} />
          </div>
        )}
        <Button onClick={onExport} disabled={!canExport || exporting}
          className="w-full bg-violet-600 hover:bg-violet-700">
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Télécharger le PDF
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Montants bruts. L’AGR doit être au moins égale à la ½ allocation. Vérifiez toujours
          les données extraites avant validation.
        </p>
      </CardContent>
    </Card>
  );
}

function ResultRow({
  label, value, motif, big,
}: {
  label: string;
  value: string;
  motif?: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={big ? "text-lg font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
        {motif && <p className="text-[11px] text-amber-600">{motif}</p>}
      </div>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
