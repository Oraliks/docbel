import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Champ « tape ce mot pour confirmer » — garde-fou type-to-confirm (à la GitHub)
 * pour les suppressions IRRÉVERSIBLES affichées dans un AlertDialog inline (qui
 * ne passe pas par le `useConfirm` global). Mutualise l'UI pour éviter de la
 * dupliquer dans chaque manager.
 *
 * Le composant ne gère que l'affichage du champ ; au parent de désactiver son
 * bouton de confirmation via `typeToConfirmMatches(value, requireText)`.
 */
export function TypeToConfirmField({
  requireText,
  value,
  onChange,
  disabled,
  id = "type-to-confirm",
}: {
  requireText: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const matches = typeToConfirmMatches(value, requireText);
  return (
    <div className="space-y-2 py-1">
      <Label htmlFor={id} className="text-sm">
        Pour confirmer, tape{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{requireText}</code>{" "}
        ci-dessous :
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoFocus
        disabled={disabled}
        placeholder={requireText}
        className={matches ? "border-green-400 focus-visible:ring-green-400/50" : undefined}
      />
    </div>
  );
}

/** Le texte tapé correspond-il (aux espaces de bord près) au mot requis ? */
export function typeToConfirmMatches(value: string, requireText: string): boolean {
  return value.trim() === requireText.trim();
}
