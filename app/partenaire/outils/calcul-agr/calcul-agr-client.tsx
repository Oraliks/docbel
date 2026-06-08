"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
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
  type AgrGlobalInput,
  type CategorieFamiliale,
  type CategorieTravailleur,
  type OccupationInput,
  type ParsedWech506,
} from "@/lib/agr";
import { exportAgrPdf } from "@/lib/agr/export-pdf";

const MAX_OCC = 4;

/** Champs « heures » d'une occupation dans lesquels verser un code à vérifier. */
type NumericOccField = "heures" | "heuresV" | "heuresA" | "pw1" | "pr" | "fermetureTotal";
const BUCKETS: { label: string; field: NumericOccField }[] = [
  { label: "Heures", field: "heures" },
  { label: "Vacances", field: "heuresV" },
  { label: "Absence", field: "heuresA" },
  { label: "PW", field: "pw1" },
  { label: "PR", field: "pr" },
  { label: "Fermeture", field: "fermetureTotal" },
];

/** Métadonnées d'affichage par occupation (issues de la DRS). */
interface OccMeta {
  filename?: string;
  niss?: string | null;
  nom?: string | null;
  periode?: string | null;
  codesAVerifier?: { code: string; heures: number; libelle: string }[];
}

interface ParseResult {
  filename: string;
  parsed?: ParsedWech506;
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
    qinfo: p.qinfo,
    q: p.q,
    s: p.s,
    categorieTravailleur: p.categorieTravailleur ?? "1O",
    ybrut: p.ybrut,
    salaireTheoriqueHeure: p.salaireTheoriqueHeure,
    salaireTheoriqueMois: p.salaireTheoriqueMois,
    heures: p.buckets.heures,
    heuresV: p.buckets.heuresV,
    heuresA: p.buckets.heuresA,
    requalifier: false,
    soldeS32: 0,
    soldeQ4: 0,
    pw1: p.buckets.pw1,
    pw2: 0,
    pr: p.buckets.pr,
    fermetureTotal: p.buckets.fermetureTotal,
    joursNI: 0,
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

/** Représentation texte (FR, virgule décimale) d'une valeur numérique. */
function fmtNum(v: number): string {
  return v === 0 ? "" : String(v).replace(".", ",");
}

export function CalculAgrClient() {
  const [occupations, setOccupations] = useState<OccupationInput[]>([emptyOccupation()]);
  const [metas, setMetas] = useState<OccMeta[]>([{}]);
  const [global, setGlobal] = useState<Omit<AgrGlobalInput, "occupations">>({
    allocationJournaliere: 0,
    demiAllocation: 0,
    categorieFamiliale: "A",
    ageAuMoins21: true,
    soldeJ: 0,
    moisDecembre: false,
    cumulTempsPartiel: true,
    joursCC: 0,
    incapaciteOuSanctionTotalite: false,
    bareme: "010426",
  });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () => calculerAgr({ ...global, occupations }),
    [global, occupations],
  );
  const hasData = occupations.some((o) => o.q > 0);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportAgrPdf({
        global,
        occupations,
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

  const patchOcc = useCallback((i: number, patch: Partial<OccupationInput>) => {
    setOccupations((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }, []);

  // Verse les heures d'un code « à vérifier » dans un bucket, puis retire la pastille.
  const assignCode = useCallback(
    (i: number, field: NumericOccField, heures: number, code: string, label: string) => {
      setOccupations((prev) =>
        prev.map((o, j) =>
          j === i ? { ...o, [field]: Math.round((o[field] + heures) * 100) / 100 } : o,
        ),
      );
      setMetas((prev) =>
        prev.map((m, j) =>
          j === i
            ? { ...m, codesAVerifier: m.codesAVerifier?.filter((c) => c.code !== code) }
            : m,
        ),
      );
      toast.success(`Code ${code} → ${label} (+${heures} h)`);
    },
    [],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
      if (files.length === 0) {
        setUploadError("Veuillez déposer des fichiers PDF (WECH 506).");
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const fd = new FormData();
        files.slice(0, MAX_OCC).forEach((f) => fd.append("files", f));
        const res = await fetch("/api/partenaire/calcul-agr/parse", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Erreur ${res.status}`);
        }
        const { results } = (await res.json()) as { results: ParseResult[] };

        const newOccs: OccupationInput[] = [];
        const newMetas: OccMeta[] = [];
        const errors: string[] = [];
        for (const r of results) {
          if (r.error || !r.parsed) {
            errors.push(`${r.filename} : ${r.error ?? "échec"}${r.detail ? ` — ${r.detail}` : ""}`);
            continue;
          }
          newOccs.push(parsedToOccupation(r.parsed));
          newMetas.push({
            filename: r.filename,
            niss: r.parsed.niss,
            nom: r.parsed.nomTravailleur,
            periode: r.parsed.moisReference
              ? `${r.parsed.moisReference.debut} – ${r.parsed.moisReference.fin}`
              : null,
            codesAVerifier: r.parsed.codesAVerifier,
          });
        }
        if (errors.length) {
          setUploadError(errors.join(" · "));
          errors.forEach((e) => toast.error(e));
        }

        if (newOccs.length) {
          // Remplace si la 1ʳᵉ occupation est encore vierge, sinon ajoute.
          setOccupations((prev) => {
            const base = prev.length === 1 && prev[0].q === 0 ? [] : prev;
            return [...base, ...newOccs].slice(0, MAX_OCC);
          });
          setMetas((prev) => {
            const base = prev.length === 1 && !prev[0].filename ? [] : prev;
            return [...base, ...newMetas].slice(0, MAX_OCC);
          });
          newMetas.forEach((m) => {
            toast.success(`DRS chargée : ${m.nom ?? m.filename ?? "occupation"}`, {
              description: m.periode ?? undefined,
            });
            if (m.codesAVerifier && m.codesAVerifier.length > 0) {
              toast.warning(
                `${m.filename ?? "DRS"} : ${m.codesAVerifier.length} code(s) à classer manuellement`,
              );
            }
          });
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
    [],
  );

  const addOccupation = () => {
    if (occupations.length >= MAX_OCC) return;
    setOccupations((p) => [...p, emptyOccupation()]);
    setMetas((p) => [...p, {}]);
  };

  const removeOccupation = (i: number) => {
    setOccupations((p) => (p.length === 1 ? [emptyOccupation()] : p.filter((_, j) => j !== i)));
    setMetas((p) => (p.length === 1 ? [{}] : p.filter((_, j) => j !== i)));
  };

  const reset = () => {
    setOccupations([emptyOccupation()]);
    setMetas([{}]);
    setGlobal((g) => ({ ...g, allocationJournaliere: 0, demiAllocation: 0, soldeJ: 0, joursCC: 0 }));
    setUploadError(null);
  };

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
      <Card>
        <CardContent className="pt-6">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-violet-500 bg-violet-50" : "border-muted-foreground/25 hover:border-violet-400"
            }`}
          >
            {uploading ? (
              <Loader2 className="size-8 animate-spin text-violet-600" />
            ) : (
              <Upload className="size-8 text-violet-600" />
            )}
            <p className="text-sm font-medium">
              {uploading ? "Extraction en cours…" : "Glissez les WECH 506 ici, ou cliquez pour parcourir"}
            </p>
            <p className="text-xs text-muted-foreground">PDF · 1 fichier par occupation · max {MAX_OCC}</p>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
          {uploadError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="size-4" />
              <AlertTitle>Attention</AlertTitle>
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Colonne formulaire */}
        <div className="space-y-6">
          {/* Paramètres du dossier */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paramètres du dossier</CardTitle>
              <CardDescription>Données du dossier chômage (hors WECH 506).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <NumField
                label="Allocation journalière (€)"
                value={global.allocationJournaliere}
                onChange={(v) => setGlobal((g) => ({ ...g, allocationJournaliere: v }))}
              />
              <NumField
                label="Demi-allocation (€)"
                value={global.demiAllocation}
                onChange={(v) => setGlobal((g) => ({ ...g, demiAllocation: v }))}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Catégorie familiale</Label>
                <Select
                  value={global.categorieFamiliale}
                  onValueChange={(v) => setGlobal((g) => ({ ...g, categorieFamiliale: v as CategorieFamiliale }))}
                >
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
              <NumField
                label="Solde J (jours)"
                value={global.soldeJ}
                onChange={(v) => setGlobal((g) => ({ ...g, soldeJ: v }))}
              />
              <NumField
                label="Jours CC"
                value={global.joursCC}
                onChange={(v) => setGlobal((g) => ({ ...g, joursCC: v }))}
              />
              <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 md:col-span-3">
                <CheckRow
                  label="Mois de décembre"
                  checked={global.moisDecembre}
                  onChange={(v) => setGlobal((g) => ({ ...g, moisDecembre: v }))}
                />
                <CheckRow
                  label="Cumul temps partiel"
                  checked={global.cumulTempsPartiel}
                  onChange={(v) => setGlobal((g) => ({ ...g, cumulTempsPartiel: v }))}
                />
                <CheckRow
                  label="Incapacité/sanction tout le mois"
                  checked={global.incapaciteOuSanctionTotalite}
                  onChange={(v) => setGlobal((g) => ({ ...g, incapaciteOuSanctionTotalite: v }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Occupations */}
          {occupations.map((occ, i) => (
            <OccupationCard
              key={i}
              index={i}
              occ={occ}
              meta={metas[i] ?? {}}
              onChange={(patch) => patchOcc(i, patch)}
              onAssign={(field, heures, code, label) => assignCode(i, field, heures, code, label)}
              onRemove={() => removeOccupation(i)}
              canRemove={occupations.length > 1}
            />
          ))}

          {occupations.length < MAX_OCC && (
            <Button variant="outline" onClick={addOccupation} className="w-full">
              <Plus className="size-4" /> Ajouter une occupation (double emploi)
            </Button>
          )}
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

/* ─────────────────────────── sous-composants ─────────────────────────── */

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
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
        step={step}
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
  label,
  checked,
  onChange,
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

function OccupationCard({
  index,
  occ,
  meta,
  onChange,
  onAssign,
  onRemove,
  canRemove,
}: {
  index: number;
  occ: OccupationInput;
  meta: OccMeta;
  onChange: (patch: Partial<OccupationInput>) => void;
  onAssign: (field: NumericOccField, heures: number, code: string, label: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <Card className="duration-300 animate-in fade-in slide-in-from-bottom-2">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              Occupation {index + 1}
              {meta.filename && (
                <Badge variant="secondary" className="max-w-[200px] truncate">
                  <FileUp className="size-3" /> {meta.filename}
                </Badge>
              )}
            </CardTitle>
            {(meta.nom || meta.periode) && (
              <CardDescription className="mt-1 truncate">
                {meta.nom}
                {meta.nom && meta.periode ? " · " : ""}
                {meta.periode}
              </CardDescription>
            )}
          </div>
          {canRemove && (
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Supprimer l'occupation">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumField label="Facteur Q" value={occ.q} onChange={(v) => onChange({ q: v })} />
          <NumField label="Facteur S" value={occ.s} onChange={(v) => onChange({ s: v })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie trav.</Label>
            <Select
              value={occ.categorieTravailleur}
              onValueChange={(v) => onChange({ categorieTravailleur: v as CategorieTravailleur })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1O">1O — ouvrier privé</SelectItem>
                <SelectItem value="1E">1E — employé privé</SelectItem>
                <SelectItem value="2E">2E — employé public</SelectItem>
                <SelectItem value="2P">2P — ouvrier public</SelectItem>
                <SelectItem value="3">3 — statutaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Qinfo</Label>
            <Select value={String(occ.qinfo)} onValueChange={(v) => onChange({ qinfo: Number(v) as 2 | 3 })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 — même Q</SelectItem>
                <SelectItem value="3">3 — Q moyen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <NumField label="Y-Brut (€)" value={occ.ybrut} onChange={(v) => onChange({ ybrut: v })} />
          <NumField label="Sal. théo./mois (€)" value={occ.salaireTheoriqueMois} onChange={(v) => onChange({ salaireTheoriqueMois: v })} />
          <NumField label="Sal. théo./heure (€)" value={occ.salaireTheoriqueHeure} onChange={(v) => onChange({ salaireTheoriqueHeure: v })} />
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumField label="Heures (HT)" value={occ.heures} onChange={(v) => onChange({ heures: v })} />
          <NumField label="Vacances (V)" value={occ.heuresV} onChange={(v) => onChange({ heuresV: v })} />
          <NumField label="Absence (A)" value={occ.heuresA} onChange={(v) => onChange({ heuresA: v })} />
          <NumField label="Fermeture" value={occ.fermetureTotal} onChange={(v) => onChange({ fermetureTotal: v })} />
          <NumField label="PW (CT)" value={occ.pw1} onChange={(v) => onChange({ pw1: v })} />
          <NumField label="PR" value={occ.pr} onChange={(v) => onChange({ pr: v })} />
          <NumField label="Solde S×3,2" value={occ.soldeS32} onChange={(v) => onChange({ soldeS32: v })} />
          <NumField label="Solde Q×4" value={occ.soldeQ4} onChange={(v) => onChange({ soldeQ4: v })} />
          <NumField label="Jours NI" value={occ.joursNI} onChange={(v) => onChange({ joursNI: v })} />
          <div className="col-span-2 flex items-end pb-1 md:col-span-2">
            <CheckRow
              label="Requalifier A → V"
              checked={occ.requalifier}
              onChange={(v) => onChange({ requalifier: v })}
            />
          </div>
        </div>

        {meta.codesAVerifier && meta.codesAVerifier.length > 0 && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle className="text-sm">Codes à classer ({meta.codesAVerifier.length})</AlertTitle>
            <AlertDescription className="space-y-2 text-xs">
              <p>Ces codes ne sont pas mappés automatiquement. Versez-les dans le bon champ :</p>
              {meta.codesAVerifier.map((c) => (
                <div key={c.code} className="rounded-md border bg-background/60 p-2">
                  <div className="mb-1.5">
                    <span className="font-medium">{c.code}</span> — {c.libelle} :{" "}
                    <strong>{c.heures} h</strong>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {BUCKETS.map((b) => (
                      <Button
                        key={b.field}
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => onAssign(b.field, c.heures, c.code, b.label)}
                      >
                        → {b.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ResultPanel({
  result,
  showDetails,
  onToggleDetails,
  onExport,
  exporting,
  canExport,
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
            {/* Montant phare : barème 57 */}
            <div className="rounded-lg bg-violet-600 px-4 py-3 text-white shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-wide text-violet-100">
                AGR brut — Barème 57/-
              </div>
              <div
                key={result.bareme57 ?? "x"}
                className="text-3xl font-bold tabular-nums duration-300 animate-in fade-in"
              >
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
        <Button
          onClick={onExport}
          disabled={!canExport || exporting}
          className="w-full bg-violet-600 hover:bg-violet-700"
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
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
  label,
  value,
  motif,
  big,
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
