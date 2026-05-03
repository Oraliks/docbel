"use client";

import React, { useEffect, useState } from "react";
import { NewsItem } from "@/lib/docbel-data";
import { SearchIcon } from "./icons";
import { toast } from "sonner";

interface ActualitesPageProps {
  onArticleClick?: (article: NewsItem) => void;
}

export function ActualitesPage({ onArticleClick }: ActualitesPageProps) {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");
  const [page, setPage] = useState(0);
  const [email, setEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const PER_PAGE = 3; // 3 articles per page in main grid

  // Fetch published articles from API
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch("/api/news?status=published");
        if (response.ok) {
          const data = await response.json();
          const apiArticles = data.articles || [];
          const mappedArticles: NewsItem[] = apiArticles.map((article: any) => ({
            id: article.id,
            tag: article.category,
            title: article.title,
            desc: article.excerpt,
            date: article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString("fr-FR", {
                  year: "numeric", month: "short", day: "numeric"
                })
              : "",
            color: article.color || "#C8102E",
            readingTime: article.readingTime,
            popular: article.featured || false,
            image: article.image,
            content: article.content,
          }));
          setArticles(mappedArticles);
        } else {
          setArticles([]);
        }
      } catch (error) {
        console.error("Error fetching articles:", error);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const getEmoji = (tag: string): string => {
    if (tag === "Mise à jour") return "📋";
    if (tag === "Annonce ONEM") return "🏛️";
    if (tag === "CPAS") return "✍️";
    if (tag === "Réforme") return "⚖️";
    return "🔔";
  };

  const categories = ["Tous", ...Array.from(new Set(articles.map((item) => item.tag)))];

  const filtered = articles.filter((item) => {
    // Filter by category
    const categoryMatch = selectedCategory === "Tous" || item.tag === selectedCategory;
    // Filter by search query
    const searchMatch = searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase());

    return categoryMatch && searchMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "popular") {
      return (b.popular ? 1 : 0) - (a.popular ? 1 : 0);
    }
    return 0;
  });

  // Featured articles are those with popular (featured) flag enabled
  const featuredArticles = sorted.filter(a => a.popular === true).slice(0, 5);
  // Main articles are articles excluding featured (paginated)
  const mainArticles = sorted.filter(a => a.popular !== true);
  const totalPages = Math.ceil(mainArticles.length / PER_PAGE);
  const visible = mainArticles.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  useEffect(() => {
    setPage(0);
  }, [selectedCategory, sortBy]);

  // Component for article cards (reused for featured and main grid)
  const ArticleCard = ({
    item,
    featured = false,
  }: {
    item: NewsItem,
    featured?: boolean,
  }) => {
    const imageHeight = featured ? 220 : 180;
    const hasImage = item.image;

    return (
      <div
        onClick={() => onArticleClick?.(item)}
        className="bg-surface border border-border rounded-xl overflow-hidden transition-all duration-400 cubic-bezier(0.34, 1.56, 0.64, 1) flex flex-col cursor-pointer hover:shadow-xl hover:-translate-y-2"
      >
        {/* Image or fallback emoji */}
        <div
          className="w-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            height: `${imageHeight}px`,
            background: hasImage ? undefined : `${item.color}15`,
            border: hasImage ? undefined : `1px solid ${item.color}25`,
          }}
          onMouseEnter={(e) => {
            const img = (e.currentTarget as HTMLDivElement).querySelector("img");
            if (img) {
              img.style.transform = "scale(1.05)";
            }
          }}
          onMouseLeave={(e) => {
            const img = (e.currentTarget as HTMLDivElement).querySelector("img");
            if (img) {
              img.style.transform = "scale(1)";
            }
          }}
        >
          {hasImage ? (
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
              onError={(e) => {
                // Fallback to emoji if image fails to load
                const div = (e.target as HTMLImageElement).parentElement;
                if (div) {
                  div.style.background = `${item.color}15`;
                  div.style.border = `1px solid ${item.color}25`;
                  div.innerHTML = `<div style="font-size: ${featured ? 64 : 48}px">${getEmoji(item.tag)}</div>`;
                }
              }}
            />
          ) : (
            <div style={{ fontSize: featured ? 64 : 48 }}>
              {getEmoji(item.tag)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className={`flex flex-col gap-3 flex-1 ${featured ? "p-5" : "p-4"}`}>
          {/* Category Badge */}
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase w-fit rounded-sm px-2.5 py-1.5 border"
            style={{
              color: item.color,
              background: `${item.color}18`,
              borderColor: `${item.color}40`,
            }}
          >
            {item.tag}
          </div>

          {/* Title */}
          <h3
            className={`font-bold text-foreground leading-tight margin-0 ${featured ? "text-base" : "text-sm"}`}
          >
            {item.title}
          </h3>

          {/* Description (featured only) */}
          {featured && (
            <p className="text-sm text-text-muted leading-relaxed margin-0 flex-1">
              {item.desc}
            </p>
          )}

          {/* Footer - Date & Reading Time */}
          <div className={`text-xs text-text-faint flex gap-3 items-center mt-auto ${featured ? "pt-3 border-t border-border" : ""}`}>
            <span>{item.date}</span>
            {item.readingTime && <span>⏱️ {item.readingTime} min</span>}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="px-10 py-10 mb-4">
        <h1 className="text-3xl font-black text-foreground -tracking-wider m-0">
          Actualités
        </h1>
      </div>

      {/* Filters + Sort + Search */}
      <div
        className="flex items-center justify-between mb-5 flex-wrap gap-4 px-10"
      >
        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) ${
                selectedCategory === cat
                  ? "bg-accent border-accent text-white"
                  : "border-border bg-transparent text-accent hover:border-accent hover:bg-accent/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Right side: Search + Sort */}
        <div className="flex gap-3 items-center">
          {/* Search Button */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all duration-300 ${
              showSearch
                ? "bg-accent border-accent text-white"
                : "border-border bg-transparent text-accent hover:border-accent hover:bg-accent/15"
            }`}
          >
            <SearchIcon size={18} />
          </button>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "popular")}
            className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm font-semibold cursor-pointer"
          >
            <option value="recent">Les plus récents</option>
            <option value="popular">Les plus populaires</option>
          </select>
        </div>
      </div>

      {/* Search Input (shown when search button is clicked) */}
      {showSearch && (
        <div className="px-10 mb-6 overflow-hidden">
          <input
            type="text"
            placeholder="Rechercher un article..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-foreground text-sm font-normal focus:border-accent focus:ring-3 focus:ring-accent/20 outline-none transition-all duration-300"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="px-10">
        {/* Empty state */}
        {!loading && articles.length === 0 && (
          <div className="text-center py-20 text-text-muted">
            <div className="text-6xl mb-4">📰</div>
            <p className="text-base font-semibold text-foreground mb-2">
              Aucun article publié pour le moment
            </p>
            <p className="text-sm">Revenez bientôt pour les dernières actualités.</p>
          </div>
        )}

        {/* Featured Articles Grid (2 columns) */}
        {featuredArticles.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 mb-10"
          >
            {featuredArticles.map((item) => (
              <ArticleCard
                key={item.id}
                item={item}
                featured={true}
              />
            ))}
          </div>
        )}

        {/* Main Articles Grid (3 columns) */}
        {visible.length > 0 && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 mb-8"
          >
            {visible.map((item) => (
              <ArticleCard
                key={item.id}
                item={item}
                featured={false}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex justify-center gap-2 flex-wrap mb-8"
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  page === i
                    ? "bg-accent border-accent text-white border"
                    : "border border-border bg-transparent text-foreground hover:border-accent hover:bg-accent/15 hover:text-accent"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Newsletter Section */}
      <div
        className="bg-surface border border-border rounded-xl px-10 py-10 mx-10 mb-10 text-center"
      >
        <h2
          className="text-xl font-black text-foreground m-0 mb-3 -tracking-wider"
        >
          Restez informé
        </h2>
        <p
          className="text-sm text-text-muted m-0 mb-5 leading-relaxed"
        >
          Recevez nos derniers articles et conseils directement dans votre boîte mail.
        </p>
        <div
          className="flex gap-3 max-w-sm mx-auto"
        >
          <input
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-surface text-foreground text-sm font-normal focus:border-accent focus:ring-3 focus:ring-accent/20 outline-none transition-all"
          />
          <button
            disabled={newsletterLoading}
            onClick={async () => {
              if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                toast.error("Veuillez entrer une adresse email valide.");
                return;
              }
              setNewsletterLoading(true);
              try {
                const res = await fetch("/api/newsletter", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                const data = await res.json();
                if (res.ok || res.status === 200) {
                  setEmail("");
                  toast.success("Inscription confirmée ! Vous recevrez nos prochaines actualités.");
                } else {
                  toast.error(data.error || "Une erreur est survenue.");
                }
              } catch {
                toast.error("Une erreur est survenue. Veuillez réessayer.");
              } finally {
                setNewsletterLoading(false);
              }
            }}
            className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold cursor-pointer transition-opacity whitespace-nowrap disabled:opacity-70 hover:opacity-90"
          >
            {newsletterLoading ? "Inscription..." : "S'abonner"}
          </button>
        </div>
      </div>
    </div>
  );
}
