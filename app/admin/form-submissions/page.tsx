import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Submission = {
  id: string;
  source: string | null;
  data: unknown;
  createdAt: Date;
};

function asPairs(data: unknown): Array<[string, string]> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data as Record<string, unknown>).map(([k, v]) => [
    k,
    typeof v === "string" ? v : JSON.stringify(v),
  ]);
}

export default async function FormSubmissionsPage() {
  const submissions: Submission[] = await prisma.formSubmission
    .findMany({ orderBy: { createdAt: "desc" }, take: 200 })
    .catch(() => []);

  const fmt = new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-6 md:p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Soumissions de formulaires
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les envois des blocs « Formulaire » des pages (200 plus récents).
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {submissions.length}
        </span>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
          Aucune soumission pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{s.source || "—"}</span>
                <time>{fmt.format(new Date(s.createdAt))}</time>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {asPairs(s.data).map(([k, v], i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <dt className="shrink-0 font-medium text-muted-foreground">
                      {k} :
                    </dt>
                    <dd className="min-w-0 break-words whitespace-pre-wrap">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
