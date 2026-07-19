interface FormShellProps {
  children: React.ReactNode;
  helpPanel: React.ReactNode;
  /// true = colonne d'aide EN PREMIER dans le DOM : sur mobile elle apparaît
  /// AU-DESSUS du formulaire (cas du rail de démarche, replié par défaut).
  /// false (défaut) = comportement historique : aide sous le formulaire sur
  /// mobile, repositionnée à gauche sur desktop via lg:order-*.
  helpFirstOnMobile?: boolean;
}

/// Layout 2 colonnes desktop (aide/rail À GAUCHE | formulaire), 1 colonne
/// mobile. Pas de max-w-*/mx-auto sur la racine (cf. DESIGN_RULES) — le
/// conteneur parent gère la largeur.
export function FormShell({ children, helpPanel, helpFirstOnMobile = false }: FormShellProps) {
  if (helpFirstOnMobile) {
    return (
      <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className="min-w-0">{helpPanel}</div>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="min-w-0 lg:order-2">{children}</div>
      <div className="lg:order-1">{helpPanel}</div>
    </div>
  );
}
