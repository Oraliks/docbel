"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Eraser,
  Loader2,
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
import { Textarea } from "@/components/ui/textarea";
import {
  AppointmentParseError,
  appointmentsFilename,
  parseAppointments,
  type Appointment,
} from "@/lib/rendez-vous/ics";

const PLACEHOLDER = `Appointments for 09/06/2026

08:20 – 08:40
4 Appointments:
Patrick Jyambere
Sevil Sarıgöz
Ajazi Indrit
Mohammadi Mohammad yasin`;

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

export function RendezVousExportClient() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    filename: string;
    count: number;
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
    },
    [],
  );

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

  const handleClear = useCallback(() => {
    setContent("");
    setSubmitError(null);
    setSuccess(null);
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <CalendarClock className="size-5 text-primary" />
          Rendez-vous → Outlook (.ics)
        </h1>
        <p className="text-sm text-muted-foreground">
          Collez la liste de rendez-vous telle qu&apos;exportée (format FGTB).
          Chaque personne devient un événement dans un fichier{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.ics</code>{" "}
          importable dans Outlook, Google Agenda ou Apple Calendrier. Fuseau{" "}
          <strong>Europe/Bruxelles</strong>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Coller les rendez-vous</CardTitle>
          <CardDescription>
            Collez le texte tel quel — pas besoin de reformater quoi que ce soit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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

      {preview.kind === "ok" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />
              Aperçu — {preview.filename}
            </CardTitle>
            <CardDescription>
              {preview.count} événement{preview.count > 1 ? "s" : ""} •{" "}
              {preview.groups.length} créneau
              {preview.groups.length > 1 ? "x" : ""} • fuseau Europe/Bruxelles
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
                  {group.names.map((name, nameIndex) => (
                    <li
                      key={nameIndex}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
