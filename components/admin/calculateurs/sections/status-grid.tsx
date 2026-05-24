export interface MethodologyStatusItem {
  /** Label de la colonne (ex: "Statut"). */
  label: string;
  /** Valeur principale (ex: "Publié"). */
  value: string;
  /** Ligne secondaire optionnelle (ex: "24 mai 2026"). */
  hint?: string;
  /** Variante d'accent — change la couleur du value. */
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

interface MethodologyStatusGridProps {
  items: MethodologyStatusItem[];
}

const VARIANT_COLORS: Record<NonNullable<MethodologyStatusItem["variant"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-sky-600 dark:text-sky-400",
};

/**
 * Grille de cards "status" affichées en haut du contenu central :
 *   ┌─Statut─┐ ┌─Version─┐ ┌─Portée─┐ ┌─Type─┐
 *
 * Responsive : 2 cols sur mobile, 4 cols sur md+.
 */
export function MethodologyStatusGrid({ items }: MethodologyStatusGridProps) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3"
        >
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            {item.label}
          </div>
          <div
            className={`text-[14px] font-semibold ${
              VARIANT_COLORS[item.variant ?? "default"]
            }`}
          >
            {item.value}
          </div>
          {item.hint ? (
            <div className="text-[11.5px] text-muted-foreground">
              {item.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
