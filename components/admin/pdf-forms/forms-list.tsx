"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, FileInputIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Locale } from "@/lib/pdf-forms/types";

interface FormRow {
  id: string;
  slug: string;
  title: string;
  issuer: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  locales: Locale[];
  pageCount: number;
  updatedAt: string;
}

const STATUS_BADGE: Record<FormRow["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  published: { label: "Publié", variant: "default" },
  draft: { label: "Brouillon", variant: "secondary" },
  archived: { label: "Archivé", variant: "outline" },
};

export function PdfFormsList() {
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/pdf/forms")
      .then((r) => r.json())
      .then((d) => setForms(Array.isArray(d) ? d : []))
      .catch(() => setForms([]));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => router.push("/admin/pdf/new")}>
          <PlusIcon className="size-4" /> Nouveau formulaire
        </Button>
      </div>

      {forms === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Empty className="rounded-lg border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileInputIcon className="size-6" /></EmptyMedia>
            <EmptyTitle>Aucun formulaire</EmptyTitle>
            <EmptyDescription>Importez un PDF officiel à champs pour créer votre premier formulaire.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead className="hidden sm:table-cell">Organisme</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden sm:table-cell">Langues</TableHead>
                <TableHead className="text-right">Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((f) => {
                const badge = STATUS_BADGE[f.status];
                return (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/pdf/${f.id}`)}
                  >
                    <TableCell className="font-medium">{f.title}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{f.issuer || "—"}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs uppercase text-muted-foreground">{f.locales.join(" · ")}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">v{f.version}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
