import { U1InstitutionsManager } from "@/components/admin/u1-institutions-manager";

export const dynamic = "force-dynamic";

export default function U1InstitutionsAdminPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Institutions U1 (EEE + Suisse)</h1>
        <p className="text-muted-foreground mt-2">
          Adresses des services compétents en matière de chômage pour la délivrance des
          attestations U1 (ex-E301).
        </p>
      </div>
      <U1InstitutionsManager />
    </div>
  );
}
