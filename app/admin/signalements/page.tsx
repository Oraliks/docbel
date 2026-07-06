import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { listReports } from "@/lib/reports/engine";
import { REPORT_TYPES } from "@/lib/reports/registry";
import { SignalementsClient } from "./signalements-client";

export const dynamic = "force-dynamic";

export default async function SignalementsPage() {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const rawReports = await listReports({ status: "pending", limit: 200 });
  // Prisma's `Json` column type-checks as `Prisma.JsonValue` (includes null/array/
  // primitive); the write path always stores a plain object (payloadSchema.parse
  // output), so narrowing to Record<string, unknown> here is safe and lets
  // SignalementsClient/PayloadDetail treat it as key/value data.
  const reports = rawReports.map((r) => ({ ...r, payload: r.payload as Record<string, unknown> }));
  const typeOptions = Object.entries(REPORT_TYPES).map(([key, cfg]) => ({ value: key, label: cfg.label }));

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Signalements</h1>
        <p className="mt-2 text-muted-foreground">
          Tous les signalements reçus (bureaux, formulaires, formations, traductions, réglementation), en un seul endroit.
        </p>
      </div>
      <SignalementsClient initialReports={reports} typeOptions={typeOptions} />
    </div>
  );
}
