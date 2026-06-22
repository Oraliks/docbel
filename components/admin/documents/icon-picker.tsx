"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ICON_CATALOG, getIconByName, searchIcons } from "@/lib/lucide-icons-catalog";

interface IconPickerProps {
  value: string | null;
  onChange: (next: string | null) => void;
  emojiAllowed?: boolean;
  /**
   * Override du trigger par défaut (Button outline plein largeur). Quand
   * fourni, on rend ce nœud comme trigger du Dialog. Utile pour les usages
   * compacts (ex: card admin) où on veut juste un bouton carré 36×36 avec
   * l'icône actuelle, sans label texte. Doit être un élément React qui
   * accepte les props de DialogTrigger (`render` pattern de base-ui).
   */
  trigger?: React.ReactElement;
}

/**
 * Affiche l'icône courante (lucide ou emoji/texte) ou un placeholder.
 */
export function IconDisplay({
  value,
  className = "w-5 h-5",
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  const Icon = getIconByName(value);
  if (Icon) return <Icon className={className} />;
  return <span className="text-2xl leading-none">{value}</span>;
}

export function IconPicker({
  value,
  onChange,
  emojiAllowed = true,
  trigger,
}: IconPickerProps) {
  const t = useTranslations("admin.documents");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [emojiInput, setEmojiInput] = useState("");

  const isLucide = !!getIconByName(value);
  const filtered = useMemo(() => searchIcons(query), [query]);

  function selectLucide(name: string) {
    onChange(name);
    setOpen(false);
  }

  function applyEmoji() {
    const trimmed = emojiInput.trim().slice(0, 4);
    if (trimmed) {
      onChange(trimmed);
      setOpen(false);
      setEmojiInput("");
    }
  }

  function clear() {
    onChange(null);
    setOpen(false);
  }

  // Si l'appelant fournit un trigger custom, on l'utilise directement
  // (pattern d'override pour usages compacts). Sinon : Button outline
  // plein largeur historique.
  const defaultTrigger = (
    <Button type="button" variant="outline" className="h-10 w-full justify-start gap-2">
      <span className="flex items-center justify-center w-6 h-6 shrink-0">
        {value ? (
          <IconDisplay value={value} className="w-5 h-5" />
        ) : (
          <Smile className="w-5 h-5 text-muted-foreground" />
        )}
      </span>
      <span className="truncate text-sm">
        {value
          ? isLucide
            ? value
            : t("emojiValue", { value })
          : t("chooseIcon")}
      </span>
      {value && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            clear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              clear();
            }
          }}
          className="ml-auto p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label={t("removeIcon")}
        >
          <X className="w-3.5 h-3.5" />
        </span>
      )}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("iconDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("iconDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("iconSearchPlaceholder")}
              className="pl-8"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto rounded border bg-muted/20 p-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {t("noIconMatch", { query })}
              </p>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                {filtered.map((entry) => {
                  const Icon = entry.component;
                  const selected = value === entry.name;
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => selectLucide(entry.name)}
                      className={`flex flex-col items-center gap-1 p-2 rounded transition-colors hover:bg-background border ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-transparent"
                      }`}
                      title={entry.name}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[9px] truncate w-full text-center text-muted-foreground">
                        {entry.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center mt-3">
              {t("iconCount", { shown: filtered.length, total: ICON_CATALOG.length })}
            </p>
          </div>

          {emojiAllowed && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium">{t("orUseCustomEmoji")}</p>
              <div className="flex gap-2">
                <Input
                  value={emojiInput}
                  onChange={(e) => setEmojiInput(e.target.value)}
                  placeholder="📄 ✏️ 💼 …"
                  maxLength={4}
                  className="h-9"
                />
                <Button type="button" onClick={applyEmoji} disabled={!emojiInput.trim()}>
                  {t("use")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {value && (
            <Button type="button" variant="ghost" onClick={clear} className="text-destructive">
              {t("removeIcon")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
