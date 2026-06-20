"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  FileTextIcon,
  StarIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { NewsItem } from "@/lib/docbel-data";
import { enrichHtmlWithAcronyms } from "@/lib/acronyms-html";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { AcronymText } from "@/components/docbel/acronym";
import { ShareMenu } from "./share-menu";
import { SmartImage } from "@/components/ui/smart-image";

interface ArticleViewProps {
  article: NewsItem;
  /** 3 articles « À lire aussi » (même catégorie, fallback récents). */
  related?: NewsItem[];
  /**
   * Illustration dédiée du hero, définie par article (champ heroIllustration
   * en base) — SEULE source du visuel de hero. Ne jamais confondre avec
   * article.image qui est la thumbnail/bannière OG réservée aux listes.
   */
  articleHeroIllustration?: string;
  // Kept for API compatibility with the route. Unused — glass tokens drive
  // the accent now.
  accent?: string;
}

const BOOKMARK_PREFIX = "docbel:bookmark:";
const CONTENT_ANCHOR = "article-content";

/** Badge de catégorie réutilisé (header + cartes liées). */
function CategoryBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]"
      style={{ background: "var(--glass-ink)", color: "var(--glass-bg-a)" }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: "var(--glass-accent-c)" }}
      />
      {children}
    </span>
  );
}

export function ArticleView({
  article,
  related = [],
  articleHeroIllustration,
}: ArticleViewProps) {
  // Enrichit l'HTML rich-text avec les <abbr> du glossaire. Mémoïsé
  // pour ne pas re-tokeniser à chaque re-render (le contenu d'un
  // article ne change pas pendant la vie de la page).
  const enrichedContent = useMemo(
    () => (article.content ? enrichHtmlWithAcronyms(sanitizeHtml(article.content)) : ""),
    [article.content],
  );

  // « Enregistrer » : bookmark persistant en localStorage, clé par slug.
  const bookmarkKey = `${BOOKMARK_PREFIX}${article.slug ?? article.id}`;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      setSaved(window.localStorage.getItem(bookmarkKey) === "1");
    } catch {
      /* localStorage indisponible (mode privé strict) → on reste à false */
    }
  }, [bookmarkKey]);

  const toggleSaved = useCallback(() => {
    setSaved((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem(bookmarkKey, "1");
        else window.localStorage.removeItem(bookmarkKey);
      } catch {
        /* ignore */
      }
      toast.success(next ? "Article enregistré" : "Article retiré de vos enregistrements");
      return next;
    });
  }, [bookmarkKey]);

  const scrollToContent = useCallback(() => {
    document
      .getElementById(CONTENT_ANCHOR)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Image du hero = illustration ÉDITORIALE dédiée à l'article, et RIEN d'autre.
  // Plus de repli sur l'illustration de catégorie : chaque article publié porte
  // sa propre illustration (obligatoire à la publication). `article.image` reste
  // exclue (bannière « image à la une », titre/ONEM cuits → OG + vignettes).
  const heroImage = articleHeroIllustration;

  const hasSummary = Boolean(article.summary?.length);
  const hasDocs = Boolean(article.linkedDocs?.length);
  const hasFaqs = Boolean(article.faqs?.length);
  const hasRightRail = hasSummary || hasDocs || hasFaqs;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Grille 3 colonnes (desktop ≥ lg). Mobile → 1 colonne empilée.
          Largeur pleine : pas de max-w sur la racine (le shell 1840px borne
          déjà). ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── COLONNE CENTRALE (contenu principal) ─────────────────────── */}
        <article className="flex min-w-0 flex-col gap-6">
          <div className="glass-surface flex flex-col overflow-hidden">
            {/* ── HERO — image IA en COUCHE DE FOND ─────────────────────────
                Une seule carte (pas de grille texte/image). L'image IA couvre
                TOUT le hero (`absolute inset-0`, `object-cover`) avec une
                opacité réduite, surmontée d'un voile clair pour la lisibilité,
                et le contenu (titre HTML, méta, À retenir, actions) passe
                AU-DESSUS. Le titre cuit dans l'image IA devient un wash /
                texture d'ambiance, le titre HTML reste le texte principal. ── */}
            <div className="relative overflow-hidden">
              {heroImage ? (
                <>
                  {/* Image IA en COUCHE DE FOND : couvre tout, opacité réduite */}
                  <SmartImage
                    src={heroImage}
                    alt=""
                    fit="cover"
                    fallbackMode="hide"
                    className="pointer-events-none absolute inset-0 size-full"
                    imgClassName="object-cover opacity-30"
                  />
                  {/* Voile clair (couleur du hero) pour assurer la lisibilité
                      du texte HTML et adoucir le rendu de l'image en fond. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "color-mix(in oklab, var(--glass-surface) 62%, transparent)",
                    }}
                  />
                </>
              ) : null}

              {/* Contenu textuel — par-dessus la couche de fond. Pleine
                  largeur (plus de padding-right réservé). */}
              <div className="relative z-[1] flex flex-col gap-3 p-6 sm:p-7">
                <Link
                  href="/actualites"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                  style={{
                    background: `color-mix(in oklab, ${article.color ?? "var(--glass-accent-deep)"} 15%, transparent)`,
                    color: article.color ?? "var(--glass-accent-deep)",
                  }}
                >
                  <ArrowLeftIcon className="size-3" />
                  Retour aux actualités
                </Link>

                <h1 className="glass-display text-[27px] font-semibold leading-[1.05] sm:text-[40px]">
                  <AcronymText>{article.title}</AcronymText>
                </h1>

                {/* Méta : date · lecture · catégorie */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] font-medium text-[color:var(--glass-ink-soft)]">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="flex size-7 items-center justify-center rounded-lg"
                      style={{
                        background: "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
                        color: "var(--glass-accent-deep)",
                      }}
                    >
                      <CalendarIcon className="size-3.5" />
                    </span>
                    {article.date}
                  </span>

                  {article.readingTime ? (
                    <>
                      <span aria-hidden className="h-4 w-px bg-[color:var(--glass-ink-line)]" />
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="flex size-7 items-center justify-center rounded-lg"
                          style={{
                            background: "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
                            color: "var(--glass-accent-deep)",
                          }}
                        >
                          <ClockIcon className="size-3.5" />
                        </span>
                        {article.readingTime} min de lecture
                      </span>
                    </>
                  ) : null}

                  <span aria-hidden className="h-4 w-px bg-[color:var(--glass-ink-line)]" />
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="flex size-7 items-center justify-center rounded-lg"
                      style={{
                        background: "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
                        color: "var(--glass-accent-deep)",
                      }}
                    >
                      <BriefcaseIcon className="size-3.5" />
                    </span>
                    {article.tag}
                  </span>
                </div>

                {/* « À retenir » — pastille compacte (étoile) */}
                {article.keyTakeaway ? (
                  <div
                    className="flex w-fit max-w-xl items-start gap-2.5 rounded-2xl p-3"
                    style={{
                      background:
                        "color-mix(in oklab, var(--glass-accent-deep) 9%, var(--glass-surface))",
                    }}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: "color-mix(in oklab, var(--glass-accent-deep) 16%, transparent)",
                        color: "var(--glass-accent-deep)",
                      }}
                    >
                      <StarIcon className="size-4" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[12.5px] font-bold text-[color:var(--glass-accent-deep)]">
                        À retenir
                      </p>
                      <p className="text-[12.5px] leading-[1.45] text-[color:var(--glass-ink-soft)]">
                        <AcronymText>{article.keyTakeaway}</AcronymText>
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Actions — icônes SEULES (pas de label) */}
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSaved}
                    aria-pressed={saved}
                    aria-label={saved ? "Retirer des enregistrements" : "Enregistrer l'article"}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:bg-white/65 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                    style={
                      saved
                        ? {
                            background: "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                            borderColor: "color-mix(in oklab, var(--glass-accent-deep) 40%, transparent)",
                            color: "var(--glass-accent-deep)",
                          }
                        : undefined
                    }
                  >
                    <BookmarkIcon className="size-4" fill={saved ? "currentColor" : "none"} />
                  </button>
                  <ShareMenu compact title={article.title} text={article.desc} />
                </div>
              </div>
            </div>

            {/* ── Contenu de l'article (filet pleine largeur au-dessus) ──── */}
            <div className="border-t border-[color:var(--glass-ink-line)] p-6 sm:p-9">
              {article.content ? (
                <div
                  id={CONTENT_ANCHOR}
                  className="prose prose-neutral max-w-none scroll-mt-6 text-[15.5px] leading-[1.7] [&_a]:font-semibold [&_a]:text-[color:var(--glass-accent-deep)] [&_h2]:glass-display [&_h2]:mt-8 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h3]:glass-display [&_h3]:mt-6 [&_h3]:text-[20px] [&_h3]:font-semibold [&_p]:mt-4 [&_strong]:text-[color:var(--glass-ink)] dark:prose-invert"
                  style={{ color: "var(--glass-ink)" }}
                  dangerouslySetInnerHTML={{ __html: enrichedContent }}
                />
              ) : (
                <p
                  id={CONTENT_ANCHOR}
                  className="scroll-mt-6 text-[14px] text-[color:var(--glass-ink-soft)]"
                >
                  Le contenu de cet article n&apos;est pas encore disponible.
                </p>
              )}
            </div>
          </div>

          {/* ── « À lire aussi » (sous le contenu) ──────────────────────── */}
          {related.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="glass-display px-1 text-[22px] font-semibold leading-none">
                À lire aussi
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/actualites/${item.slug ?? item.id}`}
                    className="glass-surface glass-interactive group flex flex-col gap-3 p-5"
                  >
                    <CategoryBadge>{item.tag}</CategoryBadge>
                    <h3 className="text-[15px] font-bold leading-[1.3] text-[color:var(--glass-ink)]">
                      <AcronymText>{item.title}</AcronymText>
                    </h3>
                    <div className="mt-auto flex flex-wrap items-center gap-3 text-[11.5px] text-[color:var(--glass-ink-faint)]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarIcon className="size-3.5" />
                        {item.date}
                      </span>
                      {item.readingTime ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ClockIcon className="size-3.5" />
                          {item.readingTime} min
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        {/* ── COLONNE DROITE (sticky desktop). Chaque carte = données non
            vides uniquement. ──────────────────────────────────────────── */}
        {hasRightRail ? (
          <aside className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-4 xl:sticky xl:top-6">
              {/* Résumé en 30 sec */}
              {hasSummary ? (
                <div className="glass-surface flex flex-col gap-3 p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                    Résumé en 30 sec
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {article.summary!.map((point, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background:
                              "color-mix(in oklab, var(--glass-accent-deep) 16%, transparent)",
                            color: "var(--glass-accent-deep)",
                          }}
                        >
                          <CheckIcon className="size-3" strokeWidth={3} />
                        </span>
                        <span className="text-[13px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                          <AcronymText>{point}</AcronymText>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {article.content ? (
                    <button
                      type="button"
                      onClick={scrollToContent}
                      className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                    >
                      Voir le résumé détaillé
                      <ArrowRightIcon className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Documents liés */}
              {hasDocs ? (
                <div className="glass-surface flex flex-col gap-3 p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                    Documents liés
                  </p>
                  <div className="flex flex-col gap-1">
                    {article.linkedDocs!.map((doc, i) => {
                      const isPdf = /\.pdf(\?|#|$)/i.test(doc.url);
                      return (
                        <a
                          key={i}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 rounded-xl px-2.5 py-2 outline-none transition-colors hover:bg-white/45 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                        >
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background:
                                "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
                              color: "var(--glass-accent-deep)",
                            }}
                          >
                            <FileTextIcon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[color:var(--glass-ink)]">
                            {doc.title}
                          </span>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]"
                            style={{ background: "var(--glass-surface-strong)" }}
                          >
                            {isPdf ? "PDF" : "DOC"}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Questions fréquentes — accordéon <details>/<summary>. */}
              {hasFaqs ? (
                <div className="glass-surface flex flex-col gap-2 p-5">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                    Questions fréquentes
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {article.faqs!.map((faq, i) => (
                      <details
                        key={i}
                        className="group rounded-xl border border-[color:var(--glass-ink-line)] bg-[color:var(--glass-surface)] px-3.5 py-2.5 open:bg-[color:var(--glass-surface-strong)]"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-[color:var(--glass-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] [&::-webkit-details-marker]:hidden">
                          <span>
                            <AcronymText>{faq.q}</AcronymText>
                          </span>
                          <ChevronDownIcon className="size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="mt-2 text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                          <AcronymText>{faq.a}</AcronymText>
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
