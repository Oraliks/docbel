"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Settings2,
  Globe,
  Search,
  Wrench,
  Megaphone,
  Save,
  RotateCcw,
  Loader2,
  Link2,
  Mail,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SiteSettings,
  SiteIdentity,
  AnnouncementLevel,
  AudienceSegment,
} from "@/lib/site-settings";

const LEVELS: { value: AnnouncementLevel; label: string }[] = [
  { value: "info", label: "Information (bleu)" },
  { value: "success", label: "Succès (vert)" },
  { value: "warning", label: "Avertissement (ambre)" },
  { value: "critical", label: "Critique (rouge)" },
];

const SEGMENTS: { value: AudienceSegment; label: string }[] = [
  { value: "public", label: "Visiteurs (public)" },
  { value: "citizen", label: "Citoyens" },
  { value: "partner", label: "Partenaires" },
  { value: "employer", label: "Employeurs" },
];

type Props = {
  initialSettings: SiteSettings;
  updatedAt: string | null;
  updatedByName: string | null;
};

export function ParametresClient({
  initialSettings,
  updatedAt,
  updatedByName,
}: Props) {
  const [base, setBase] = useState<SiteSettings>(initialSettings);
  const [draft, setDraft] = useState<SiteSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{ at: string | null; by: string | null }>({
    at: updatedAt,
    by: updatedByName,
  });

  const dirty = useMemo(
    () => JSON.stringify(base) !== JSON.stringify(draft),
    [base, draft],
  );

  // ---- updaters immuables par section -------------------------------------
  const updIdentity = (p: Partial<SiteIdentity>) =>
    setDraft((d) => ({ ...d, identity: { ...d.identity, ...p } }));
  const updSocials = (p: Partial<SiteIdentity["socials"]>) =>
    setDraft((d) => ({
      ...d,
      identity: { ...d.identity, socials: { ...d.identity.socials, ...p } },
    }));
  const updSeo = (p: Partial<SiteSettings["seo"]>) =>
    setDraft((d) => ({ ...d, seo: { ...d.seo, ...p } }));
  const updVerif = (p: Partial<SiteSettings["seo"]["verification"]>) =>
    setDraft((d) => ({
      ...d,
      seo: { ...d.seo, verification: { ...d.seo.verification, ...p } },
    }));
  const updMaint = (p: Partial<SiteSettings["maintenance"]>) =>
    setDraft((d) => ({ ...d, maintenance: { ...d.maintenance, ...p } }));
  const updAnn = (p: Partial<SiteSettings["announcement"]>) =>
    setDraft((d) => ({ ...d, announcement: { ...d.announcement, ...p } }));

  const toggleSegment = (seg: AudienceSegment) =>
    setDraft((d) => {
      const has = d.announcement.segments.includes(seg);
      return {
        ...d,
        announcement: {
          ...d.announcement,
          segments: has
            ? d.announcement.segments.filter((s) => s !== seg)
            : [...d.announcement.segments, seg],
        },
      };
    });

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Échec de l'enregistrement");
      }
      const saved = data.settings as SiteSettings;
      setBase(saved);
      setDraft(saved);
      setMeta({ at: new Date().toISOString(), by: meta.by ?? "vous" });
      toast.success("Paramètres enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(base);
  }

  const metaLine =
    meta.at != null
      ? `Modifié ${meta.by ? `par ${meta.by} ` : ""}le ${new Date(
          meta.at,
        ).toLocaleString("fr-BE", { dateStyle: "long", timeStyle: "short" })}`
      : "Aucune modification enregistrée pour l'instant (valeurs par défaut).";

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6 pb-24">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Settings2 className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Paramètres du site
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{metaLine}</p>
          </div>
        </div>
        {draft.maintenance.enabled && (
          <Badge variant="warning" className="gap-1">
            <Wrench className="size-3" /> Maintenance active
          </Badge>
        )}
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Globe className="size-4" /> Général
          </TabsTrigger>
          <TabsTrigger value="seo">
            <Search className="size-4" /> SEO &amp; partage
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Megaphone className="size-4" /> Maintenance &amp; annonces
          </TabsTrigger>
        </TabsList>

        {/* ---------------- GÉNÉRAL ---------------- */}
        <TabsContent value="general" className="mt-4 flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-4 text-primary" /> Identité
              </CardTitle>
              <CardDescription>
                Nom, slogan et adresse du site. Repris dans l'onglet du
                navigateur, le référencement, l'en-tête et les emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Field label="Nom du site" htmlFor="site-name">
                <Input
                  id="site-name"
                  value={draft.identity.name}
                  maxLength={120}
                  onChange={(e) => updIdentity({ name: e.target.value })}
                />
              </Field>
              <Field
                label="Slogan"
                htmlFor="site-tagline"
                hint="Courte phrase de présentation."
              >
                <Input
                  id="site-tagline"
                  value={draft.identity.tagline}
                  maxLength={200}
                  onChange={(e) => updIdentity({ tagline: e.target.value })}
                />
              </Field>
              <Field
                label="URL canonique"
                htmlFor="site-url"
                hint="Adresse publique complète, ex. https://docbel.be. Sert de base aux liens de partage et au référencement."
              >
                <Input
                  id="site-url"
                  type="url"
                  placeholder="https://docbel.be"
                  value={draft.identity.url}
                  onChange={(e) => updIdentity({ url: e.target.value })}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Email de contact" htmlFor="site-email" icon={Mail}>
                  <Input
                    id="site-email"
                    type="email"
                    value={draft.identity.contactEmail}
                    onChange={(e) => updIdentity({ contactEmail: e.target.value })}
                  />
                </Field>
                <Field label="Téléphone" htmlFor="site-phone" icon={Phone}>
                  <Input
                    id="site-phone"
                    value={draft.identity.contactPhone}
                    onChange={(e) => updIdentity({ contactPhone: e.target.value })}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-primary" /> Réseaux sociaux
              </CardTitle>
              <CardDescription>
                Liens affichés dans le pied de page. Laisser vide pour masquer.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Facebook" htmlFor="s-fb">
                <Input
                  id="s-fb"
                  type="url"
                  placeholder="https://facebook.com/…"
                  value={draft.identity.socials.facebook}
                  onChange={(e) => updSocials({ facebook: e.target.value })}
                />
              </Field>
              <Field label="LinkedIn" htmlFor="s-li">
                <Input
                  id="s-li"
                  type="url"
                  placeholder="https://linkedin.com/…"
                  value={draft.identity.socials.linkedin}
                  onChange={(e) => updSocials({ linkedin: e.target.value })}
                />
              </Field>
              <Field label="Instagram" htmlFor="s-ig">
                <Input
                  id="s-ig"
                  type="url"
                  placeholder="https://instagram.com/…"
                  value={draft.identity.socials.instagram}
                  onChange={(e) => updSocials({ instagram: e.target.value })}
                />
              </Field>
              <Field label="X (Twitter)" htmlFor="s-x">
                <Input
                  id="s-x"
                  type="url"
                  placeholder="https://x.com/…"
                  value={draft.identity.socials.x}
                  onChange={(e) => updSocials({ x: e.target.value })}
                />
              </Field>
              <Field label="YouTube" htmlFor="s-yt">
                <Input
                  id="s-yt"
                  type="url"
                  placeholder="https://youtube.com/…"
                  value={draft.identity.socials.youtube}
                  onChange={(e) => updSocials({ youtube: e.target.value })}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- SEO ---------------- */}
        <TabsContent value="seo" className="mt-4 flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-primary" /> Référencement &amp; partage
              </CardTitle>
              <CardDescription>
                Titre, description et image utilisés par Google et les réseaux
                sociaux.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Field
                label="Modèle de titre"
                htmlFor="seo-title"
                hint="« %s » est remplacé par le titre de la page. Ex. « %s — Docbel »."
              >
                <Input
                  id="seo-title"
                  value={draft.seo.titleTemplate}
                  onChange={(e) => updSeo({ titleTemplate: e.target.value })}
                />
              </Field>
              <Field label="Description par défaut" htmlFor="seo-desc">
                <Textarea
                  id="seo-desc"
                  rows={3}
                  maxLength={500}
                  value={draft.seo.defaultDescription}
                  onChange={(e) =>
                    updSeo({ defaultDescription: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Image de partage (OG) par défaut"
                htmlFor="seo-og"
                hint="URL absolue ou chemin /public. Affichée lors du partage sur les réseaux."
              >
                <Input
                  id="seo-og"
                  placeholder="https://…/og.png"
                  value={draft.seo.ogImageUrl}
                  onChange={(e) => updSeo({ ogImageUrl: e.target.value })}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-primary" /> Indexation &amp; vérification
              </CardTitle>
              <CardDescription>
                Contrôle de la visibilité par les moteurs de recherche.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <ToggleRow
                label="Désindexer tout le site (noindex)"
                hint="À activer sur une préproduction. Demande aux moteurs de ne pas indexer le site. Réversible instantanément."
                checked={draft.seo.noindex}
                onChange={(v) => updSeo({ noindex: v })}
                danger
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Vérification Google"
                  htmlFor="v-google"
                  hint="Contenu de la balise google-site-verification."
                >
                  <Input
                    id="v-google"
                    value={draft.seo.verification.google}
                    onChange={(e) => updVerif({ google: e.target.value })}
                  />
                </Field>
                <Field label="Vérification Bing" htmlFor="v-bing">
                  <Input
                    id="v-bing"
                    value={draft.seo.verification.bing}
                    onChange={(e) => updVerif({ bing: e.target.value })}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- MAINTENANCE & ANNONCES ---------------- */}
        <TabsContent value="maintenance" className="mt-4 flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="size-4 text-primary" /> Mode maintenance
              </CardTitle>
              <CardDescription>
                Affiche une page de maintenance aux visiteurs. N'affecte jamais
                l'espace d'administration, la connexion ni l'API d'auth.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <ToggleRow
                label="Activer le mode maintenance"
                hint="Les pages publiques affichent le message ci-dessous."
                checked={draft.maintenance.enabled}
                onChange={(v) => updMaint({ enabled: v })}
                danger
              />
              <Field label="Message de maintenance" htmlFor="maint-msg">
                <Textarea
                  id="maint-msg"
                  rows={3}
                  maxLength={2000}
                  value={draft.maintenance.message}
                  onChange={(e) => updMaint({ message: e.target.value })}
                />
              </Field>
              <ToggleRow
                label="Laisser passer les administrateurs"
                hint="Un admin connecté continue de naviguer normalement pendant la maintenance."
                checked={draft.maintenance.allowAdminBypass}
                onChange={(v) => updMaint({ allowAdminBypass: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="size-4 text-primary" /> Bannière d'annonce
              </CardTitle>
              <CardDescription>
                Message affiché en haut des pages publiques (info, nouveauté,
                incident…).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <ToggleRow
                label="Afficher la bannière"
                checked={draft.announcement.enabled}
                onChange={(v) => updAnn({ enabled: v })}
              />
              <Field label="Message" htmlFor="ann-msg">
                <Textarea
                  id="ann-msg"
                  rows={2}
                  maxLength={2000}
                  value={draft.announcement.message}
                  onChange={(e) => updAnn({ message: e.target.value })}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Niveau" htmlFor="ann-level">
                  <Select
                    value={draft.announcement.level}
                    onValueChange={(v) =>
                      updAnn({ level: v as AnnouncementLevel })
                    }
                  >
                    <SelectTrigger id="ann-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Lien (libellé)" htmlFor="ann-link-label">
                    <Input
                      id="ann-link-label"
                      value={draft.announcement.linkLabel}
                      placeholder="En savoir plus"
                      onChange={(e) => updAnn({ linkLabel: e.target.value })}
                    />
                  </Field>
                  <Field label="Lien (URL)" htmlFor="ann-link-href">
                    <Input
                      id="ann-link-href"
                      value={draft.announcement.linkHref}
                      placeholder="/actualites/…"
                      onChange={(e) => updAnn({ linkHref: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Début (optionnel)"
                  htmlFor="ann-start"
                  hint="Avant cette date, la bannière reste masquée."
                >
                  <Input
                    id="ann-start"
                    type="datetime-local"
                    value={draft.announcement.startsAt}
                    onChange={(e) => updAnn({ startsAt: e.target.value })}
                  />
                </Field>
                <Field
                  label="Fin (optionnel)"
                  htmlFor="ann-end"
                  hint="Après cette date, la bannière disparaît automatiquement."
                >
                  <Input
                    id="ann-end"
                    type="datetime-local"
                    value={draft.announcement.endsAt}
                    onChange={(e) => updAnn({ endsAt: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">
                  Cibler des segments{" "}
                  <span className="font-normal text-muted-foreground">
                    (aucun sélectionné = tout le monde)
                  </span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {SEGMENTS.map((s) => {
                    const active = draft.announcement.segments.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggleSegment(s.value)}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Barre de sauvegarde collante */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
            <span className="text-sm text-muted-foreground">
              Modifications non enregistrées
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={reset} disabled={saving}>
                <RotateCcw className="size-4" /> Annuler
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants de présentation
// ---------------------------------------------------------------------------

function Field({
  label,
  htmlFor,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  danger,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
        checked && danger ? "border-amber-300 bg-amber-50/50" : ""
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <p className="text-xs text-muted-foreground max-w-xl">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
