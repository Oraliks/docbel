"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  Link2Icon,
  MailIcon,
  Share2Icon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ShareMenuProps {
  /** Titre partagé (utilisé pour navigator.share, X, mail, WhatsApp). */
  title: string;
  /** Texte court optionnel (chapeau de l'article) — corps du mail / partage natif. */
  text?: string;
  /** URL canonique COMPLÈTE. Si absente, on lit window.location.href au clic. */
  url?: string;
  /** Déclencheur compact (icône ronde seule) + popover vers le haut. */
  compact?: boolean;
  className?: string;
}

/** Résout l'URL à partager : prop explicite, sinon URL courante (SSR-safe). */
function resolveUrl(url?: string): string {
  if (url) return url;
  if (typeof window !== "undefined") return window.location.href;
  return "";
}

/** Ouvre un partage externe dans un nouvel onglet, sans fuite d'opener. */
function openExternal(href: string) {
  if (typeof window === "undefined") return;
  window.open(href, "_blank", "noopener,noreferrer");
}

/* Logos de marque officiels en SVG inline (Simple Icons, CC0) — lucide ≥1.x
   ne fournit plus de glyphes de marque, et de vrais logos rendent le menu
   nettement plus vivant qu'une icône générique. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}
function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/**
 * Menu de partage « vivant » : pastille identique au bouton « Partager »
 * d'origine + popover animé listant plusieurs plateformes + copie du lien.
 *
 * On partage toujours l'URL canonique COMPLÈTE (aucun raccourcisseur).
 * Auto-contenu : gère l'ouverture/fermeture (clic extérieur + Échap),
 * et possède sa propre micro-animation d'entrée.
 */
export function ShareMenu({ title, text, url, className, compact }: ShareMenuProps) {
  const t = useTranslations("public.article");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Web Share natif (mobile principalement) : on ne sait qu'au montage côté
  // client, pour éviter une divergence d'hydratation.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  // Fermeture : clic extérieur (mousedown) + touche Échap.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Nettoyage du timer de l'icône « copié ».
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const nativeShare = useCallback(async () => {
    const shareUrl = resolveUrl(url);
    try {
      await navigator.share({ title, text, url: shareUrl });
    } catch (err) {
      // L'utilisateur a fermé la feuille native → silence.
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      setOpen(false);
    }
  }, [title, text, url]);

  const copyLink = useCallback(async () => {
    const shareUrl = resolveUrl(url);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("shareLinkCopiedToast"));
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("shareLinkCopyError"));
    } finally {
      setOpen(false);
    }
  }, [url, t]);

  // Cibles externes (réseaux + mail). On encode systématiquement.
  const shareExternal = useCallback(
    (target: "whatsapp" | "x" | "facebook" | "linkedin" | "email") => {
      const shareUrl = resolveUrl(url);
      const encUrl = encodeURIComponent(shareUrl);
      const encTitle = encodeURIComponent(title);
      let href = "";
      switch (target) {
        case "whatsapp":
          href = `https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`;
          break;
        case "x":
          href = `https://twitter.com/intent/tweet?text=${encTitle}&url=${encUrl}`;
          break;
        case "facebook":
          href = `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`;
          break;
        case "linkedin":
          href = `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`;
          break;
        case "email": {
          const body = encodeURIComponent((text ? `${text}\n\n` : "") + shareUrl);
          href = `mailto:?subject=${encTitle}&body=${body}`;
          break;
        }
      }
      if (target === "email") {
        // mailto : on laisse le client mail prendre la main (pas de window.open).
        if (typeof window !== "undefined") window.location.href = href;
      } else {
        openExternal(href);
      }
      setOpen(false);
    },
    [title, text, url],
  );

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      {/* Pastille déclencheuse — classes identiques au bouton « Partager » d'origine. */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("shareArticleAria")}
        className={
          compact
            ? "inline-flex size-10 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:bg-white/65 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
            : "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        }
      >
        <Share2Icon className="size-4" />
        {compact ? null : t("shareButton")}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("shareOptionsAria")}
          className={`glass-surface share-menu-pop absolute right-0 z-50 flex w-60 flex-col gap-0.5 !rounded-2xl p-1.5 ${compact ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}`}
          style={compact ? { transformOrigin: "bottom right" } : undefined}
        >
          {canNativeShare ? (
            <ShareRow
              icon={<ZapIcon className="size-[15px]" />}
              label={t("shareQuick")}
              tint="var(--glass-accent-deep)"
              onClick={nativeShare}
            />
          ) : null}

          <ShareRow
            icon={
              copied ? <CheckIcon className="size-[15px]" /> : <Link2Icon className="size-[15px]" />
            }
            label={copied ? t("shareLinkCopied") : t("shareCopyLink")}
            tint="#7c5cff"
            onClick={copyLink}
          />

          <ShareRow
            icon={<WhatsAppGlyph className="size-[15px]" />}
            label={t("shareWhatsapp")}
            tint="#25D366"
            onClick={() => shareExternal("whatsapp")}
          />
          <ShareRow
            icon={<XGlyph className="size-[14px]" />}
            label={t("shareX")}
            tint="#0f0f0f"
            onClick={() => shareExternal("x")}
          />
          <ShareRow
            icon={<FacebookGlyph className="size-[15px]" />}
            label={t("shareFacebook")}
            tint="#1877F2"
            onClick={() => shareExternal("facebook")}
          />
          <ShareRow
            icon={<LinkedInGlyph className="size-[15px]" />}
            label={t("shareLinkedin")}
            tint="#0A66C2"
            onClick={() => shareExternal("linkedin")}
          />
          <ShareRow
            icon={<MailIcon className="size-[15px]" />}
            label={t("shareEmail")}
            tint="#6b54e8"
            onClick={() => shareExternal("email")}
          />
        </div>
      ) : null}

      {/* Animation d'entrée du popover — fade + scale + léger glissement. */}
      <style jsx>{`
        .share-menu-pop {
          transform-origin: top right;
          animation: share-menu-in 150ms ease-out;
        }
        @keyframes share-menu-in {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .share-menu-pop {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/** Une ligne d'option : pastille d'icône teintée + libellé, micro-interaction au survol. */
function ShareRow({
  icon,
  label,
  tint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left outline-none transition-colors hover:bg-white/55 focus-visible:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110"
        style={{
          background: `color-mix(in oklab, ${tint} 16%, transparent)`,
          color: tint,
        }}
      >
        {icon}
      </span>
      <span className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
        {label}
      </span>
    </button>
  );
}
