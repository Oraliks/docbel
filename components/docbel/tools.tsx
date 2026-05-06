"use client";

import { useState } from "react";
import {
  ArrowRightIcon,
  Building2Icon,
  CalculatorIcon,
  FileTextIcon,
  Grid2x2Icon,
  ListIcon,
  PauseIcon,
  RocketIcon,
  SearchIcon,
  TimerIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CATEGORIES, Tool } from "@/lib/docbel-data";

interface ToolsSectionProps {
  tools: Tool[];
  search: string;
  setSearch: (search: string) => void;
  cat: string;
  setCat: (category: string) => void;
  layout: "grid" | "list";
  setLayout: (layout: "grid" | "list") => void;
  accent: string;
  setOpenTool: (tool: Tool) => void;
}

type SortKey = "popularity" | "name" | "time";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "popularity", label: "Popularite" },
  { value: "name", label: "Nom" },
  { value: "time", label: "Temps estime" },
];

function getToolVisual(tool: Tool) {
  const title = tool.title.toLowerCase();

  if (title.includes("c4") || title.includes("c1")) {
    return {
      icon: FileTextIcon,
      tileClassName:
        "bg-linear-to-br from-violet-100 via-fuchsia-50 to-white text-violet-500 dark:from-violet-500/20 dark:via-violet-400/10 dark:to-transparent dark:text-violet-200",
    };
  }

  if (title.includes("chômage") || title.includes("chomage")) {
    return {
      icon: PauseIcon,
      tileClassName:
        "bg-linear-to-br from-sky-100 via-cyan-50 to-white text-sky-500 dark:from-sky-500/20 dark:via-sky-400/10 dark:to-transparent dark:text-sky-200",
    };
  }

  if (title.includes("préavis") || title.includes("preavis") || title.includes("calcul")) {
    return {
      icon: CalculatorIcon,
      tileClassName:
        "bg-linear-to-br from-emerald-100 via-lime-50 to-white text-emerald-500 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-transparent dark:text-emerald-200",
    };
  }

  if (title.includes("bureau") || title.includes("organisme")) {
    return {
      icon: Building2Icon,
      tileClassName:
        "bg-linear-to-br from-amber-100 via-orange-50 to-white text-amber-500 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-transparent dark:text-amber-200",
    };
  }

  return {
    icon: RocketIcon,
    tileClassName:
      "bg-linear-to-br from-rose-100 via-pink-50 to-white text-rose-500 dark:from-rose-500/20 dark:via-rose-400/10 dark:to-transparent dark:text-rose-200",
  };
}

function ToolCard({ tool, onOpen }: { tool: Tool; onOpen: (tool: Tool) => void }) {
  const visual = getToolVisual(tool);
  const Icon = visual.icon;

  return (
    <Card
      role="button"
      tabIndex={0}
      className="rounded-[20px] border-white/70 bg-white/88 shadow-[0_20px_70px_-52px_rgba(21,20,46,0.26)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/10 dark:bg-card"
      onClick={() => onOpen(tool)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(tool);
        }
      }}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex size-11 items-center justify-center rounded-xl shadow-inner ${visual.tileClassName}`}
          >
            <Icon className="size-5.5" />
          </div>
          {tool.popular ? (
            <Badge className="rounded-full border-0 bg-rose-50 px-2.5 py-0.5 text-[0.64rem] font-semibold text-rose-500 dark:bg-rose-500/15 dark:text-rose-200">
              Populaire
            </Badge>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold leading-tight text-balance">{tool.title}</h3>
          <p className="min-h-12 text-[13px] leading-5 text-muted-foreground">{tool.desc}</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 text-[13px]">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <TimerIcon className="size-4" />
            {tool.time}
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-primary">
            Utiliser
            <ArrowRightIcon className="size-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ToolListRow({ tool, onOpen }: { tool: Tool; onOpen: (tool: Tool) => void }) {
  const visual = getToolVisual(tool);
  const Icon = visual.icon;

  return (
    <Card
      role="button"
      tabIndex={0}
      className="rounded-[18px] border-white/70 bg-white/88 shadow-[0_20px_70px_-52px_rgba(21,20,46,0.26)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/10 dark:bg-card"
      onClick={() => onOpen(tool)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(tool);
        }
      }}
    >
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl shadow-inner ${visual.tileClassName}`}
          >
            <Icon className="size-5.5" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{tool.title}</h3>
              {tool.popular ? (
                <Badge className="rounded-full border-0 bg-rose-50 px-2.5 py-0.5 text-[0.64rem] font-semibold text-rose-500 dark:bg-rose-500/15 dark:text-rose-200">
                  Populaire
                </Badge>
              ) : null}
            </div>
            <p className="text-[13px] leading-5 text-muted-foreground">{tool.desc}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 md:justify-end">
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[12px] font-medium">
            {tool.cat}
          </Badge>
          <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
            <TimerIcon className="size-4" />
            {tool.time}
          </span>
          <Button variant="ghost" className="font-semibold text-primary">
            Utiliser
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ToolsSection({
  tools,
  search,
  setSearch,
  cat,
  setCat,
  layout,
  setLayout,
  setOpenTool,
}: ToolsSectionProps) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortKey>("popularity");
  const perPage = layout === "grid" ? 6 : 4;

  const sortedTools = [...tools].sort((left, right) => {
    if (sort === "popularity") {
      return Number(right.popular) - Number(left.popular);
    }

    if (sort === "name") {
      return left.title.localeCompare(right.title, "fr");
    }

    return parseInt(left.time, 10) - parseInt(right.time, 10);
  });

  const totalPages = Math.max(1, Math.ceil(sortedTools.length / perPage));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleTools = sortedTools.slice(currentPage * perPage, (currentPage + 1) * perPage);

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Services</p>
            <h2 className="text-2xl font-semibold tracking-tight lg:text-[2rem]">Catalogue d&apos;outils</h2>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <span className="text-[13px] font-medium text-muted-foreground">
              {tools.length} resultat{tools.length > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-white/80 p-1 shadow-sm dark:bg-card">
              <ToggleGroup
                value={[layout]}
                onValueChange={(value) => {
                  const nextValue = value[0];
                  if (nextValue === "grid" || nextValue === "list") {
                    setLayout(nextValue);
                    setPage(0);
                  }
                }}
                variant="default"
                size="sm"
                spacing={1}
              >
                <ToggleGroupItem value="grid" aria-label="Vue grille" className="rounded-full">
                  <Grid2x2Icon />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Vue liste" className="rounded-full">
                  <ListIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_190px]">
          <div className="flex flex-col gap-3">
            <div className="relative max-w-md">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="Rechercher un outil..."
                className="h-10 rounded-xl border-white/70 bg-white/88 pl-10 text-[13px] shadow-[0_18px_60px_-52px_rgba(21,20,46,0.35)] dark:border-white/10 dark:bg-card"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((category) => {
                const active = category === cat;

                return (
                  <Button
                    key={category}
                    type="button"
                    variant={active ? "secondary" : "outline"}
                    size="sm"
                    className={`rounded-xl px-3 text-[12px] ${
                      active
                        ? "border-rose-100 bg-rose-50 text-primary hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100"
                        : "border-white/70 bg-white/80 hover:bg-white dark:border-white/10 dark:bg-card"
                    }`}
                    onClick={() => {
                      setCat(category);
                      setPage(0);
                    }}
                  >
                    {category === "Tous" ? "Tous les outils" : category}
                  </Button>
                );
              })}
            </div>
          </div>

          <Select
            value={sort}
            onValueChange={(value) => {
              if (!value) return;
              setSort(value as SortKey);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-10 rounded-xl border-white/70 bg-white/88 text-[13px] shadow-[0_18px_60px_-52px_rgba(21,20,46,0.35)] dark:border-white/10 dark:bg-card">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleTools.length === 0 ? (
        <Empty className="rounded-[24px] border-white/70 bg-white/88 shadow-[0_20px_70px_-52px_rgba(21,20,46,0.26)] dark:border-white/10 dark:bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun outil ne correspond a votre recherche</EmptyTitle>
            <EmptyDescription>
              Essayez une autre categorie ou un mot-cle plus court.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : layout === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onOpen={setOpenTool} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleTools.map((tool) => (
            <ToolListRow key={tool.id} tool={tool} onOpen={setOpenTool} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text="Précédent"
                onClick={(event) => {
                  event.preventDefault();
                  setPage(Math.max(0, currentPage - 1));
                }}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  href="#"
                  isActive={index === currentPage}
                  onClick={(event) => {
                    event.preventDefault();
                    setPage(index);
                  }}
                >
                  {index + 1}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                text="Suivant"
                onClick={(event) => {
                  event.preventDefault();
                  setPage(Math.min(totalPages - 1, currentPage + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  );
}
