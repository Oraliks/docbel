"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

type Status = "pending" | "accepted" | "rejected";

interface Suggestion {
  id: string;
  locale: string;
  model: string | null;
  recordId: string | null;
  field: string | null;
  uiKey: string | null;
  sourceText: string;
  currentText: string | null;
  suggestedText: string;
  comment: string | null;
  submittedBy: string | null;
  status: Status;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const FILTERS: { value: Status; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "accepted", label: "Acceptées" },
  { value: "rejected", label: "Refusées" },
];

const STATUS_VARIANT: Record<Status, "warning" | "success" | "destructive"> = {
  pending: "warning",
  accepted: "success",
  rejected: "destructive",
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString("fr-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function TranslationSuggestionsManager() {
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async (s: Status) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/translation-suggestions?status=${s}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { items: Suggestion[] };
      setItems(data.items);
    } catch {
      toast.error("Échec du chargement des suggestions.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [status, load]);

  async function moderate(id: string, action: "accept" | "reject") {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/translation-suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("request failed");
      toast.success(
        action === "accept" ? "Correction acceptée." : "Suggestion refusée.",
      );
      // Retire la ligne de la vue courante (elle change de statut).
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error("Échec de l'opération.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={status === f.value ? "default" : "outline"}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void load(status)}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} />
          Rafraîchir
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune suggestion dans cette catégorie.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{s.locale.toUpperCase()}</Badge>
                  <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                  {s.uiKey ? (
                    <Badge variant="secondary">UI · {s.uiKey}</Badge>
                  ) : (
                    <Badge variant="secondary">
                      {s.model}#{s.recordId}.{s.field}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {s.submittedBy ? `${s.submittedBy} · ` : ""}
                  {fmtDate(s.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Field label="Source (FR)" value={s.sourceText} />
                {s.currentText ? (
                  <Field label="Traduction actuelle" value={s.currentText} />
                ) : null}
                <Field
                  label="Proposition"
                  value={s.suggestedText}
                  highlight
                />
                {s.comment ? (
                  <Field label="Commentaire" value={s.comment} />
                ) : null}

                {s.status === "pending" ? (
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void moderate(s.id, "reject")}
                      disabled={actingId === s.id}
                    >
                      <X /> Refuser
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void moderate(s.id, "accept")}
                      disabled={actingId === s.id}
                    >
                      {actingId === s.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                      Accepter
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Modérée{s.reviewedAt ? ` le ${fmtDate(s.reviewedAt)}` : ""}.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div
        className={
          highlight
            ? "rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm whitespace-pre-wrap"
            : "rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap"
        }
      >
        {value}
      </div>
    </div>
  );
}
