"use client";

import { useRouter } from "next/navigation";

export interface GraphNode {
  riolexId: string;
  articleNumber: string;
  loi: string;
  kind: "cite" | "corr";
}

/**
 * Carte des liens : petit graphe radial (article courant au centre, articles
 * liés autour). Représentation visuelle des renvois « cité par » + des
 * correspondances AR↔AM. SVG maison, aucune dépendance ; clic = navigation.
 */
export function CitationGraph({
  center,
  nodes,
  label,
}: {
  center: string;
  nodes: GraphNode[];
  label: string;
}) {
  const router = useRouter();
  const shown = nodes.slice(0, 9);
  if (shown.length < 3) return null;

  const W = 320;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const R = 118;

  const points = shown.map((n, i) => {
    const angle = (2 * Math.PI * i) / shown.length - Math.PI / 2;
    return { n, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  });

  const go = (riolexId: string) =>
    router.push(`/partenaire/reglementation/${encodeURIComponent(riolexId)}`);

  return (
    <details className="rounded-lg border bg-muted/20 p-3 print:hidden">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <div className="mt-2 flex justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-sm" role="img">
          {/* Arêtes */}
          {points.map((p) => (
            <line
              key={`e-${p.n.riolexId}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              className="stroke-border"
              strokeWidth={1.5}
            />
          ))}
          {/* Nœuds voisins */}
          {points.map((p) => (
            <g
              key={p.n.riolexId}
              onClick={() => go(p.n.riolexId)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={26}
                className={
                  p.n.kind === "corr"
                    ? "fill-amber-50 stroke-amber-400 hover:fill-amber-100"
                    : "fill-card stroke-primary/40 hover:fill-accent"
                }
                strokeWidth={1.5}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className="pointer-events-none fill-foreground text-[11px] font-medium"
              >
                {p.n.articleNumber}
              </text>
            </g>
          ))}
          {/* Nœud central */}
          <circle cx={cx} cy={cy} r={30} className="fill-primary" />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            className="pointer-events-none fill-primary-foreground text-[12px] font-semibold"
          >
            {center}
          </text>
        </svg>
      </div>
    </details>
  );
}
