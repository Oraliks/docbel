import type { MethodologyConstant } from "@/lib/calculators/_methodology";

interface MethodologyConstantsTableProps {
  constants: MethodologyConstant[];
}

/**
 * Table complète des constantes (onglet "Constantes & barèmes").
 * Structure 3 colonnes : Constante | Valeur (mono) | Note.
 */
export function MethodologyConstantsTable({
  constants,
}: MethodologyConstantsTableProps) {
  if (!constants || constants.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-[12.5px] text-muted-foreground">
        Aucune constante documentée pour ce calculateur.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Constantes &amp; barèmes ({constants.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-muted/60 text-left">
              <th className="w-1/4 px-3 py-2 font-semibold">Constante</th>
              <th className="w-1/3 px-3 py-2 font-semibold">Valeur</th>
              <th className="px-3 py-2 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {constants.map((c, i) => (
              <tr
                key={i}
                className="border-t border-border align-top odd:bg-background even:bg-muted/20"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {c.name}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] text-foreground/90">
                  {c.value}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {c.note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
