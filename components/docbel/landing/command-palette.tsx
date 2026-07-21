"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { AUDIENCES } from "@/lib/audience";
import {
  type Tool,
  getToolSlug,
} from "@/lib/docbel-data";
import {
  BriefcaseIcon,
  Building2Icon,
  FileTextIcon,
  FolderOpenIcon,
  HomeIcon,
  KeyRoundIcon,
  ListChecksIcon,
  NewspaperIcon,
  PhoneIcon,
  WrenchIcon,
} from "lucide-react";

interface LandingCommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  tools: Tool[];
}

// `tKey` is the i18n key under `public.chrome` for the link label.
const QUICK_LINKS = [
  { icon: HomeIcon, tKey: "navHome", href: "/" },
  { icon: FolderOpenIcon, tKey: "navMyDossier", href: "/mon-dossier" },
  { icon: ListChecksIcon, tKey: "navMesDemarches", href: "/mes-demarches" },
  { icon: WrenchIcon, tKey: "navTools", href: "/outils" },
  { icon: NewspaperIcon, tKey: "quickNews", href: "/actualites" },
  { icon: KeyRoundIcon, tKey: "quickResume", href: "/reprendre" },
  { icon: BriefcaseIcon, tKey: "navChomage", href: "/chomage" },
  { icon: PhoneIcon, tKey: "contact", href: "/contact" },
] as const;

const ITEM_CLASS = "min-h-10 rounded-lg";

export function LandingCommandPalette({
  open,
  setOpen,
  tools,
}: LandingCommandPaletteProps) {
  const t = useTranslations("public.chrome");
  const router = useRouter();

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("paletteTitle")}
      description={t("paletteDescription")}
      className="glass-surface-strong border-[color:var(--glass-border)] sm:max-w-2xl"
    >
      <Command>
        <CommandInput placeholder={t("palettePlaceholder")} />
        <CommandList className="max-h-[min(70svh,32rem)]">
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          <CommandGroup heading={t("groupShortcuts")}>
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <CommandItem
                  key={link.href}
                  value={t(link.tKey)}
                  onSelect={() => run(() => router.push(link.href))}
                  className={ITEM_CLASS}
                >
                  <Icon aria-hidden />
                  <span className="flex-1">{t(link.tKey)}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t("groupSpaces")}>
            {AUDIENCES.map((aud) => {
              const AudIcon = aud.Icon;
              return (
                <CommandItem
                  key={aud.id}
                  onSelect={() => run(() => router.push(aud.path))}
                  className={ITEM_CLASS}
                >
                  <AudIcon aria-hidden />
                  <span className="flex-1">{aud.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {aud.description}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t("groupTools")}>
            {tools.map((tool) => (
              <CommandItem
                key={tool.id}
                value={`${tool.title} ${tool.desc} ${tool.cat}`}
                onSelect={() =>
                  run(() => router.push(`/outils/${getToolSlug(tool)}`))
                }
                className={ITEM_CLASS}
              >
                {tool.cat === "Documents" ? (
                  <FileTextIcon aria-hidden />
                ) : (
                  <Building2Icon aria-hidden />
                )}
                <span className="flex-1 truncate">{tool.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {tool.cat}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
