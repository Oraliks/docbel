"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Move, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  FAMILY_SITUATION_VISUAL_TREE,
  type VisualTreeNode,
} from "@/lib/family-situation-tree/visual-tree";

type Viewport = { x: number; y: number; scale: number };

const NODE_HEIGHT: Record<VisualTreeNode["kind"], number> = {
  root: 100,
  question: 92,
  subtree: 108,
  detail: 190,
  "category-a": 76,
  "category-n": 76,
  "category-b": 76,
  result: 76,
  reference: 112,
};

const NODE_CLASS: Record<VisualTreeNode["kind"], string> = {
  root: "border-slate-700 bg-slate-900 text-white",
  question: "border-sky-300 bg-sky-50 text-slate-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-slate-50",
  subtree: "border-violet-200 bg-violet-50 text-slate-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-slate-50",
  detail: "border-dashed border-slate-400 bg-background text-foreground",
  "category-a": "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50",
  "category-n": "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50",
  "category-b": "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-50",
  result: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
  reference: "border-dashed border-violet-400 bg-violet-50/80 text-violet-950 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-50",
};

export function FamilySituationTree() {
  const t = useTranslations("public.pro.familySituationTree");
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<Viewport>({ x: 16, y: 24, scale: 0.32 });

  const nodesById = useMemo(
    () => new Map(FAMILY_SITUATION_VISUAL_TREE.nodes.map((node) => [node.id, node])),
    [],
  );

  function changeZoom(delta: number) {
    setView((current) => ({ ...current, scale: Math.min(0.9, Math.max(0.2, current.scale + delta)) }));
  }

  function overview() {
    const element = viewportRef.current;
    if (!element) return;
    const scale = Math.min(
      0.55,
      Math.max(0.2, Math.min(element.clientWidth / FAMILY_SITUATION_VISUAL_TREE.width, element.clientHeight / FAMILY_SITUATION_VISUAL_TREE.height) * 0.9),
    );
    setView({
      scale,
      x: (element.clientWidth - FAMILY_SITUATION_VISUAL_TREE.width * scale) / 2,
      y: Math.max(18, (element.clientHeight - FAMILY_SITUATION_VISUAL_TREE.height * scale) / 2),
    });
  }

  function focusNode(id: string) {
    const element = viewportRef.current;
    const node = nodesById.get(id);
    if (!element || !node) return;
    const scale = 0.52;
    setView({
      scale,
      x: element.clientWidth / 2 - (node.x + node.width / 2) * scale,
      y: element.clientHeight / 2 - (node.y + NODE_HEIGHT[node.kind] / 2) * scale,
    });
  }

  return (
    <section className="flex w-full flex-col gap-5">
      <header className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <p className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
            {t("prototype")}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Move className="size-4" aria-hidden />{t("navigationHelp")}</p>
        <div className="flex flex-wrap gap-2" aria-label={t("controlsLabel")}>
          <Button type="button" variant="outline" size="sm" onClick={() => changeZoom(-0.08)} aria-label={t("zoomOut")}><Minus aria-hidden />{t("zoomOut")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => changeZoom(0.08)} aria-label={t("zoomIn")}><Plus aria-hidden />{t("zoomIn")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={overview}><RotateCcw aria-hidden />{t("overview")}</Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative h-[680px] overflow-hidden rounded-xl border bg-muted/30 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        aria-label={t("diagramLabel")}
        onWheel={(event) => { event.preventDefault(); changeZoom(event.deltaY > 0 ? -0.05 : 0.05); }}
        onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const previous = drag.current;
          drag.current = { x: event.clientX, y: event.clientY };
          setView((current) => ({ ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }));
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: FAMILY_SITUATION_VISUAL_TREE.width, height: FAMILY_SITUATION_VISUAL_TREE.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <svg className="absolute inset-0 overflow-visible" width={FAMILY_SITUATION_VISUAL_TREE.width} height={FAMILY_SITUATION_VISUAL_TREE.height} aria-hidden>
            <defs><marker id="family-tree-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" className="fill-slate-500" /></marker></defs>
            {FAMILY_SITUATION_VISUAL_TREE.edges.map((edge) => {
              const from = nodesById.get(edge.from)!;
              const to = nodesById.get(edge.to)!;
              const startX = from.x + from.width / 2;
              const startY = from.y + NODE_HEIGHT[from.kind];
              const endX = to.x + to.width / 2;
              const endY = to.y;
              const middleY = startY + (endY - startY) / 2;
              return <g key={edge.id}>
                <path d={`M ${startX} ${startY} L ${startX} ${middleY} L ${endX} ${middleY} L ${endX} ${endY}`} fill="none" stroke="currentColor" className="text-slate-400" strokeWidth="3" strokeDasharray={edge.dashed ? "9 7" : undefined} markerEnd="url(#family-tree-arrow)" />
                {edge.labelKey && <text x={(startX + endX) / 2} y={middleY - 10} textAnchor="middle" className="fill-slate-700 text-[28px] font-semibold dark:fill-slate-200">{t(edge.labelKey)}</text>}
              </g>;
            })}
          </svg>
          {FAMILY_SITUATION_VISUAL_TREE.nodes.map((node) => <TreeNode key={node.id} node={node} onReference={() => focusNode("alone-subtree")} />)}
        </div>
      </div>

      <Legend />
      <p className="text-sm text-muted-foreground">{t("footnote")}</p>
    </section>
  );
}

function TreeNode({ node, onReference }: { node: VisualTreeNode; onReference: () => void }) {
  const t = useTranslations("public.pro.familySituationTree");
  const isReference = node.kind === "reference";
  const content = <>
    <p className="text-[16px] font-semibold leading-snug">{t(node.titleKey as never)}</p>
    {node.descriptionKey && <p className="mt-1 text-[13px] leading-snug opacity-80">{t(node.descriptionKey as never)}</p>}
    {node.itemsKey && <ul className="mt-3 list-disc space-y-1 pl-4 text-[12px] leading-snug opacity-85">{(t.raw(node.itemsKey as never) as string[]).map((item) => <li key={item}>{item}</li>)}</ul>}
    {["children", "parents", "mixed", "other"].includes(node.id) && <p className="mt-3 text-[12px] font-medium text-muted-foreground">{t("resultToDetail")}</p>}
  </>;
  const style = { left: node.x, top: node.y, width: node.width, minHeight: NODE_HEIGHT[node.kind] };
  const classes = `absolute rounded-xl border-2 px-5 py-4 shadow-sm ${NODE_CLASS[node.kind]}`;
  return isReference ? <button type="button" className={`${classes} cursor-pointer text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/40`} style={style} onClick={onReference}>{content}<span className="mt-2 block text-[12px] font-medium underline">{t("focusAlone")}</span></button> : <article className={classes} style={style}>{content}</article>;
}

function Legend() {
  const t = useTranslations("public.pro.familySituationTree");
  const entries: Array<[VisualTreeNode["kind"], string]> = [["question", "legendQuestion"], ["subtree", "legendSubtree"], ["category-a", "legendCategory"], ["result", "legendResult"], ["reference", "legendReference"]];
  return <section aria-label={t("legendTitle")} className="rounded-xl border bg-card p-4"><h2 className="text-sm font-semibold">{t("legendTitle")}</h2><ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">{entries.map(([kind, label]) => <li key={label} className="flex items-center gap-2"><span className={`size-3 rounded-sm border ${NODE_CLASS[kind]}`} aria-hidden />{t(label as never)}</li>)}</ul></section>;
}
