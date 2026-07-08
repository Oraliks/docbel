"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Locale } from "@/lib/pdf-forms/types";

interface SettingsForm {
  /// Id DB du formulaire en édition — sert au pré-check publicPath pour
  /// s'exclure du test de collision (le PdfForm n'entre pas en collision
  /// avec lui-même quand publicPath est déjà posé).
  id: string;
  title: string;
  description: string | null;
  issuer: string | null;
  organismeId: string | null;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
  /// URL publique stable (SEO), ex. "onem/c1". Vide = pas d'URL dédiée
  /// (accessible par slug interne seulement). Cf. Phase 3 du plan bindings.
  publicPath?: string | null;
}

/// État du pré-check publicPath : idle (pas encore vérifié), checking
/// (fetch en cours), available (✓), taken (✗ avec conflit), invalid
/// (input mal formé).
type PathCheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken"; takenBy: { slug: string; title: string } }
  | { kind: "invalid"; message: string };

interface OrganismeOption {
  id: string;
  name: string;
  shortName: string | null;
  color: string;
}

export function FormSettings({
  form,
  onChange,
}: {
  form: SettingsForm;
  onChange: (p: Partial<SettingsForm>) => void;
}) {
  const t = useTranslations("admin.pdf");
  const [organismes, setOrganismes] = useState<OrganismeOption[]>([]);
  const [pathCheck, setPathCheck] = useState<PathCheckState>({ kind: "idle" });
  const pathCheckSeq = useRef(0);

  // Pré-check publicPath : debounced fetch qui vérifie l'unicité de la
  // valeur candidate côté serveur avant le save (évite le 409 « unique
  // constraint violation »). Chaque saisie incrémente un compteur — si
  // une réponse plus ancienne arrive après une saisie plus récente, on
  // l'ignore (protection anti-race).
  //
  // Fenêtre de debounce : 400 ms — assez long pour ne pas spammer le
  // serveur pendant que l'admin tape « onem/c1-changement-situation »,
  // assez court pour donner un feedback immédiat.
  useEffect(() => {
    const raw = (form.publicPath ?? "").trim().toLowerCase();
    const normalized = raw.replace(/^\/+|\/+$/g, "");
    if (!normalized) {
      setPathCheck({ kind: "idle" });
      return;
    }
    // Validation locale : seuls a-z, 0-9, tirets et slashes internes acceptés.
    // Le serveur normalise aussi, mais un feedback immédiat aide l'admin
    // à corriger sans aller-retour réseau.
    if (!/^[a-z0-9/-]+$/.test(normalized)) {
      setPathCheck({
        kind: "invalid",
        message: t("publicPathInvalidChars"),
      });
      return;
    }

    const seq = ++pathCheckSeq.current;
    setPathCheck({ kind: "checking" });
    const timer = setTimeout(() => {
      const url = `/api/admin/pdf/publicpath-available?path=${encodeURIComponent(normalized)}&excludeId=${encodeURIComponent(form.id)}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          // Réponse obsolète — une saisie plus récente a démarré. On la
          // laisse tomber pour éviter le clignotement ✓/✗.
          if (seq !== pathCheckSeq.current) return;
          if (!data) {
            setPathCheck({ kind: "idle" });
            return;
          }
          if (data.available) setPathCheck({ kind: "available" });
          else setPathCheck({ kind: "taken", takenBy: data.taken_by });
        })
        .catch(() => {
          if (seq !== pathCheckSeq.current) return;
          // Fail-soft : sur erreur réseau on n'affiche rien plutôt qu'un
          // faux positif — le save côté serveur reste le garde-fou final.
          setPathCheck({ kind: "idle" });
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [form.publicPath, form.id, t]);

  // Charge la liste des organismes pour le sélecteur. Fail-soft : si l'API
  // n'est pas dispo, on laisse l'admin saisir un issuer libre.
  useEffect(() => {
    let active = true;
    fetch("/api/documents/organismes")
      .then((r) => (r.ok ? r.json() : []))
      .then((j: unknown) => {
        if (!active) return;
        const arr = Array.isArray(j) ? (j as OrganismeOption[]) : [];
        setOrganismes(arr.filter((o) => o && o.id && o.name));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function toggleLocale(l: Locale) {
    if (l === "fr") return;
    const next = form.locales.includes(l) ? form.locales.filter((x) => x !== l) : [...form.locales, l];
    onChange({ locales: next });
  }

  return (
    <Card>
      <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("titleLabel")}</Label>
          <Input value={form.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("issuerLabel")}</Label>
          {organismes.length > 0 ? (
            <Select
              value={form.organismeId ?? "__none__"}
              onValueChange={(v) => {
                const id = v === "__none__" ? null : v;
                const org = organismes.find((o) => o.id === id);
                onChange({
                  organismeId: id,
                  // Garde aussi `issuer` en miroir (compat fallback historique).
                  issuer: org ? org.shortName ?? org.name : null,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("noneDashed")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("noneDashed")}</SelectItem>
                {organismes.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.shortName ? `${o.shortName} — ${o.name}` : o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={form.issuer ?? ""}
              placeholder={t("issuerFreePlaceholder")}
              onChange={(e) => onChange({ issuer: e.target.value || null })}
            />
          )}
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{t("descriptionLabel")}</Label>
          <Textarea rows={2} value={form.description ?? ""} onChange={(e) => onChange({ description: e.target.value || null })} />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{t("publicPathLabel")}</Label>
          <Input
            value={form.publicPath ?? ""}
            placeholder={t("publicPathPlaceholder")}
            onChange={(e) => {
              // Normalise : trim, lowercase, retire les slashes de bord.
              const raw = e.target.value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
              onChange({ publicPath: raw || null });
            }}
          />
          <PublicPathStatus state={pathCheck} t={t} />
          <p className="text-[11px] text-muted-foreground">{t("publicPathHelp")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("availableLocales")}</Label>
          <div className="flex gap-3">
            {(["fr", "nl", "de"] as Locale[]).map((l) => (
              <label key={l} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={form.locales.includes(l)} disabled={l === "fr"} onCheckedChange={() => toggleLocale(l)} />
                <span className="uppercase">{l}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">{t("deliveryModes")}</Label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t("deliveryDownload")}
            <Switch checked={form.allowDownload} onCheckedChange={(c) => onChange({ allowDownload: c })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t("deliveryDoccle")}
            <Switch checked={form.allowDoccle} onCheckedChange={(c) => onChange({ allowDoccle: c })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t("prefillItsme")}
            <Switch checked={form.allowItsme} onCheckedChange={(c) => onChange({ allowItsme: c })} />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

/// Feedback inline sous l'input publicPath : icône + libellé selon l'état
/// du pré-check (checking / available / taken / invalid). En idle, rien
/// n'est rendu — l'aide statique en dessous fait le job.
function PublicPathStatus({
  state,
  t,
}: {
  state: PathCheckState;
  t: ReturnType<typeof useTranslations>;
}) {
  if (state.kind === "idle") return null;
  if (state.kind === "checking") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" /> {t("publicPathChecking")}
      </span>
    );
  }
  if (state.kind === "invalid") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
        <AlertTriangleIcon className="size-3" /> {state.message}
      </span>
    );
  }
  if (state.kind === "available") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
        <CheckCircle2Icon className="size-3" /> {t("publicPathAvailable")}
      </span>
    );
  }
  // taken
  return (
    <span className="flex items-center gap-1 text-[11px] text-destructive">
      <AlertTriangleIcon className="size-3" />
      {t("publicPathTakenBy", {
        title: state.takenBy.title,
        slug: state.takenBy.slug,
      })}
    </span>
  );
}
