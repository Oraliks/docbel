/**
 * Décor « aurora » animé pour l'espace employeur : orbes gradient floutées qui
 * flottent doucement en arrière-plan. Composant serveur (pur décoratif).
 * À placer comme premier enfant d'un conteneur `relative overflow-hidden`.
 * Respecte prefers-reduced-motion (animation coupée).
 */
export function AuroraBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div
        className="employeur-orb absolute -left-24 -top-28 size-72 rounded-full bg-violet-400/30 blur-3xl dark:bg-violet-600/20"
        style={{ animationDuration: "15s" }}
      />
      <div
        className="employeur-orb absolute -right-10 top-4 size-80 rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-600/15"
        style={{ animationDuration: "19s", animationDirection: "reverse" }}
      />
      <div
        className="employeur-orb absolute -bottom-20 left-1/3 size-72 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-600/15"
        style={{ animationDuration: "17s", animationDelay: "-4s" }}
      />
      <style>{`
        .employeur-orb { animation-name: employeurFloat; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes employeurFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(22px, -26px, 0) scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) { .employeur-orb { animation: none; } }
      `}</style>
    </div>
  );
}
