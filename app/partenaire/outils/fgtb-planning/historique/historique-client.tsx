"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Eraser,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AppointmentParseError, parseAppointments } from "@/lib/rendez-vous/ics";
import { dateKey, formatDateKey, normalizeName } from "@/lib/rendez-vous/history";

type HistoryEntry = {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
};

/** Un RDV nominatif retourné par l'API après une mise à jour. */
type SyncedEntry = {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
};

/** Résultat d'une mise à jour (sync) d'une ou plusieurs journées. */
type UpdateResult = {
  removed: SyncedEntry[];
  added: SyncedEntry[];
  unchanged: number;
  days: number;
};

type Props = {
  isAdmin: boolean;
  defaultOrg: string | null;
  orgOptions: string[];
};

const MANAGE_URL = "/api/rendez-vous/history/manage";
const SYNC_URL = "/api/rendez-vous/history";

const UPDATE_PLACEHOLDER = `Appointments for 06/06/2026

08:20 – 08:40
2 Appointments:
Patrick Jyambere
Julie Dupont`;

/**
 * Reconstruit un collage texte (format FGTB) à partir des RDV enregistrés d'UNE
 * journée, pour le re-charger dans la zone de mise à jour et l'éditer. Le texte
 * produit est re-parsable à l'identique par `parseAppointments`.
 */
function reconstructDayPaste(dayEntries: HistoryEntry[]): string {
  if (dayEntries.length === 0) return "";
  const slots = new Map<
    string,
    { start: string; end: string; names: string[] }
  >();
  for (const e of dayEntries) {
    const key = `${e.startTime}-${e.endTime}`;
    const slot = slots.get(key) ?? {
      start: e.startTime,
      end: e.endTime,
      names: [],
    };
    slot.names.push(e.name);
    slots.set(key, slot);
  }
  const ordered = [...slots.values()].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const lines: string[] = [
    `Appointments for ${formatDateKey(dayEntries[0].date)}`,
    "",
  ];
  for (const slot of ordered) {
    lines.push(`${slot.start} – ${slot.end}`);
    for (const name of slot.names) lines.push(name);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function RdvHistoryClient({ isAdmin, defaultOrg, orgOptions }: Props) {
  const t = useTranslations("public.pro");
  const [org, setOrg] = useState<string>(isAdmin ? "" : (defaultOrg ?? ""));
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const confirm = useConfirm();

  // État de l'onglet « Mise à jour ».
  const [updateContent, setUpdateContent] = useState("");
  const [applying, setApplying] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateRef = useRef<HTMLTextAreaElement>(null);

  // Un partenaire a un périmètre fixe ; un admin doit choisir une organisation.
  const ready = org !== "";

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ready) return;
      setLoading(true);
      try {
        const res = await fetch(MANAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list",
            org: isAdmin ? org : undefined,
          }),
          signal,
        });
        const data = (await res.json().catch(() => null)) as {
          entries?: HistoryEntry[];
          error?: string;
        } | null;
        if (!res.ok) {
          toast.error(data?.error ?? t("rdvLoadFailed"));
          setEntries([]);
          return;
        }
        setEntries(data?.entries ?? []);
        setLoaded(true);
      } catch {
        if (!signal?.aborted) toast.error(t("rdvNetworkError"));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [isAdmin, org, ready, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeName(search);
    if (!q) return entries;
    return entries.filter((e) => normalizeName(e.name).includes(q));
  }, [entries, search]);

  // Nombre de personnes distinctes (un même nom peut avoir plusieurs RDV).
  const distinctPeople = useMemo(
    () => new Set(entries.map((e) => normalizeName(e.name))).size,
    [entries],
  );

  // Occurrences par personne (nom normalisé) sur TOUT l'historique : ≥2 = doublon.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const k = normalizeName(e.name);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [entries]);

  // Référence « aujourd'hui » (date locale Bruxelles côté navigateur) pour
  // distinguer les RDV à venir (à vérifier) des RDV passés (simple info).
  const todayKey = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, []);

  // Pour chaque personne (nom normalisé) : a-t-elle au moins un RDV à venir ?
  // Calcul sur TOUT l'historique pour rester stable malgré la recherche.
  const hasUpcoming = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const e of entries) {
      const k = normalizeName(e.name);
      if (e.date >= todayKey) m.set(k, true);
      else if (!m.has(k)) m.set(k, false);
    }
    return m;
  }, [entries, todayKey]);

  // Réorganisation : doublons à VÉRIFIER (≥1 RDV à venir) en premier, puis
  // doublons PASSÉS (tous passés, simple info), puis les autres rendez-vous.
  const { dupActive, dupPast, others } = useMemo(() => {
    const countOf = (e: HistoryEntry) => counts.get(normalizeName(e.name)) ?? 0;
    const active: HistoryEntry[] = [];
    const past: HistoryEntry[] = [];
    const oth: HistoryEntry[] = [];
    for (const e of filtered) {
      if (countOf(e) >= 2) {
        if (hasUpcoming.get(normalizeName(e.name))) active.push(e);
        else past.push(e);
      } else {
        oth.push(e);
      }
    }
    const sortDup = (a: HistoryEntry, b: HistoryEntry, upcomingFirst: boolean) => {
      const ca = countOf(a);
      const cb = countOf(b);
      if (ca !== cb) return cb - ca; // personnes les plus fréquentes d'abord
      const na = normalizeName(a.name);
      const nb = normalizeName(b.name);
      if (na !== nb) return na.localeCompare(nb); // regroupe les RDV d'une personne
      if (upcomingFirst) {
        const ua = a.date >= todayKey ? 0 : 1;
        const ub = b.date >= todayKey ? 0 : 1;
        if (ua !== ub) return ua - ub; // dans une personne : à venir d'abord
      }
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    };
    active.sort((a, b) => sortDup(a, b, true));
    past.sort((a, b) => sortDup(a, b, false));
    oth.sort((a, b) =>
      a.date !== b.date
        ? b.date.localeCompare(a.date)
        : a.name.localeCompare(b.name),
    );
    return { dupActive: active, dupPast: past, others: oth };
  }, [filtered, counts, hasUpcoming, todayKey]);

  // Compteur de personnes par catégorie (pour l'en-tête).
  const activeDuplicatePeople = useMemo(() => {
    const seen = new Set<string>();
    for (const e of dupActive) seen.add(normalizeName(e.name));
    return seen.size;
  }, [dupActive]);
  const pastDuplicatePeople = useMemo(() => {
    const seen = new Set<string>();
    for (const e of dupPast) seen.add(normalizeName(e.name));
    return seen.size;
  }, [dupPast]);

  const handleDelete = useCallback(
    async (entry: HistoryEntry) => {
      const ok = await confirm({
        title: t("rdvDeleteTitle"),
        description: t("rdvDeleteDesc", {
          name: entry.name,
          date: formatDateKey(entry.date),
          time: entry.startTime,
        }),
        destructive: true,
        confirmText: t("rdvDeleteConfirm"),
      });
      if (!ok) return;
      try {
        const res = await fetch(MANAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            id: entry.id,
            org: isAdmin ? org : undefined,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          toast.error(data?.error ?? t("rdvDeleteFailed"));
          return;
        }
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        toast.success(t("rdvDeleted"));
      } catch {
        toast.error(t("rdvNetworkError"));
      }
    },
    [confirm, isAdmin, org, t],
  );

  const handleClear = useCallback(async () => {
    const ok = await confirm({
      title: t("rdvClearTitle"),
      description: t("rdvClearDesc"),
      destructive: true,
      confirmText: t("rdvClearConfirm"),
      requireText: t("rdvClearKeyword"),
    });
    if (!ok) return;
    try {
      const res = await fetch(MANAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", org: isAdmin ? org : undefined }),
      });
      const data = (await res.json().catch(() => null)) as {
        deleted?: number;
        error?: string;
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? t("rdvActionFailed"));
        return;
      }
      setEntries([]);
      toast.success(t("rdvEntriesDeleted", { count: data?.deleted ?? 0 }));
    } catch {
      toast.error(t("rdvNetworkError"));
    }
  }, [confirm, isAdmin, org, t]);

  // ── Onglet « Mise à jour » ──────────────────────────────────────────────

  // Synthèse par journée enregistrée : nb de RDV + dernière mise à jour. Permet
  // de savoir, sans rien re-coller, quelles journées sont déjà encodées.
  const daySummary = useMemo(() => {
    const m = new Map<
      string,
      { date: string; count: number; lastUpdated: number }
    >();
    for (const e of entries) {
      const t = new Date(e.createdAt).getTime();
      const cur = m.get(e.date) ?? { date: e.date, count: 0, lastUpdated: 0 };
      cur.count += 1;
      if (t > cur.lastUpdated) cur.lastUpdated = t;
      m.set(e.date, cur);
    }
    return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  // « Recharger » : réinjecte la liste d'une journée dans la zone de texte.
  const handleReloadDay = useCallback(
    (date: string) => {
      const text = reconstructDayPaste(
        entries.filter((e) => e.date === date),
      );
      setUpdateContent(text);
      setUpdateError(null);
      setUpdateResult(null);
      requestAnimationFrame(() => {
        updateRef.current?.focus();
        updateRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
    [entries],
  );

  // Aperçu live du collage : nombre de RDV et journées concernées (réutilise le
  // MÊME parseur que le serveur). Sert à activer le bouton et à montrer quelles
  // journées seront re-synchronisées.
  const updatePreview = useMemo<
    | { kind: "empty" }
    | { kind: "error"; message: string }
    | { kind: "ok"; count: number; dates: string[] }
  >(() => {
    if (updateContent.trim() === "") return { kind: "empty" };
    try {
      const appts = parseAppointments(updateContent);
      const dates = [...new Set(appts.map((a) => dateKey(a.start)))].sort();
      return { kind: "ok", count: appts.length, dates };
    } catch (err) {
      return {
        kind: "error",
        message:
          err instanceof AppointmentParseError ? err.message : t("rdvUnreadable"),
      };
    }
  }, [updateContent, t]);

  const handleApply = useCallback(async () => {
    setUpdateError(null);
    setUpdateResult(null);
    if (!ready) {
      setUpdateError(
        isAdmin ? t("rdvChooseOrgAbove") : t("rdvNoOrgAttached"),
      );
      return;
    }
    if (updatePreview.kind === "error") {
      setUpdateError(
        t("rdvFormatNotRecognized", { message: updatePreview.message }),
      );
      return;
    }
    if (updatePreview.kind !== "ok") {
      setUpdateError(t("rdvNoneDetected"));
      return;
    }
    setApplying(true);
    try {
      const res = await fetch(SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          content: updateContent,
          org: isAdmin ? org : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        removedEntries?: SyncedEntry[];
        added?: SyncedEntry[];
        total?: number;
        days?: number;
        error?: string;
      } | null;
      if (!res.ok) {
        setUpdateError(data?.error ?? t("rdvUpdateFailed"));
        return;
      }
      const removed = data?.removedEntries ?? [];
      const added = data?.added ?? [];
      const total = data?.total ?? 0;
      setUpdateResult({
        removed,
        added,
        unchanged: Math.max(0, total - added.length),
        days: data?.days ?? 0,
      });
      if (removed.length > 0 || added.length > 0) {
        toast.success(
          t("rdvUpdateApplied", {
            removed: removed.length,
            added: added.length,
          }),
        );
      } else {
        toast.success(t("rdvAlreadyUpToDate"));
      }
      // Recharge la liste de l'onglet « Consultation » pour refléter la sync.
      await load();
    } catch {
      setUpdateError(t("rdvNetworkErrorUpdate"));
    } finally {
      setApplying(false);
    }
  }, [ready, isAdmin, org, updateContent, updatePreview, load, t]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  type RowVariant = "active" | "past" | "plain";
  const renderTable = (list: HistoryEntry[], variant: RowVariant) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("rdvColName")}</TableHead>
          <TableHead>{t("rdvColDate")}</TableHead>
          <TableHead>{t("rdvColSlot")}</TableHead>
          <TableHead>{t("rdvColSavedOn")}</TableHead>
          <TableHead className="text-right">{t("rdvColAction")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((e) => {
          const count = counts.get(normalizeName(e.name)) ?? 1;
          const isUpcoming = e.date >= todayKey;
          const isDup = variant !== "plain";
          const rowClass =
            variant === "active"
              ? "bg-amber-50/60 dark:bg-amber-950/20"
              : variant === "past"
                ? "bg-muted/30"
                : undefined;
          return (
            <TableRow key={e.id} className={rowClass}>
              <TableCell className="font-medium">
                <span className="flex flex-wrap items-center gap-2">
                  {e.name}
                  {isDup ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <History className="size-3" />
                      {t("rdvCountRdv", { count })}
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center gap-2">
                  {formatDateKey(e.date)}
                  {isUpcoming ? (
                    <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {t("rdvBadgeUpcoming")}
                    </span>
                  ) : variant === "plain" ? null : (
                    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("rdvBadgePast")}
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {e.startTime} – {e.endTime}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleDateString("fr-BE")}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(e)}
                  title={t("rdvDeleteRowTitle")}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  /** Petite liste nominative (retirés / ajoutés) du compte rendu de mise à jour. */
  const renderSyncList = (list: SyncedEntry[]) => (
    <ul className="flex flex-col gap-1">
      {list.map((e, i) => (
        <li
          key={`${e.name}-${e.date}-${e.startTime}-${i}`}
          className="flex flex-wrap items-center gap-x-2 text-sm"
        >
          <span className="font-medium">{e.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDateKey(e.date)} · {e.startTime} – {e.endTime}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <History className="size-5 text-primary" />
          {t("rdvHistTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("rdvHistIntro")}</p>
        <Link
          href="/partenaire/outils/fgtb-planning"
          className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("rdvBackToTool")}
        </Link>
      </header>

      {isAdmin ? (
        <Card>
          <CardContent className="flex flex-col gap-1.5 pt-6">
            <Label htmlFor="org-select" className="text-xs">
              {t("rdvOrgSimpleLabel")}
            </Label>
            <Select
              value={org}
              onValueChange={(v) => {
                setOrg(v ?? "");
                // Le périmètre change → résultat de mise à jour précédent obsolète.
                setUpdateResult(null);
                setUpdateError(null);
              }}
            >
              <SelectTrigger id="org-select" className="w-full sm:w-[280px]">
                <SelectValue placeholder={t("rdvOrgPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {orgOptions.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    {t("rdvNoOrg")}
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
              {t("rdvOrgHelpHist")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="consultation">
        <TabsList>
          <TabsTrigger value="consultation">
            <History className="size-4" />
            {t("rdvTabConsult")}
          </TabsTrigger>
          <TabsTrigger value="update">
            <RefreshCw className="size-4" />
            {t("rdvTabUpdate")}
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet Consultation ── */}
        <TabsContent value="consultation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                {t("rdvRegisteredTitle")}
              </CardTitle>
              <CardDescription>
                {loaded
                  ? [
                      t("rdvSummaryBase", {
                        count: entries.length,
                        people: distinctPeople,
                      }),
                      activeDuplicatePeople > 0
                        ? t("rdvSummaryToCheck", { count: activeDuplicatePeople })
                        : "",
                      pastDuplicatePeople > 0
                        ? t("rdvSummaryPastDup", { count: pastDuplicatePeople })
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" • ")
                  : t("rdvSelectOrgToShow")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="search" className="text-xs">
                    {t("rdvSearchLabel")}
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("rdvSearchPlaceholder")}
                      className="pl-8"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={!ready || entries.length === 0}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                  {t("rdvClearHistBtn")}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("rdvLoading")}
                </div>
              ) : !ready ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("rdvChooseOrgAboveShort")}
                </p>
              ) : filtered.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {entries.length === 0
                    ? t("rdvEmptyHist")
                    : t("rdvNoSearchResult")}
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  {dupActive.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <AlertTriangle className="size-3.5" />
                          {t("rdvDupToCheckLabel")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("rdvDupToCheckCount", {
                            count: activeDuplicatePeople,
                          })}
                        </span>
                      </div>
                      {renderTable(dupActive, "active")}
                    </div>
                  ) : null}
                  {dupPast.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          <History className="size-3.5" />
                          {t("rdvDupPastLabel")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("rdvDupPastCount", { count: pastDuplicatePeople })}
                        </span>
                      </div>
                      {renderTable(dupPast, "past")}
                    </div>
                  ) : null}
                  {others.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {dupActive.length > 0 || dupPast.length > 0 ? (
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("rdvOtherAppointments")}
                        </span>
                      ) : null}
                      {renderTable(others, "plain")}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet Mise à jour ── */}
        <TabsContent value="update" className="mt-4">
          {ready && daySummary.length > 0 ? (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  {t("rdvDaysRegisteredTitle")}
                </CardTitle>
                <CardDescription>
                  {t("rdvDaysRegisteredDesc", { count: daySummary.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("rdvColDay")}</TableHead>
                        <TableHead>{t("rdvColRdv")}</TableHead>
                        <TableHead>{t("rdvColLastUpdate")}</TableHead>
                        <TableHead className="text-right">
                          {t("rdvColAction")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daySummary.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell className="font-medium">
                            {formatDateKey(d.date)}
                          </TableCell>
                          <TableCell>{d.count}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.lastUpdated
                              ? new Date(d.lastUpdated).toLocaleString("fr-BE", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReloadDay(d.date)}
                              title={t("rdvReloadDayTitle")}
                            >
                              <RotateCcw className="size-4" />
                              {t("rdvReloadDay")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="size-4 text-primary" />
                {t("rdvUpdateDayTitle")}
              </CardTitle>
              <CardDescription>
                {t.rich("rdvUpdateDayDesc", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!ready ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("rdvChooseOrgToUpdate")}
                </p>
              ) : null}
              <Label htmlFor="update-input" className="sr-only">
                {t("rdvCorrectedCalLabel")}
              </Label>
              <Textarea
                ref={updateRef}
                id="update-input"
                value={updateContent}
                onChange={(e) => {
                  setUpdateContent(e.target.value);
                  setUpdateError(null);
                  setUpdateResult(null);
                }}
                placeholder={UPDATE_PLACEHOLDER}
                spellCheck={false}
                disabled={!ready}
                aria-invalid={updatePreview.kind === "error"}
                className="min-h-[220px] resize-y font-mono text-sm leading-relaxed"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleApply}
                  disabled={!ready || updatePreview.kind !== "ok" || applying}
                >
                  {applying ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  {t("rdvApplyUpdateBtn")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setUpdateContent("");
                    setUpdateError(null);
                    setUpdateResult(null);
                  }}
                  disabled={applying || updateContent === ""}
                >
                  <Eraser />
                  {t("rdvClear")}
                </Button>
                {updatePreview.kind === "ok" ? (
                  <span className="ml-auto inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                    <CalendarClock className="size-4 text-primary" />
                    {t("rdvUpdatePreviewMeta", {
                      count: updatePreview.count,
                      days: updatePreview.dates.length,
                    })}
                    {updatePreview.dates.map((d) => (
                      <span
                        key={d}
                        className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {formatDateKey(d)}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>

              {updateError ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>{t("rdvUpdateFailedTitle")}</AlertTitle>
                  <AlertDescription>{updateError}</AlertDescription>
                </Alert>
              ) : null}

              {!updateError && updatePreview.kind === "error" ? (
                <Alert>
                  <AlertTriangle className="text-amber-600" />
                  <AlertTitle>{t("rdvCheckPaste")}</AlertTitle>
                  <AlertDescription>{updatePreview.message}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          {updateResult ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  {t("rdvUpdateAppliedTitle")}
                </CardTitle>
                <CardDescription>
                  {[
                    t("rdvRemovedShort", { count: updateResult.removed.length }),
                    t("rdvAddedShort", { count: updateResult.added.length }),
                    t("rdvUnchanged", { count: updateResult.unchanged }),
                    t("rdvDaysSynced", { count: updateResult.days }),
                  ].join(" • ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {updateResult.removed.length === 0 &&
                updateResult.added.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("rdvNothingToChangeDays")}
                  </p>
                ) : null}
                {updateResult.removed.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive">
                      <UserMinus className="size-4" />
                      {t("rdvRemovedFromHist", {
                        count: updateResult.removed.length,
                      })}
                    </span>
                    {renderSyncList(updateResult.removed)}
                  </div>
                ) : null}
                {updateResult.added.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      <UserPlus className="size-4" />
                      {t("rdvAddedToHist", { count: updateResult.added.length })}
                    </span>
                    {renderSyncList(updateResult.added)}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
