"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Eraser,
  FileSpreadsheet,
  History,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AppointmentParseError,
  appointmentsFilename,
  parseAppointments,
  type Appointment,
} from "@/lib/rendez-vous/ics";
import { buildPlannings, planningsFilename } from "@/lib/rendez-vous/planning";
import { renderPlanningPdf } from "@/lib/rendez-vous/planning-pdf";
import {
  formatDateKey,
  normalizeName,
  type DuplicateEntry,
} from "@/lib/rendez-vous/history";

const PLACEHOLDER = `Appointments for 09/06/2026

08:20 – 08:40
3 Appointments:
Patrick Jyambere
Sevil Sarıgöz
Ajazi Indrit

Appointments for 10/06/2026

09:00 – 09:20
2 Appointments:
Julie Dupont
Mohammad Yasin`;

type SlotGroup = { label: string; dateLabel: string; names: string[] };

type Preview =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      count: number;
      filename: string;
      groups: SlotGroup[];
    };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function hhmm(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function dateLabel(d: Date): string {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Regroupe les rendez-vous consécutifs partageant le même créneau. */
function buildGroups(appointments: Appointment[]): SlotGroup[] {
  const groups: SlotGroup[] = [];
  let key = "";
  for (const appt of appointments) {
    const groupKey = `${dateLabel(appt.start)} ${hhmm(appt.start)}-${hhmm(appt.end)}`;
    if (groupKey !== key) {
      groups.push({
        label: `${hhmm(appt.start)} – ${hhmm(appt.end)}`,
        dateLabel: dateLabel(appt.start),
        names: [],
      });
      key = groupKey;
    }
    groups[groups.length - 1].names.push(appt.name);
  }
  return groups;
}

/** Déclenche le téléchargement d'un blob sous le nom donné. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type RendezVousExportClientProps = {
  isAdmin?: boolean;
  partnerOrganization?: string | null;
  orgOptions?: string[];
  canViewHistory?: boolean;
};

export function RendezVousExportClient({
  isAdmin = false,
  partnerOrganization = null,
  orgOptions = [],
  canViewHistory = false,
}: RendezVousExportClientProps = {}) {
  // Organisation cible (admins uniquement) : détermine le périmètre partagé de
  // l'historique. Un partenaire utilise toujours la sienne, côté serveur.
  const [org, setOrg] = useState<string>(isAdmin ? "" : (partnerOrganization ?? ""));
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    filename: string;
    count: number;
  } | null>(null);

  // Détection de doublons (historique partagé du service).
  const [duplicates, setDuplicates] = useState<DuplicateEntry[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveInfo, setSaveInfo] = useState<{
    saved: number;
    total: number;
  } | null>(null);

  // Aperçu live : on réutilise le MÊME parseur que le serveur (module pur).
  const preview = useMemo<Preview>(() => {
    if (content.trim() === "") return { kind: "empty" };
    try {
      const appointments = parseAppointments(content);
      return {
        kind: "ok",
        count: appointments.length,
        filename: appointmentsFilename(appointments),
        groups: buildGroups(appointments),
      };
    } catch (err) {
      if (err instanceof AppointmentParseError) {
        return { kind: "error", message: err.message };
      }
      return { kind: "error", message: "Texte illisible." };
    }
  }, [content]);

  const canGenerate = preview.kind === "ok" && !loading;

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setContent(event.target.value);
      setSubmitError(null);
      setSuccess(null);
      setSaveInfo(null);
      // Le contenu change → les doublons connus ne sont plus à jour.
      setDuplicates(null);
    },
    [],
  );

  // Un admin doit avoir choisi une organisation pour cibler le bon historique.
  const scopeReady = !isAdmin || org !== "";

  // Interroge l'historique du service pour repérer les doublons. Lecture seule.
  const runCheck = useCallback(
    async (signal?: AbortSignal) => {
      if (!scopeReady) {
        setDuplicates(null);
        return;
      }
      setChecking(true);
      try {
        const res = await fetch("/api/rendez-vous/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", content, org }),
          signal,
        });
        if (!res.ok) {
          setDuplicates(null);
          return;
        }
        const data = (await res.json()) as { duplicates?: DuplicateEntry[] };
        setDuplicates(data.duplicates ?? []);
      } catch {
        if (!signal?.aborted) setDuplicates(null);
      } finally {
        if (!signal?.aborted) setChecking(false);
      }
    },
    [content, org, scopeReady],
  );

  // Vérification automatique (anti-rebond) dès que l'aperçu est valide.
  useEffect(() => {
    if (preview.kind !== "ok") return;
    const controller = new AbortController();
    const timer = setTimeout(() => void runCheck(controller.signal), 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [preview.kind, runCheck]);

  const handleSave = useCallback(async () => {
    setSubmitError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/rendez-vous/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", content, org }),
      });
      const data = (await res.json().catch(() => null)) as {
        saved?: number;
        total?: number;
        error?: string;
      } | null;
      if (!res.ok) {
        setSubmitError(data?.error ?? "Enregistrement impossible.");
        return;
      }
      setSaveInfo({ saved: data?.saved ?? 0, total: data?.total ?? 0 });
      await runCheck();
    } catch {
      setSubmitError("Erreur réseau lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }, [content, org, runCheck]);

  // Index normalisé → doublon, pour annoter chaque nom de l'aperçu.
  const dupMap = useMemo(() => {
    const map = new Map<string, DuplicateEntry>();
    for (const entry of duplicates ?? []) map.set(entry.normalized, entry);
    return map;
  }, [duplicates]);

  const duplicateCount = duplicates?.length ?? 0;

  // Référence « aujourd'hui » (date locale = Bruxelles côté utilisateur) pour
  // distinguer les RDV passés (info) des RDV à venir (alerte) dans les doublons.
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const handleGenerate = useCallback(async () => {
    setSubmitError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/export-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("text/calendar")) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setSubmitError(data?.error ?? "La génération a échoué. Réessayez.");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? "rendez-vous.ics";
      const count = Number(res.headers.get("x-appointment-count") ?? "0");

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setSuccess({ filename, count });
    } catch {
      setSubmitError("Erreur réseau. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  }, [content]);

  const handlePlanning = useCallback(async () => {
    setSubmitError(null);
    setSuccess(null);
    setPlanningLoading(true);
    try {
      const appointments = parseAppointments(content);
      const plannings = buildPlannings(appointments);
      const blob = await renderPlanningPdf(plannings);
      triggerDownload(blob, planningsFilename(plannings));
    } catch (err) {
      if (err instanceof AppointmentParseError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("La génération du planning a échoué. Réessayez.");
      }
    } finally {
      setPlanningLoading(false);
    }
  }, [content]);

  const handleClear = useCallback(() => {
    setContent("");
    setSubmitError(null);
    setSuccess(null);
    setSaveInfo(null);
    setDuplicates(null);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key === "Enter" &&
        canGenerate
      ) {
        event.preventDefault();
        void handleGenerate();
      }
    },
    [canGenerate, handleGenerate],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <CalendarClock className="size-5 text-primary" />
          Rendez-vous → Outlook (.ics)
        </h1>
        <p className="text-sm text-muted-foreground">
          Collez la liste de rendez-vous telle qu&apos;exportée (format FGTB).
          Chaque personne devient un événement dans un fichier{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.ics</code>{" "}
          importable dans Outlook, Google Agenda ou Apple Calendrier (fuseau{" "}
          <strong>Europe/Bruxelles</strong>). Vous pouvez aussi générer le{" "}
          <strong>planning des shifts en PDF</strong> : le jour est déduit
          automatiquement de la date et chaque jour a sa couleur. Les{" "}
          <strong>doublons</strong> (personnes ayant déjà un rendez-vous) sont
          détectés automatiquement et signalés.
        </p>
        {canViewHistory ? (
          <Link
            href="/partenaire/outils/fgtb-planning/historique"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <History className="size-4" />
            Consulter l&apos;historique des rendez-vous
          </Link>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Coller les rendez-vous</CardTitle>
          <CardDescription>
            Collez le texte tel quel — pas besoin de reformater quoi que ce soit.
            Vous pouvez coller <strong>plusieurs journées d&apos;un coup</strong> :
            chaque jour est enregistré séparément et obtient sa page de planning.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isAdmin ? (
            <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-3">
              <Label htmlFor="rdv-org" className="text-xs font-medium">
                Organisation (historique partagé)
              </Label>
              <Select value={org} onValueChange={(v) => setOrg(v ?? "")}>
                <SelectTrigger id="rdv-org" className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Choisir une organisation…" />
                </SelectTrigger>
                <SelectContent>
                  {orgOptions.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Aucune organisation
                    </SelectItem>
                  ) : (
                    orgOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                En tant qu&apos;admin, choisissez le service dont vous gérez les
                rendez-vous : la détection des doublons et l&apos;enregistrement
                porteront sur son historique partagé.
              </p>
            </div>
          ) : null}
          <Label htmlFor="rdv-input" className="sr-only">
            Liste des rendez-vous
          </Label>
          <Textarea
            id="rdv-input"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            autoFocus
            aria-invalid={preview.kind === "error"}
            className="min-h-[260px] resize-y font-mono text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              {loading ? <Loader2 className="animate-spin" /> : <Download />}
              Générer le fichier Outlook
            </Button>
            <Button
              variant="outline"
              onClick={handlePlanning}
              disabled={preview.kind !== "ok" || planningLoading}
            >
              {planningLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FileSpreadsheet />
              )}
              Générer le planning (PDF)
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={preview.kind !== "ok" || saving || !scopeReady}
              title="Mémoriser ces rendez-vous pour détecter les doublons à l'avenir"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Enregistrer dans l&apos;historique
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={loading || content === ""}
            >
              <Eraser />
              Effacer
            </Button>
            {preview.kind === "ok" ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-primary" />
                {preview.count} rendez-vous détecté
                {preview.count > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Astuce : <kbd className="rounded border px-1">Ctrl</kbd>/
            <kbd className="rounded border px-1">⌘</kbd> +{" "}
            <kbd className="rounded border px-1">Entrée</kbd> pour générer.
          </p>
          <p className="text-xs text-muted-foreground">
            Vous pouvez coller votre <strong>liste d&apos;attente</strong> (RDV à
            approuver) juste pour vérifier les doublons : rien n&apos;est
            enregistré tant que vous ne cliquez pas sur «&nbsp;Enregistrer dans
            l&apos;historique&nbsp;».
          </p>
        </CardContent>
      </Card>

      {submitError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Impossible de générer le fichier</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      {!submitError && preview.kind === "error" ? (
        <Alert>
          <AlertTriangle className="text-amber-600" />
          <AlertTitle>Vérifiez le texte collé</AlertTitle>
          <AlertDescription>{preview.message}</AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert>
          <CheckCircle2 className="text-emerald-600" />
          <AlertTitle>Fichier téléchargé</AlertTitle>
          <AlertDescription>
            {success.filename} — {success.count} événement
            {success.count > 1 ? "s" : ""} prêt
            {success.count > 1 ? "s" : ""} à importer dans votre agenda.
          </AlertDescription>
        </Alert>
      ) : null}

      {saveInfo ? (
        <Alert>
          <Save className="text-emerald-600" />
          <AlertTitle>Enregistré dans l&apos;historique</AlertTitle>
          <AlertDescription>
            {saveInfo.saved > 0
              ? `${saveInfo.saved} rendez-vous ajouté${saveInfo.saved > 1 ? "s" : ""} à l'historique du service.`
              : "Ces rendez-vous étaient déjà enregistrés — rien à ajouter."}
          </AlertDescription>
        </Alert>
      ) : null}

      {preview.kind === "ok" && duplicateCount > 0 ? (
        <Alert>
          <History className="text-amber-600" />
          <AlertTitle>
            {duplicateCount} doublon{duplicateCount > 1 ? "s" : ""} potentiel
            {duplicateCount > 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription>
            Certaines personnes ont un rendez-vous à venir, en ont déjà eu un,
            ou apparaissent plusieurs fois dans cette liste. Les RDV à venir sont
            en orange (à vérifier avant d&apos;approuver), les RDV passés en gris
            (simple info).
          </AlertDescription>
        </Alert>
      ) : null}

      {preview.kind === "ok" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />
              Aperçu — {preview.filename}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-1">
              {preview.count} événement{preview.count > 1 ? "s" : ""} •{" "}
              {preview.groups.length} créneau
              {preview.groups.length > 1 ? "x" : ""} • fuseau Europe/Bruxelles
              {checking ? (
                <span className="ml-1 inline-flex items-center gap-1 text-xs">
                  <Loader2 className="size-3 animate-spin" />
                  vérification des doublons…
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {preview.groups.map((group, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.dateLabel}
                  </span>
                </div>
                <ul className="flex flex-col gap-1 pl-1">
                  {group.names.map((name, nameIndex) => {
                    const dup = dupMap.get(normalizeName(name));
                    const hist = dup?.history ?? [];
                    // RDV à venir (≥ aujourd'hui) = alerte ; RDV passé = info grise.
                    const nextUp = hist
                      .filter((h) => h.date >= todayKey)
                      .sort((a, b) =>
                        a.date === b.date
                          ? a.startTime.localeCompare(b.startTime)
                          : a.date.localeCompare(b.date),
                      )[0];
                    const lastPast = hist
                      .filter((h) => h.date < todayKey)
                      .sort((a, b) =>
                        a.date === b.date
                          ? b.startTime.localeCompare(a.startTime)
                          : b.date.localeCompare(a.date),
                      )[0];
                    const inListDup = (dup?.inListCount ?? 0) > 1;
                    const isAlert = !!nextUp || inListDup;
                    const more = hist.length > 1 ? ` (+${hist.length - 1})` : "";
                    return (
                      <li
                        key={nameIndex}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <span
                          className={
                            isAlert
                              ? "size-1.5 rounded-full bg-amber-500"
                              : lastPast
                                ? "size-1.5 rounded-full bg-muted-foreground/60"
                                : "size-1.5 rounded-full bg-muted-foreground/40"
                          }
                        />
                        <span className={dup ? "font-medium" : undefined}>
                          {name}
                        </span>
                        {nextUp ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <History className="size-3" />
                            RDV à venir le {formatDateKey(nextUp.date)} à{" "}
                            {nextUp.startTime}
                            {more}
                          </span>
                        ) : inListDup ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <AlertTriangle className="size-3" />×{" "}
                            {dup?.inListCount} dans cette liste
                          </span>
                        ) : lastPast ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            <History className="size-3" />
                            Déjà eu un RDV le {formatDateKey(lastPast.date)}
                            {more}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
