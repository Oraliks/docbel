"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  CalculatorIcon,
  ClockIcon,
  HeartIcon,
  SearchIcon,
  SparklesIcon,
  type LucideIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToolFavorites } from "@/hooks/useToolFavorites";
import { type Tool, getToolSlug } from "@/lib/docbel-data";
import {
  DOMAIN_BY_ID,
  TOOL_DOMAINS,
  countByDomain,
  domainForTool,
} from "@/lib/tool-categories";
import { glyphForTool } from "@/lib/tool-glyphs";

interface Props {
  tools: Tool[];
}

type View = "all" | "favorites" | "recents" | "simulations";
type Sort = "pertinents" | "recent" | "name" | "duree";

function toMinutes(time: string): number {
  const match = time.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function ToolIconTile({ tool }: { tool: Tool }) {
  const { Icon, hue } = glyphForTool(tool);

  return (
    <span
      className="glass-icon-tile flex size-12 shrink-0 items-center justify-center rounded-2xl"
      style={
        {
          background: `color-mix(in oklab, ${hue} 18%, transparent)`,
          color: hue,
          "--tile-hue": hue,
        } as CSSProperties
      }
      aria-hidden
    >
      <Icon className="size-6" strokeWidth={1.9} />
    </span>
  );
}

interface ToolCardProps {
  tool: Tool;
  favorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

function ToolCard({
  tool,
  favorite,
  onOpen,
  onToggleFavorite,
}: ToolCardProps) {
  const t = useTranslations("public.outils");
  const domainId = domainForTool(tool);
  const domain = domainId ? DOMAIN_BY_ID[domainId] : null;

  return (
    <Card className="glass-interactive h-full">
      <CardHeader>
        <ToolIconTile tool={tool} />
        <CardTitle className="mt-3 text-[17px] font-bold tracking-tight text-[color:var(--glass-ink)]">
          {tool.title}
        </CardTitle>
        <CardDescription className="line-clamp-3 leading-relaxed text-[color:var(--glass-ink-soft)]">
          {tool.desc}
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            aria-label={favorite ? t("removeFavorite") : t("saveTool")}
          >
            <HeartIcon
              className={
                favorite
                  ? "animate-heart-pop fill-current text-[color:var(--glass-accent-c)]"
                  : "text-[color:var(--glass-ink-faint)]"
              }
            />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="mt-auto flex flex-wrap items-center gap-2 text-xs text-[color:var(--glass-ink-soft)]">
        {domain ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{ background: domain.hue }}
              aria-hidden
            />
            {domain.label}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="size-3.5" aria-hidden />
          {tool.time}
        </span>
      </CardContent>

      <CardFooter className="justify-between gap-3">
        {tool.popular ? (
          <Badge variant="secondary">{t("sectionPopular")}</Badge>
        ) : (
          <span aria-hidden />
        )}
        <Button type="button" onClick={onOpen}>
          {t("open")}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function OutilsCatalogClient({ tools }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("public.outils");
  const { favorites, recents, isFavorite, toggleFavorite, pushRecent } =
    useToolFavorites();

  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("pertinents");

  const domainCounts = useMemo(() => countByDomain(tools), [tools]);

  const openTool = useCallback(
    (tool: Tool) => {
      pushRecent(getToolSlug(tool));
      router.push(tool.href ?? `/outils/${getToolSlug(tool)}`);
    },
    [pushRecent, router],
  );

  const filteredTools = useMemo(() => {
    let list = tools;

    if (view === "favorites") {
      list = list.filter((tool) => favorites.includes(getToolSlug(tool)));
    } else if (view === "recents") {
      list = list.filter((tool) => recents.includes(getToolSlug(tool)));
    } else if (view === "simulations") {
      list = list.filter((tool) => tool.type?.startsWith("calc_"));
    }

    if (selectedDomain) {
      list = list.filter((tool) => domainForTool(tool) === selectedDomain);
    }

    const query = search.trim().toLocaleLowerCase(locale);
    if (query) {
      list = list.filter(
        (tool) =>
          tool.title.toLocaleLowerCase(locale).includes(query) ||
          tool.desc.toLocaleLowerCase(locale).includes(query),
      );
    }

    const sorted = [...list];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title, locale));
        break;
      case "duree":
        sorted.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
        break;
      case "recent":
        sorted.sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        );
        break;
      default:
        sorted.sort((a, b) => Number(b.popular) - Number(a.popular));
    }

    return sorted;
  }, [favorites, locale, recents, search, selectedDomain, sort, tools, view]);

  const viewOptions: Array<{
    value: View;
    label: string;
    Icon: LucideIcon;
  }> = [
    { value: "all", label: t("viewAll"), Icon: SparklesIcon },
    { value: "favorites", label: t("quickFavorites"), Icon: HeartIcon },
    { value: "recents", label: t("quickHistory"), Icon: ClockIcon },
    {
      value: "simulations",
      label: t("quickSimulations"),
      Icon: CalculatorIcon,
    },
  ];

  const viewLabels: Record<View, string> = {
    all: t("viewAll"),
    favorites: t("viewFavorites"),
    recents: t("viewRecents"),
    simulations: t("viewSimulations"),
  };

  const hasActiveFilter =
    view !== "all" || selectedDomain !== null || search.trim() !== "";

  const resetFilters = () => {
    setView("all");
    setSelectedDomain(null);
    setSearch("");
    setSort("pertinents");
  };

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      <section className="glass-surface outils-rise grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:p-9">
        <header className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            {t("catalogEyebrow")}
          </p>
          <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
            {t.rich("catalogTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">
            {t("catalogIntro")}
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <label htmlFor="tool-catalog-search" className="sr-only">
            {t("searchPlaceholder")}
          </label>
          <InputGroup className="search-glow h-14 rounded-2xl">
            <InputGroupInput
              id="tool-catalog-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="text-[15px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)]"
            />
            <InputGroupAddon className="pl-4 text-[color:var(--glass-ink-faint)]">
              <SearchIcon />
            </InputGroupAddon>
            {search ? (
              <InputGroupAddon align="inline-end" className="pr-3">
                <InputGroupButton
                  size="icon-sm"
                  onClick={() => setSearch("")}
                  aria-label={t("reset")}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>

          <ToggleGroup
            value={[view]}
            onValueChange={(values) => {
              const nextView = values[0] as View | undefined;
              if (nextView) setView(nextView);
            }}
            variant="outline"
            spacing={2}
            className="w-full flex-wrap justify-start"
            aria-label={t("quickAccess")}
          >
            {viewOptions.map(({ value, label, Icon }) => (
              <ToggleGroupItem key={value} value={value}>
                <Icon data-icon="inline-start" />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </section>

      <section
        className="glass-surface outils-rise flex flex-col gap-4 p-4 sm:p-6"
        style={{ animationDelay: "80ms" }}
        aria-labelledby="tool-categories-title"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="tool-categories-title" className="text-base font-bold">
              {t("sectionCategories")}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--glass-ink-faint)]">
              {t("toolsShown", { count: tools.length })}
            </p>
          </div>
          {selectedDomain ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDomain(null)}
            >
              <XIcon data-icon="inline-start" />
              {t("removeFilter")}
            </Button>
          ) : null}
        </div>

        <ToggleGroup
          value={[selectedDomain ?? "all"]}
          onValueChange={(values) => {
            const nextDomain = values[0];
            if (nextDomain) {
              setSelectedDomain(nextDomain === "all" ? null : nextDomain);
            }
          }}
          variant="outline"
          spacing={2}
          className="grid w-full grid-cols-2 items-stretch sm:grid-cols-3 xl:grid-cols-7"
          aria-label={t("sectionCategories")}
        >
          <ToggleGroupItem
            value="all"
            className="glass-interactive h-auto min-h-20 flex-col items-start gap-2 text-left"
          >
            <SparklesIcon aria-hidden />
            <span className="font-semibold">{t("viewAll")}</span>
            <span className="text-xs text-[color:var(--glass-ink-faint)]">
              {t("toolsCount", { count: tools.length })}
            </span>
          </ToggleGroupItem>

          {TOOL_DOMAINS.map((domain) => (
            <ToggleGroupItem
              key={domain.id}
              value={domain.id}
              className="glass-interactive h-auto min-h-20 flex-col items-start gap-2 text-left"
            >
              <domain.Icon style={{ color: domain.hue }} aria-hidden />
              <span className="font-semibold">{domain.label}</span>
              <span className="text-xs text-[color:var(--glass-ink-faint)]">
                {t("toolsCount", { count: domainCounts[domain.id] ?? 0 })}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section
        className="outils-rise flex flex-col gap-4"
        style={{ animationDelay: "160ms" }}
        aria-labelledby="tool-results-title"
      >
        <div className="glass-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 id="tool-results-title" className="text-lg font-bold">
              {viewLabels[view]}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--glass-ink-faint)]" aria-live="polite">
              {t("toolsShown", { count: filteredTools.length })}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {hasActiveFilter ? (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                <XIcon data-icon="inline-start" />
                {t("reset")}
              </Button>
            ) : null}
            <span id="tool-sort-label" className="sr-only">
              {t("sortBy")}
            </span>
            <Select
              value={sort}
              onValueChange={(value) => {
                if (value) setSort(value as Sort);
              }}
            >
              <SelectTrigger
                className="w-full sm:w-44"
                aria-labelledby="tool-sort-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="pertinents">{t("sortRelevant")}</SelectItem>
                  <SelectItem value="recent">{t("sortRecent")}</SelectItem>
                  <SelectItem value="name">{t("sortName")}</SelectItem>
                  <SelectItem value="duree">{t("sortDuration")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredTools.length === 0 ? (
          <Empty className="glass-surface py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>{t("noMatch")}</EmptyTitle>
              <EmptyDescription>{t("noMatchHint")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" onClick={resetFilters}>
                {t("reset")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTools.map((tool) => {
              const slug = getToolSlug(tool);
              return (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  favorite={isFavorite(slug)}
                  onOpen={() => openTool(tool)}
                  onToggleFavorite={() => toggleFavorite(slug)}
                />
              );
            })}
          </div>
        )}
      </section>

      <aside className="glass-feedback flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" data-tone="info">
        <div>
          <h2 className="font-bold text-[color:var(--glass-ink)]">
            {t("helpTitle")}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--glass-ink-soft)]">
            {t("helpBody")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/mon-dossier")}
        >
          {t("helpStart")}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </aside>
    </div>
  );
}
