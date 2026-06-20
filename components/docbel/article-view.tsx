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
  LifeBuoyIcon,
  StarIcon,
  TagIcon,
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
  /** Catégories publiées distinctes → liste « Thématiques ». */
  categories?: string[];
  /** Illustration de la catégorie — repli du hero si l'article n'a pas d'image perso. */
  categoryIllustration?: string;
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
  categories = [],
  categoryIllustration,
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

  // Image du hero : image perso de l'article (bannière IA en priorité), sinon
  // illustration de la catégorie. Le doublon de titre éventuel est neutralisé
  // par l'overlay pastel qui fond l'image dans la carte (cf. zone droite).
  const heroImage = article.image ?? categoryIllustration;

  const hasSummary = Boolean(article.summary?.length);
  const hasDocs = Boolean(article.linkedDocs?.length);
  const hasFaqs = Boolean(article.faqs?.length);
  const hasRightRail = hasSummary || hasDocs || hasFaqs;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Grille 3 colonnes (desktop ≥ lg). Mobile → 1 colonne empilée.
          Largeur pleine : pas de max-w sur la racine (le shell 1840px borne
          déjà). ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_320px]">
        {/* ── COLONNE GAUCHE (navigation) ──────────────────────────────── */}
        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="sticky top-6 flex flex-col gap-4">
            <Link
              href="/actualites"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
            >
              <ArrowLeftIcon className="size-4" />
              Retour aux actualités
            </Link>

            {categories.length > 0 ? (
              <nav className="glass-surface flex flex-col gap-1 p-4">
                <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                  <TagIcon className="size-3" />
                  Thématiques
                </p>
                {categories.map((cat) => {
                  const active = cat === article.tag;
                  return (
                    <Link
                      key={cat}
                      href={`/actualites?cat=${encodeURIComponent(cat)}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] ${
                        active
                          ? "bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-ink)]"
                          : "text-[color:var(--glass-ink-soft)] hover:bg-white/45 hover:text-[color:var(--glass-ink)]"
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      {active ? (
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: "var(--glass-accent-deep)" }}
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            {/* Besoin d'aide ? → route /contact (vérifiée existante). */}
            <Link
              href="/contact"
              className="glass-surface group flex flex-col gap-2 p-4 outline-none transition-colors hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
            >
              <span
                className="flex size-9 items-center justify-center rounded-xl"
                style={{
                  background:
                    "color-mix(in oklab, var(--glass-accent-deep) 16%, transparent)",
                  color: "var(--glass-accent-deep)",
                }}
              >
                <LifeBuoyIcon className="size-[18px]" />
              </span>
              <span className="text-[13.5px] font-bold text-[color:var(--glass-ink)]">
                Besoin d&apos;aide ?
              </span>
              <span className="text-[12px] leading-[1.45] text-[color:var(--glass-ink-soft)]">
                Une question sur vos démarches&nbsp;? Contactez un conseiller.
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--glass-accent-deep)]">
                Nous contacter
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </aside>

        {/* ── COLONNE CENTRALE (contenu principal) ─────────────────────── */}
        <article className="flex min-w-0 flex-col gap-6">
          {/* Retour : visible uniquement quand la nav gauche est masquée. */}
          <Link
            href="/actualites"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] lg:hidden"
          >
            <ArrowLeftIcon className="size-4" />
            Toutes les actualités
          </Link>

          <div className="glass-surface flex flex-col overflow-hidden">
            {/* ── HERO — carte éditoriale 2 zones, fusion par overlays ─────
                Gauche : badge, titre, méta, À retenir (compact), boutons icônes.
                Droite : image intégrée (radial gradient derrière + overlay
                pastel fondu vers la gauche). Bords arrondis via overflow-hidden
                de la carte parente. ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 items-stretch lg:grid-cols-[1.45fr_minmax(0,1fr)]">
              {/* ── GAUCHE : contenu textuel ─────────────────────────────── */}
              <div className="flex flex-col gap-3 p-6 sm:p-7">
                <CategoryBadge>{article.tag}</CategoryBadge>

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

              {/* ── DROITE : image intégrée (overlays de fusion) ─────────── */}
              <div
                className="relative flex aspect-[5/4] items-center justify-center overflow-hidden sm:aspect-auto sm:h-full sm:min-h-[280px]"
                aria-hidden={heroImage ? undefined : true}
              >
                {/* Radial gradient pastel derrière l'image */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at 60% 50%, color-mix(in oklab, var(--glass-accent-deep) 14%, transparent) 0%, transparent 65%)",
                  }}
                />

                {heroImage ? (
                  /* `object-contain` par défaut : adapté aux illustrations IA
                     et aux PNG transparents (pas de crop). Pour des photos,
                     l'image conservera ses marges, ce qui reste propre. */
                  <SmartImage
                    src={heroImage}
                    alt=""
                    fit="contain"
                    fallbackMode="hide"
                    className="relative z-[1] size-full max-h-[320px] p-4 sm:p-6"
                    imgClassName="object-contain object-center"
                  />
                ) : (
                  /* Fallback : pastel + icône document — pas d'image cassée. */
                  <FileTextIcon
                    className="relative z-[1] size-20 opacity-40"
                    style={{ color: "var(--glass-accent-deep)" }}
                  />
                )}

                {/* Overlay pastel fondant l'image dans la carte (bord gauche
                    + léger voile global) → pas de rectangle brutal. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to right, var(--glass-surface) 0%, color-mix(in oklab, var(--glass-surface) 35%, transparent) 22%, transparent 55%)",
                  }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 60%, color-mix(in oklab, var(--glass-surface) 35%, transparent) 100%)",
                  }}
                />
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
          <aside className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
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
