interface FormShellProps {
  children: React.ReactNode;
  helpPanel: React.ReactNode;
}

/// Layout 2 colonnes desktop (formulaire | aide contextuelle), 1 colonne
/// mobile (aide affichée sous le formulaire, jamais cachée). Pas de
/// max-w-*/mx-auto sur la racine (cf. DESIGN_RULES) — le composant se
/// contente de structurer, le conteneur parent gère déjà la largeur.
export function FormShell({ children, helpPanel }: FormShellProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">{children}</div>
      <div>{helpPanel}</div>
    </div>
  );
}
