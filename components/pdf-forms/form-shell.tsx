interface FormShellProps {
  children: React.ReactNode;
  helpPanel: React.ReactNode;
}

/// Layout 2 colonnes desktop (aide contextuelle À GAUCHE | formulaire), 1
/// colonne mobile (aide sous le formulaire, jamais cachée). L'ordre DOM reste
/// formulaire→aide (mobile inchangé) ; `lg:order-*` repositionne l'aide en
/// première colonne sur desktop. Pas de max-w-*/mx-auto sur la racine (cf.
/// DESIGN_RULES) — le composant se contente de structurer, le conteneur parent
/// gère déjà la largeur.
export function FormShell({ children, helpPanel }: FormShellProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <div className="min-w-0 lg:order-2">{children}</div>
      <div className="lg:order-1">{helpPanel}</div>
    </div>
  );
}
