"use client";

/// Visualisation interactive de l'arbre (SVG). Layout vertical par BFS depuis
/// la racine, surchargé par les positions manuelles (drag). Interactions :
///   - molette        → zoom (vers le curseur)
///   - glisser le fond → déplacer la vue (pan)
///   - glisser un nœud → le repositionner (persisté dans content.positions)
///   - clic sur un nœud → sélection
///   - barre d'outils  → zoom +/−, ajuster, réinitialiser, recherche de nœud
/// Les nœuds en violation sont entourés (rouge erreur / ambre warning).

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Minus,
  Plus,
  Search as SearchIcon,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DecisionTreeContent,
  OptionNode,
  QuestionNode,
  ResultNode,
} from "@/lib/decision-builder/types";

const NODE_W = 180;
const NODE_H = 56;
const H_GAP = 28;
const V_GAP = 74;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const DRAG_THRESHOLD = 4; // px avant de considérer un déplacement (vs un clic)

type Severity = "error" | "warning";

interface Props {
  content: DecisionTreeContent;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /// Persiste la nouvelle position d'un nœud après drag.
  onMoveNode?: (id: string, x: number, y: number) => void;
  violations?: Map<string, Severity>;
}

function outgoing(node: DecisionTreeContent["nodes"][string]): string[] {
  if (node.type === "question") return node.optionIds;
  if (node.type === "option") return [node.nextId];
  return [];
}

export function DecisionCanvas({
  content,
  selectedId,
  onSelect,
  onMoveNode,
  violations,
}: Props) {
  const layout = useMemo(() => computeLayout(content), [content]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Vue : translation (tx,ty) + échelle (zoom).
  const [view, setView] = useState({ tx: 24, ty: 24, zoom: 1 });
  // Position transitoire d'un nœud en cours de drag (coords "monde").
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Interaction en cours (pan ou drag de nœud), via ref pour éviter les
  // re-renders pendant le mousemove.
  const interaction = useRef<
    | { kind: "pan"; startX: number; startY: number; origTx: number; origTy: number }
    | {
        kind: "node";
        id: string;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        moved: boolean;
      }
    | null
  >(null);

  const nodePos = useCallback(
    (id: string): { x: number; y: number } => {
      if (dragPos && dragPos.id === id) return { x: dragPos.x, y: dragPos.y };
      return layout.positions[id] ?? { x: 0, y: 0 };
    },
    [dragPos, layout.positions],
  );

  // ── Zoom molette (centré sur le curseur) ──────────────────────────────────
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const k = zoom / v.zoom;
        // Garde le point sous le curseur fixe.
        return { zoom, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
      });
    },
    [],
  );

  // ── Pan (glisser le fond) ─────────────────────────────────────────────────
  const onBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore si on a cliqué dans un nœud (géré séparément).
      if ((e.target as HTMLElement).closest("[data-node]")) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      interaction.current = {
        kind: "pan",
        startX: e.clientX,
        startY: e.clientY,
        origTx: view.tx,
        origTy: view.ty,
      };
      setSearchOpen(false);
    },
    [view.tx, view.ty],
  );

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const p = nodePos(id);
      interaction.current = {
        kind: "node",
        id,
        startX: e.clientX,
        startY: e.clientY,
        origX: p.x,
        origY: p.y,
        moved: false,
      };
    },
    [nodePos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const it = interaction.current;
    if (!it) return;
    if (it.kind === "pan") {
      setView((v) => ({
        ...v,
        tx: it.origTx + (e.clientX - it.startX),
        ty: it.origTy + (e.clientY - it.startY),
      }));
    } else {
      const dx = e.clientX - it.startX;
      const dy = e.clientY - it.startY;
      if (!it.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      it.moved = true;
      setView((v) => {
        setDragPos({
          id: it.id,
          x: it.origX + dx / v.zoom,
          y: it.origY + dy / v.zoom,
        });
        return v;
      });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    const it = interaction.current;
    interaction.current = null;
    if (!it) return;
    if (it.kind === "node") {
      if (it.moved && dragPos) {
        onMoveNode?.(it.id, Math.round(dragPos.x), Math.round(dragPos.y));
        setDragPos(null);
      } else {
        onSelect(it.id); // pas de mouvement = clic = sélection
      }
    }
  }, [dragPos, onMoveNode, onSelect]);

  // ── Ajuster / réinitialiser ───────────────────────────────────────────────
  const fit = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || layout.width === 0) {
      setView({ tx: 24, ty: 24, zoom: 1 });
      return;
    }
    const pad = 40;
    const zoom = clamp(
      Math.min(
        (rect.width - pad * 2) / layout.width,
        (rect.height - pad * 2) / Math.max(layout.height, 1),
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    setView({
      zoom,
      tx: (rect.width - layout.width * zoom) / 2,
      ty: pad,
    });
  }, [layout.width, layout.height]);

  const zoomBy = useCallback((factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = (rect?.width ?? 0) / 2;
    const cy = (rect?.height ?? 0) / 2;
    setView((v) => {
      const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const k = zoom / v.zoom;
      return { zoom, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  }, []);

  // Centre la vue sur un nœud (recherche).
  const focusNode = useCallback(
    (id: string) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const p = layout.positions[id];
      if (!rect || !p) return;
      const zoom = clamp(Math.max(view.zoom, 0.8), MIN_ZOOM, MAX_ZOOM);
      setView({
        zoom,
        tx: rect.width / 2 - (p.x + NODE_W / 2) * zoom,
        ty: rect.height / 2 - (p.y + NODE_H / 2) * zoom,
      });
      onSelect(id);
      setSearchOpen(false);
      setSearch("");
    },
    [layout.positions, view.zoom, onSelect],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return Object.values(content.nodes)
      .filter((n) => nodeLabel(n).toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, content.nodes]);

  const isEmpty = Object.keys(content.nodes).length === 0;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Barre d'outils */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            className="flex size-10 items-center justify-center rounded-lg border bg-background/95 text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Rechercher un nœud"
            aria-label="Rechercher un nœud"
          >
            <SearchIcon className="size-4" />
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-11 w-72 rounded-lg border bg-popover p-1.5 shadow-lg">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom du nœud…"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchResults.length > 0 && (
                <div className="mt-1 max-h-60 overflow-y-auto">
                  {searchResults.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => focusNode(n.id)}
                      className="flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {n.type[0]}
                      </span>
                      <span className="truncate">{nodeLabel(n)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center rounded-lg border bg-background/95 shadow-sm">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.2)}
            className="flex size-10 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Dézoomer"
            aria-label="Dézoomer"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {Math.round(view.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            className="flex size-10 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Zoomer"
            aria-label="Zoomer"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={fit}
          className="flex size-10 items-center justify-center rounded-lg border bg-background/95 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Ajuster à l'écran"
          aria-label="Ajuster l’arbre à l’écran"
        >
          <Crosshair className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setView({ tx: 24, ty: 24, zoom: 1 })}
          className="flex size-10 items-center justify-center rounded-lg border bg-background/95 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Réinitialiser la vue"
          aria-label="Réinitialiser la vue"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      {isEmpty ? (
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Arbre vide. Ajoutez une question racine pour commencer.
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <svg className="h-full w-full" role="tree" aria-label="Arbre de décision interactif">
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.zoom})`}>
              {/* Arêtes */}
              {layout.edges.map((e, i) => {
                const from = nodePos(e.from);
                const to = nodePos(e.to);
                const x1 = from.x + NODE_W / 2;
                const y1 = from.y + NODE_H;
                const x2 = to.x + NODE_W / 2;
                const y2 = to.y;
                const midY = (y1 + y2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* Nœuds */}
              {Object.keys(layout.positions).map((id) => {
                const node = content.nodes[id];
                if (!node) return null;
                const pos = nodePos(id);
                const sev = violations?.get(id);
                return (
                  <foreignObject
                    key={id}
                    x={pos.x}
                    y={pos.y}
                    width={NODE_W}
                    height={NODE_H}
                  >
                    <div
                      data-node={id}
                      onPointerDown={(e) => onNodePointerDown(e, id)}
                      role="treeitem"
                      aria-selected={selectedId === id}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(id);
                        }
                      }}
                      className={cn(
                        "flex size-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        nodeColor(node.type),
                        selectedId === id && "ring-2 ring-primary ring-offset-1",
                        sev === "error" && "border-red-500 ring-1 ring-red-500/50",
                        sev === "warning" &&
                          selectedId !== id &&
                          "border-amber-500 ring-1 ring-amber-500/40",
                      )}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">
                        {node.type === "question"
                          ? "Question"
                          : node.type === "option"
                            ? "Réponse"
                            : "Résultat"}
                      </span>
                      <span className="line-clamp-2 w-full text-[12.5px] font-medium leading-tight">
                        {nodeLabel(node)}
                      </span>
                    </div>
                  </foreignObject>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function nodeColor(type: string): string {
  if (type === "question") return "border-primary/30 bg-primary/5 text-foreground";
  if (type === "option") return "border-border bg-card text-foreground";
  return "border-emerald-500/30 bg-emerald-500/5 text-foreground";
}

function nodeLabel(node: DecisionTreeContent["nodes"][string]): string {
  if (node.type === "question") return (node as QuestionNode).text;
  if (node.type === "option") return (node as OptionNode).label;
  return (node as ResultNode).title;
}

interface Layout {
  positions: Record<string, { x: number; y: number }>;
  edges: { from: string; to: string }[];
  width: number;
  height: number;
}

/// Layout par niveaux (BFS depth) + surcharge par les positions manuelles.
function computeLayout(content: DecisionTreeContent): Layout {
  const nodes = content.nodes;
  const depth = new Map<string, number>();
  const order: string[][] = [];

  function place(id: string, d: number) {
    depth.set(id, d);
    if (!order[d]) order[d] = [];
    order[d].push(id);
  }

  if (content.rootNodeId && nodes[content.rootNodeId]) {
    const queue: string[] = [content.rootNodeId];
    place(content.rootNodeId, 0);
    while (queue.length) {
      const id = queue.shift()!;
      const node = nodes[id];
      if (!node) continue;
      for (const next of outgoing(node)) {
        if (!nodes[next]) continue;
        if (!depth.has(next)) {
          place(next, (depth.get(id) ?? 0) + 1);
          queue.push(next);
        }
      }
    }
  }

  const detached = Object.keys(nodes).filter((id) => !depth.has(id));
  if (detached.length) {
    const d = order.length;
    for (const id of detached) place(id, d);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  let maxRowWidth = 0;
  order.forEach((row) => {
    const rowWidth = row.length * NODE_W + (row.length - 1) * H_GAP;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
  });
  order.forEach((row, d) => {
    const rowWidth = row.length * NODE_W + (row.length - 1) * H_GAP;
    const offset = (maxRowWidth - rowWidth) / 2;
    row.forEach((id, i) => {
      positions[id] = {
        x: offset + i * (NODE_W + H_GAP),
        y: d * (NODE_H + V_GAP),
      };
    });
  });

  // Surcharge par positions manuelles.
  for (const [id, pos] of Object.entries(content.positions ?? {})) {
    if (positions[id]) positions[id] = { x: pos.x, y: pos.y };
  }

  // Bornes (avec positions manuelles incluses).
  let width = 0;
  let height = 0;
  for (const p of Object.values(positions)) {
    width = Math.max(width, p.x + NODE_W);
    height = Math.max(height, p.y + NODE_H);
  }

  const edges: { from: string; to: string }[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    for (const next of outgoing(node)) {
      if (nodes[next]) edges.push({ from: id, to: next });
    }
  }

  return { positions, edges, width, height };
}
