"use client";

/// Visualisation de l'arbre (SVG). Layout vertical figé par BFS depuis la
/// racine (V1 : pas de positions persistées, pas de drag). Clic sur un nœud =
/// sélection. Les nœuds en violation sont entourés de rouge (erreur) ou ambre
/// (warning). cf. plan : layout déterministe, robuste, à faible risque.

import { useMemo } from "react";
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
const PAD = 24;

type Severity = "error" | "warning";

interface Props {
  content: DecisionTreeContent;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /// nodeId → sévérité la plus grave (pour le surlignage).
  violations?: Map<string, Severity>;
}

function outgoing(node: DecisionTreeContent["nodes"][string]): string[] {
  if (node.type === "question") return node.optionIds;
  if (node.type === "option") return [node.nextId];
  return [];
}

export function DecisionCanvas({ content, selectedId, onSelect, violations }: Props) {
  const layout = useMemo(() => computeLayout(content), [content]);

  if (Object.keys(content.nodes).length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Arbre vide. Ajoutez une question racine pour commencer.
      </div>
    );
  }

  const width = layout.width + PAD * 2;
  const height = layout.height + PAD * 2;

  return (
    <div className="h-full w-full overflow-auto">
      <svg width={width} height={height} className="block">
        {/* Arêtes */}
        {layout.edges.map((e, i) => {
          const from = layout.positions[e.from];
          const to = layout.positions[e.to];
          if (!from || !to) return null;
          const x1 = from.x + NODE_W / 2 + PAD;
          const y1 = from.y + NODE_H + PAD;
          const x2 = to.x + NODE_W / 2 + PAD;
          const y2 = to.y + PAD;
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
        {Object.entries(layout.positions).map(([id, pos]) => {
          const node = content.nodes[id];
          if (!node) return null;
          const sev = violations?.get(id);
          return (
            <foreignObject
              key={id}
              x={pos.x + PAD}
              y={pos.y + PAD}
              width={NODE_W}
              height={NODE_H}
            >
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={cn(
                  "flex size-full flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-1.5 text-left transition",
                  nodeColor(node.type),
                  selectedId === id && "ring-2 ring-primary ring-offset-1",
                  sev === "error" && "border-red-500 ring-1 ring-red-500/50",
                  sev === "warning" &&
                    !selectedId &&
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
              </button>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}

function nodeColor(type: string): string {
  if (type === "question")
    return "border-primary/30 bg-primary/5 text-foreground";
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

/// Layout par niveaux (BFS depth). Les nœuds non atteignables sont placés sur
/// une rangée supplémentaire en bas.
function computeLayout(content: DecisionTreeContent): Layout {
  const nodes = content.nodes;
  const depth = new Map<string, number>();
  const order: string[][] = [];

  function place(id: string, d: number) {
    depth.set(id, d);
    if (!order[d]) order[d] = [];
    order[d].push(id);
  }

  // BFS depuis la racine.
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

  // Nœuds détachés (non atteignables) → rangée du bas.
  const detached = Object.keys(nodes).filter((id) => !depth.has(id));
  if (detached.length) {
    const d = order.length;
    for (const id of detached) place(id, d);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  let maxRowWidth = 0;
  order.forEach((row, d) => {
    const rowWidth = row.length * NODE_W + (row.length - 1) * H_GAP;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
    row.forEach((id, i) => {
      positions[id] = { x: i * (NODE_W + H_GAP), y: d * (NODE_H + V_GAP) };
    });
  });

  // Centre chaque rangée par rapport à la plus large.
  order.forEach((row) => {
    const rowWidth = row.length * NODE_W + (row.length - 1) * H_GAP;
    const offset = (maxRowWidth - rowWidth) / 2;
    row.forEach((id) => {
      positions[id].x += offset;
    });
  });

  const edges: { from: string; to: string }[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    for (const next of outgoing(node)) {
      if (nodes[next]) edges.push({ from: id, to: next });
    }
  }

  return {
    positions,
    edges,
    width: maxRowWidth,
    height: order.length * NODE_H + (order.length - 1) * V_GAP,
  };
}
