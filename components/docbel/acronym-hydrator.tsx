"use client";

// <AcronymHydrator/> — upgrade les <abbr.acronym-tip> server-rendered en
// tooltips glass via délégation d'events au niveau document.
//
// Pourquoi un hydrateur plutôt que des <Acronym/> React partout :
//   Le contenu rich-text des actualités et du page-builder est stocké
//   en HTML pur en base. On l'enrichit côté serveur (lib/acronyms-html.ts)
//   avec des <abbr> qui ont déjà un `title=` natif — donc le fallback
//   sans JS marche tout seul. Mais ces <abbr> ne sont pas des composants
//   React : pour leur donner le tooltip glass, on délègue les events
//   au document et on monte UN seul tooltip flottant qui suit l'élément
//   actif. Coût : 1 listener / type d'event, peu importe combien de
//   sigles sont à l'écran.
//
// Comportement progressive enhancement :
//   - Sans JS : tooltip natif du navigateur via attribut `title`.
//   - Avec JS : on retire `title` au premier hover (anti double-tooltip)
//               et on affiche le tooltip glass.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { lookupAcronym, type AcronymEntry } from "@/lib/acronyms";

type TipState = {
  entry: AcronymEntry;
  /** Coordonnées du centre horizontal du trigger, en pixels viewport. */
  x: number;
  /** Y du bord supérieur (placement="top") ou inférieur (placement="bottom"). */
  y: number;
  placement: "top" | "bottom";
};

/** Marge entre le trigger et le tooltip, en pixels. */
const GAP = 8;
/** Largeur max du tooltip, utilisée pour le clamp horizontal. */
const MAX_WIDTH = 320;

export function AcronymHydrator() {
  const [tip, setTip] = useState<TipState | null>(null);
  // On garde une ref vers le dernier élément déclenché pour pouvoir
  // recalculer la position après un scroll.
  const currentTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const computePlacement = (rect: DOMRect): TipState["placement"] =>
      rect.top > 96 ? "top" : "bottom";

    const stateFor = (target: HTMLElement, entry: AcronymEntry): TipState => {
      const rect = target.getBoundingClientRect();
      const placement = computePlacement(rect);
      // Clamp horizontal pour rester dans le viewport.
      const centerX = rect.left + rect.width / 2;
      const half = MAX_WIDTH / 2;
      const x = Math.max(half + 8, Math.min(window.innerWidth - half - 8, centerX));
      const y = placement === "top" ? rect.top - GAP : rect.bottom + GAP;
      return { entry, x, y, placement };
    };

    const show = (target: HTMLElement) => {
      const code = target.dataset.acronym;
      if (!code) return;
      const entry = lookupAcronym(code);
      if (!entry) return;
      // Strip lazy du title natif → évite que le tooltip OS s'affiche
      // par-dessus le nôtre. On conserve la valeur sur `data-` au cas où
      // on voudrait la restaurer.
      if (target.title) {
        target.dataset.acronymNativeTitle = target.title;
        target.removeAttribute("title");
      }
      currentTrigger.current = target;
      setTip(stateFor(target, entry));
    };

    const hide = () => {
      currentTrigger.current = null;
      setTip(null);
    };

    const findTrigger = (e: Event): HTMLElement | null => {
      const t = e.target as HTMLElement | null;
      return t?.closest<HTMLElement>(".acronym-tip[data-acronym]") ?? null;
    };

    const onPointerOver = (e: PointerEvent) => {
      const target = findTrigger(e);
      if (target) show(target);
    };
    const onPointerOut = (e: PointerEvent) => {
      const target = findTrigger(e);
      if (!target) return;
      // Si on glisse vers un enfant du trigger, ne pas masquer.
      if (target.contains(e.relatedTarget as Node | null)) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = findTrigger(e);
      if (target) show(target);
    };
    const onFocusOut = (e: FocusEvent) => {
      const target = findTrigger(e);
      if (!target) return;
      if (target.contains(e.relatedTarget as Node | null)) return;
      hide();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    // Sur scroll, on recalcule la position du tooltip (pas de re-show
    // / hide complet pour éviter le flicker).
    const onScrollOrResize = () => {
      const t = currentTrigger.current;
      if (!t) return;
      const entry = lookupAcronym(t.dataset.acronym ?? "");
      if (!entry) return;
      setTip(stateFor(t, entry));
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  if (!tip || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="tooltip"
      data-acronym-tooltip
      data-placement={tip.placement}
      className="acronym-tooltip pointer-events-none fixed z-[1000]"
      style={{
        left: tip.x,
        top: tip.y,
        transform:
          tip.placement === "top"
            ? "translate(-50%, -100%)"
            : "translate(-50%, 0)",
        maxWidth: MAX_WIDTH,
      }}
    >
      <div className="glass-surface-strong rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] px-3 py-2.5 text-left text-[color:var(--glass-ink)] shadow-lg">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-soft)]">
          {tip.entry.label}
        </div>
        <div className="mt-1 text-[12px] leading-snug text-[color:var(--glass-ink)]">
          {tip.entry.definition}
        </div>
      </div>
    </div>,
    document.body,
  );
}
