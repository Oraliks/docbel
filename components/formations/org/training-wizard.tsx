"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, Trash2Icon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TRAINING_LEVELS,
  LEVEL_LABELS,
  TRAINING_FORMATS,
  FORMAT_LABELS,
  PRICE_TYPES,
  PRICE_TYPE_LABELS,
  CERTIFICATE_TYPES,
  CERTIFICATE_LABELS,
  SESSION_MODES,
  SESSION_MODE_LABELS,
  VISIBILITY_LABELS,
  type TrainingVisibility,
} from "@/lib/formations/constants";

export interface WizardCategory { id: string; slug: string; name: string }
export interface WizardTag { slug: string; name: string; isOrientationTag: boolean }

export interface SessionDraft {
  title: string;
  mode: string;
  startsAt: string;
  endsAt: string;
  city: string;
  region: string;
  onlineUrl: string;
  capacity: string;
  waitlistEnabled: boolean;
  registrationDeadline: string;
  requiresManualApproval: boolean;
}

export interface WizardInitial {
  title: string;
  shortDescription: string;
  description: string;
  objectives: string[];
  targetAudience: string;
  prerequisites: string;
  level: string;
  language: string;
  categoryId: string;
  format: string;
  durationHours: string;
  totalDurationLabel: string;
  rhythm: string;
  priceType: string;
  priceAmount: string;
  currency: string;
  externalPaymentUrl: string;
  paymentInfo: string;
  cancellationPolicy: string;
  certificateType: string;
  certificateDescription: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactWebsite: string;
  coverImageUrl: string;
  externalUrl: string;
  visibility: string;
  keywords: string;
  tagSlugs: string[];
}

interface Props {
  mode: "create" | "edit";
  basePath: string;
  trainingId?: string;
  categories: WizardCategory[];
  tags: WizardTag[];
  allowedVisibilities: string[];
  initial?: Partial<WizardInitial>;
}

const EMPTY: WizardInitial = {
  title: "", shortDescription: "", description: "", objectives: [], targetAudience: "",
  prerequisites: "", level: "debutant", language: "fr", categoryId: "", format: "online",
  durationHours: "", totalDurationLabel: "", rhythm: "", priceType: "free", priceAmount: "",
  currency: "EUR", externalPaymentUrl: "", paymentInfo: "", cancellationPolicy: "",
  certificateType: "none", certificateDescription: "", contactName: "", contactEmail: "",
  contactPhone: "", contactWebsite: "", coverImageUrl: "", externalUrl: "", visibility: "draft",
  keywords: "", tagSlugs: [],
};

const STEPS_CREATE = ["Général", "Format & orientation", "Sessions", "Prix & attestation", "Contact & médias", "Visibilité"];
const STEPS_EDIT = ["Général", "Format & orientation", "Prix & attestation", "Contact & médias", "Visibilité"];

const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TrainingWizard({ mode, basePath, trainingId, categories, tags, allowedVisibilities, initial }: Props) {
  const router = useRouter();
  const [f, setF] = useState<WizardInitial>({ ...EMPTY, ...initial });
  const [sessions, setSessions] = useState<SessionDraft[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const steps = mode === "create" ? STEPS_CREATE : STEPS_EDIT;
  const set = <K extends keyof WizardInitial>(k: K, v: WizardInitial[K]) => setF((p) => ({ ...p, [k]: v }));

  function toggleTag(slug: string) {
    set("tagSlugs", f.tagSlugs.includes(slug) ? f.tagSlugs.filter((s) => s !== slug) : [...f.tagSlugs, slug]);
  }

  function buildTrainingPayload() {
    return {
      title: f.title.trim(),
      shortDescription: f.shortDescription.trim(),
      description: f.description.trim(),
      objectives: f.objectives.map((o) => o.trim()).filter(Boolean),
      targetAudience: f.targetAudience.trim(),
      prerequisites: f.prerequisites.trim(),
      level: f.level,
      language: f.language,
      categoryId: f.categoryId || null,
      format: f.format,
      durationHours: f.durationHours ? Number(f.durationHours) : null,
      totalDurationLabel: f.totalDurationLabel.trim(),
      rhythm: f.rhythm.trim(),
      priceType: f.priceType,
      priceAmount: f.priceType === "paid" && f.priceAmount ? Number(f.priceAmount) : null,
      currency: f.currency || "EUR",
      externalPaymentUrl: f.externalPaymentUrl.trim(),
      paymentInfo: f.paymentInfo.trim(),
      cancellationPolicy: f.cancellationPolicy.trim(),
      certificateType: f.certificateType,
      certificateDescription: f.certificateDescription.trim(),
      contactName: f.contactName.trim(),
      contactEmail: f.contactEmail.trim(),
      contactPhone: f.contactPhone.trim(),
      contactWebsite: f.contactWebsite.trim(),
      coverImageUrl: f.coverImageUrl.trim(),
      externalUrl: f.externalUrl.trim(),
      visibility: f.visibility,
      keywords: f.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      tagSlugs: f.tagSlugs,
    };
  }

  function buildSessionsPayload() {
    const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
    return sessions.map((s) => ({
      title: s.title.trim() || undefined,
      mode: s.mode,
      startsAt: toIso(s.startsAt),
      endsAt: toIso(s.endsAt),
      city: s.city.trim() || undefined,
      region: s.region || undefined,
      onlineUrl: s.onlineUrl.trim() || undefined,
      capacity: s.capacity ? Number(s.capacity) : null,
      waitlistEnabled: s.waitlistEnabled,
      registrationDeadline: toIso(s.registrationDeadline),
      requiresManualApproval: s.requiresManualApproval,
      status: "open",
    }));
  }

  async function save(submit: boolean) {
    if (!f.title.trim()) {
      toast.error("Le titre est requis.");
      setStep(0);
      return;
    }
    if (submit && f.visibility === "draft") {
      toast.error("Choisissez une visibilité avant de soumettre.");
      setStep(steps.length - 1);
      return;
    }
    setBusy(true);
    try {
      const isCreate = mode === "create";
      const url = isCreate ? "/api/formations/trainings" : `/api/formations/trainings/${trainingId}`;
      const payload = isCreate
        ? { training: buildTrainingPayload(), sessions: buildSessionsPayload(), submit }
        : { training: buildTrainingPayload(), submit };
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Enregistrement impossible.");
        return;
      }
      toast.success(submit ? "Formation soumise à validation." : "Brouillon enregistré.");
      const id = isCreate ? data.id : trainingId;
      router.push(`${basePath}/${id}`);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  // Map UI step index → content for the current mode.
  const stepKey = steps[step];

  return (
    <div className="w-full max-w-3xl space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" onClick={() => router.push(basePath)}>
        <ArrowLeftIcon /> Mes formations
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "create" ? "Créer une formation" : "Modifier la formation"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez une formation claire et complète. Docbel la validera avant publication.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {i < step ? <CheckIcon className="size-3" /> : <span>{i + 1}</span>}
            {s}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{stepKey}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stepKey === "Général" && (
            <>
              <FieldRow label="Titre" required>
                <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex : Comprendre sa fiche de paie" />
              </FieldRow>
              <FieldRow label="Résumé court">
                <Textarea value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} rows={2} placeholder="Une phrase qui résume la formation" />
              </FieldRow>
              <FieldRow label="Description complète">
                <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={5} />
              </FieldRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Catégorie">
                  <select className={selectCls} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                    <option value="">— Choisir —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Niveau">
                  <select className={selectCls} value={f.level} onChange={(e) => set("level", e.target.value)}>
                    {TRAINING_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                  </select>
                </FieldRow>
              </div>
              <ObjectivesEditor objectives={f.objectives} onChange={(o) => set("objectives", o)} />
              <FieldRow label="Public cible">
                <Textarea value={f.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} rows={2} />
              </FieldRow>
              <FieldRow label="Prérequis">
                <Textarea value={f.prerequisites} onChange={(e) => set("prerequisites", e.target.value)} rows={2} />
              </FieldRow>
            </>
          )}

          {stepKey === "Format & orientation" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Format">
                  <select className={selectCls} value={f.format} onChange={(e) => set("format", e.target.value)}>
                    {TRAINING_FORMATS.map((x) => <option key={x} value={x}>{FORMAT_LABELS[x]}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Durée (heures)">
                  <Input type="number" min="0" value={f.durationHours} onChange={(e) => set("durationHours", e.target.value)} />
                </FieldRow>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Durée (libellé)">
                  <Input value={f.totalDurationLabel} onChange={(e) => set("totalDurationLabel", e.target.value)} placeholder="Ex : 2 jours" />
                </FieldRow>
                <FieldRow label="Rythme">
                  <Input value={f.rhythm} onChange={(e) => set("rhythm", e.target.value)} placeholder="Ex : 2 soirs/semaine" />
                </FieldRow>
              </div>
              <div>
                <Label className="mb-2 block">Tags d&apos;orientation & thématiques</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const on = f.tagSlugs.includes(t.slug);
                    return (
                      <button key={t.slug} type="button" onClick={() => toggleTag(t.slug)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Ces tags servent à recommander la formation après la Boussole.</p>
              </div>
              <FieldRow label="Mots-clés (séparés par des virgules)">
                <Input value={f.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="paie, salaire, onss" />
              </FieldRow>
            </>
          )}

          {stepKey === "Sessions" && (
            <SessionsEditor sessions={sessions} onChange={setSessions} />
          )}

          {stepKey === "Prix & attestation" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Tarification">
                  <select className={selectCls} value={f.priceType} onChange={(e) => set("priceType", e.target.value)}>
                    {PRICE_TYPES.map((p) => <option key={p} value={p}>{PRICE_TYPE_LABELS[p]}</option>)}
                  </select>
                </FieldRow>
                {f.priceType === "paid" && (
                  <FieldRow label="Prix">
                    <Input type="number" min="0" value={f.priceAmount} onChange={(e) => set("priceAmount", e.target.value)} placeholder="120" />
                  </FieldRow>
                )}
              </div>
              {f.priceType === "paid" && (
                <>
                  <FieldRow label="Lien de paiement externe">
                    <Input value={f.externalPaymentUrl} onChange={(e) => set("externalPaymentUrl", e.target.value)} placeholder="https://…" />
                  </FieldRow>
                  <FieldRow label="Informations de paiement">
                    <Textarea value={f.paymentInfo} onChange={(e) => set("paymentInfo", e.target.value)} rows={2} />
                  </FieldRow>
                  <p className="text-xs text-muted-foreground">Docbel n&apos;encaisse pas : le paiement se fait auprès de votre organisation.</p>
                </>
              )}
              <FieldRow label="Conditions d'annulation">
                <Textarea value={f.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} rows={2} />
              </FieldRow>
              <FieldRow label="Attestation">
                <select className={selectCls} value={f.certificateType} onChange={(e) => set("certificateType", e.target.value)}>
                  {CERTIFICATE_TYPES.map((c) => <option key={c} value={c}>{CERTIFICATE_LABELS[c]}</option>)}
                </select>
              </FieldRow>
              {f.certificateType !== "none" && (
                <FieldRow label="Description de l'attestation">
                  <Textarea value={f.certificateDescription} onChange={(e) => set("certificateDescription", e.target.value)} rows={2} />
                </FieldRow>
              )}
            </>
          )}

          {stepKey === "Contact & médias" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Nom du contact"><Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></FieldRow>
                <FieldRow label="Email du contact"><Input type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></FieldRow>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Téléphone"><Input value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></FieldRow>
                <FieldRow label="Site web"><Input value={f.contactWebsite} onChange={(e) => set("contactWebsite", e.target.value)} placeholder="https://…" /></FieldRow>
              </div>
              <FieldRow label="Image de couverture (URL)"><Input value={f.coverImageUrl} onChange={(e) => set("coverImageUrl", e.target.value)} placeholder="https://…" /></FieldRow>
              <FieldRow label="Lien externe (programme, infos)"><Input value={f.externalUrl} onChange={(e) => set("externalUrl", e.target.value)} placeholder="https://…" /></FieldRow>
            </>
          )}

          {stepKey === "Visibilité" && (
            <>
              <div className="space-y-2">
                <Label>Visibilité</Label>
                {allowedVisibilities.map((v) => (
                  <label key={v} className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
                    <input type="radio" name="visibility" checked={f.visibility === v} onChange={() => set("visibility", v)} className="mt-0.5" />
                    <span>
                      <span className="font-medium">{VISIBILITY_LABELS[v as TrainingVisibility] ?? v}</span>
                      <span className="block text-xs text-muted-foreground">{VIS_HELP[v] ?? ""}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{f.title || "Sans titre"}</p>
                <p className="text-xs text-muted-foreground">
                  {VISIBILITY_LABELS[f.visibility as TrainingVisibility] ?? f.visibility} ·{" "}
                  {f.priceType === "paid" ? `${f.priceAmount || "?"} €` : "Gratuit"} ·{" "}
                  {mode === "create" ? `${sessions.length} session(s)` : "Sessions gérées sur la fiche"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ArrowLeftIcon /> Précédent
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={busy}>
            Enregistrer le brouillon
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>
              Suivant <ArrowRightIcon />
            </Button>
          ) : (
            <Button onClick={() => save(true)} disabled={busy}>
              Soumettre à validation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const VIS_HELP: Record<string, string> = {
  public: "Visible dans le catalogue public après validation.",
  unlisted: "Accessible uniquement par lien, non listée.",
  private: "Réservée à des personnes/organisations autorisées.",
  internal: "Réservée aux membres de votre organisation.",
  draft: "Brouillon — visible uniquement par votre équipe.",
};

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function ObjectivesEditor({ objectives, onChange }: { objectives: string[]; onChange: (o: string[]) => void }) {
  const list = objectives.length ? objectives : [""];
  return (
    <div className="space-y-1.5">
      <Label>Objectifs</Label>
      {list.map((o, i) => (
        <div key={i} className="flex gap-2">
          <Input value={o} onChange={(e) => { const next = [...list]; next[i] = e.target.value; onChange(next.filter((_, idx) => idx <= i || next[idx])); }} placeholder={`Objectif ${i + 1}`} />
          <Button variant="ghost" size="icon" type="button" onClick={() => onChange(list.filter((_, idx) => idx !== i))}>
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" type="button" onClick={() => onChange([...list, ""])}>
        <PlusIcon /> Ajouter un objectif
      </Button>
    </div>
  );
}

function SessionsEditor({ sessions, onChange }: { sessions: SessionDraft[]; onChange: (s: SessionDraft[]) => void }) {
  function add() {
    onChange([...sessions, { title: "", mode: "online", startsAt: "", endsAt: "", city: "", region: "", onlineUrl: "", capacity: "", waitlistEnabled: false, registrationDeadline: "", requiresManualApproval: true }]);
  }
  function upd(i: number, patch: Partial<SessionDraft>) {
    onChange(sessions.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Ajoutez une ou plusieurs sessions (dates concrètes). Vous pourrez en ajouter d&apos;autres plus tard.</p>
      {sessions.map((s, i) => (
        <Card key={i} className="border-dashed">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Session {i + 1}</span>
              <Button variant="ghost" size="icon" type="button" onClick={() => onChange(sessions.filter((_, idx) => idx !== i))}>
                <Trash2Icon className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label className="text-xs">Mode</Label>
                <select className={selectCls} value={s.mode} onChange={(e) => upd(i, { mode: e.target.value })}>
                  {SESSION_MODES.map((m) => <option key={m} value={m}>{SESSION_MODE_LABELS[m]}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Capacité</Label>
                <Input type="number" min="1" value={s.capacity} onChange={(e) => upd(i, { capacity: e.target.value })} />
              </div>
              <div className="space-y-1"><Label className="text-xs">Début</Label>
                <Input type="datetime-local" value={s.startsAt} onChange={(e) => upd(i, { startsAt: e.target.value })} />
              </div>
              <div className="space-y-1"><Label className="text-xs">Fin</Label>
                <Input type="datetime-local" value={s.endsAt} onChange={(e) => upd(i, { endsAt: e.target.value })} />
              </div>
              {s.mode !== "online" && (
                <div className="space-y-1"><Label className="text-xs">Ville</Label>
                  <Input value={s.city} onChange={(e) => upd(i, { city: e.target.value })} />
                </div>
              )}
              {s.mode !== "onsite" && (
                <div className="space-y-1"><Label className="text-xs">Lien visio</Label>
                  <Input value={s.onlineUrl} onChange={(e) => upd(i, { onlineUrl: e.target.value })} placeholder="https://…" />
                </div>
              )}
              <div className="space-y-1"><Label className="text-xs">Date limite d&apos;inscription</Label>
                <Input type="datetime-local" value={s.registrationDeadline} onChange={(e) => upd(i, { registrationDeadline: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.waitlistEnabled} onChange={(e) => upd(i, { waitlistEnabled: e.target.checked })} /> Liste d&apos;attente</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.requiresManualApproval} onChange={(e) => upd(i, { requiresManualApproval: e.target.checked })} /> Validation manuelle</label>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" size="sm" type="button" onClick={add}>
        <PlusIcon /> Ajouter une session
      </Button>
    </div>
  );
}
