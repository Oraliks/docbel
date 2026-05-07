"use client";

import { useEffect, useState } from "react";
import { NewspaperIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { NewsItem } from "@/lib/docbel-data";

interface ActualitesPageProps {
  onArticleClick?: (article: NewsItem) => void;
  initialArticles?: NewsItem[];
}

type SortOrder = "recent" | "popular";

export function ActualitesPage({ onArticleClick, initialArticles }: ActualitesPageProps) {
  const [articles, setArticles] = useState<NewsItem[]>(initialArticles ?? []);
  const [loading, setLoading] = useState(initialArticles === undefined);
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [sortBy, setSortBy] = useState<SortOrder>("recent");
  const [page, setPage] = useState(0);
  const [email, setEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const perPage = 6;

  useEffect(() => {
    if (initialArticles !== undefined) return;
    const fetchArticles = async () => {
      try {
        const response = await fetch("/api/news?status=published&limit=100");
        if (!response.ok) {
          setArticles([]);
          return;
        }

        const data = await response.json();
        const mappedArticles = (data.articles || []).map(
          (article: {
            id: string;
            category: string;
            title: string;
            excerpt: string;
            publishedAt: string | null;
            color?: string;
            readingTime?: number;
            featured?: boolean;
            image?: string | null;
            content?: string;
          }) => ({
            id: article.id,
            tag: article.category,
            title: article.title,
            desc: article.excerpt,
            date: article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "",
            color: article.color || "#C8102E",
            readingTime: article.readingTime,
            popular: article.featured || false,
            image: article.image || undefined,
            content: article.content,
          })
        );

        setArticles(mappedArticles);
      } catch (error) {
        console.error("Error fetching articles:", error);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchArticles();
  }, [initialArticles]);

  const categories = ["Tous", ...Array.from(new Set(articles.map((item) => item.tag)))];

  const filteredArticles = articles.filter((item) => {
    const matchesCategory = selectedCategory === "Tous" || item.tag === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const sortedArticles = [...filteredArticles].sort((left, right) => {
    if (sortBy === "popular") {
      return Number(right.popular) - Number(left.popular);
    }

    return 0;
  });

  const featuredArticles = sortedArticles.filter((item) => item.popular).slice(0, 3);
  const regularArticles = sortedArticles.filter((item) => !item.popular);
  const totalPages = Math.max(1, Math.ceil(regularArticles.length / perPage));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleArticles = regularArticles.slice(currentPage * perPage, (currentPage + 1) * perPage);

  const handleSubscribe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Veuillez entrer une adresse email valide.");
      return;
    }

    setNewsletterLoading(true);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Une erreur est survenue.");
        return;
      }

      setEmail("");
      toast.success("Inscription confirmee. Vous recevrez les prochaines actualites.");
    } catch {
      toast.error("Une erreur est survenue. Veuillez reessayer.");
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-3xl">Actualites</CardTitle>
            <CardDescription>
              Suivez les informations utiles, les reformes et les changements administratifs.
            </CardDescription>
          </div>
          <Badge variant="secondary">{filteredArticles.length} article(s)</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Rechercher un article..."
                className="pl-9"
              />
            </div>

            <Select
              value={sortBy}
              onValueChange={(value) => {
                if (!value) return;
                setSortBy(value as SortOrder);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="recent">Les plus recents</SelectItem>
                  <SelectItem value="popular">Les plus populaires</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <ToggleGroup
            value={[selectedCategory]}
            onValueChange={(value) => {
              const nextValue = value[0];
              if (!nextValue) return;
              setSelectedCategory(nextValue);
              setPage(0);
            }}
            variant="outline"
            size="sm"
            className="flex-wrap"
            spacing={1}
          >
            {categories.map((category) => (
              <ToggleGroupItem key={category} value={category}>
                {category}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>

      {!loading && filteredArticles.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NewspaperIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun article trouve</EmptyTitle>
            <EmptyDescription>
              Essayez une autre categorie ou changez votre recherche.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {featuredArticles.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">Articles mis en avant</h2>
                <Badge variant="secondary">{featuredArticles.length}</Badge>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {featuredArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} featured onOpen={onArticleClick} />
                ))}
              </div>
            </section>
          )}

          {visibleArticles.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold tracking-tight">Derniers articles</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} onOpen={onArticleClick} />
                ))}
              </div>
            </section>
          )}

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text="Precedent"
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
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Restez informe</CardTitle>
          <CardDescription>
            Recevez les prochains articles et rappels utiles directement dans votre boite mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="newsletter-email">Adresse e-mail</FieldLabel>
              <Input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vous@exemple.be"
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Pas de spam. Seulement les nouvelles importantes.
          </span>
          <Button onClick={handleSubscribe} disabled={newsletterLoading}>
            {newsletterLoading ? "Inscription..." : "S'abonner"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ArticleCard({
  article,
  featured = false,
  onOpen,
}: {
  article: NewsItem;
  featured?: boolean;
  onOpen?: (article: NewsItem) => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="overflow-hidden transition-colors hover:border-primary/40"
      onClick={() => onOpen?.(article)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(article);
        }
      }}
    >
      <div className={`relative bg-muted ${featured ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        {article.image ? (
          // Editorial images are dynamic content and intentionally bypass next/image remote constraints.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.image} alt={article.title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <NewspaperIcon className="size-10 text-muted-foreground" />
          </div>
        )}
      </div>

      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{article.tag}</Badge>
          {article.popular && <Badge variant="secondary">Mis en avant</Badge>}
        </div>
        <CardTitle className={featured ? "text-xl" : "text-base"}>{article.title}</CardTitle>
        <CardDescription className={featured ? "line-clamp-3" : "line-clamp-2"}>
          {article.desc}
        </CardDescription>
      </CardHeader>

      <CardFooter className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{article.date}</span>
        <Button variant="ghost">Lire</Button>
      </CardFooter>
    </Card>
  );
}
