"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
  CommandShortcut,
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
  { icon: HomeIcon, tKey: "navHome", href: "/", shortcut: "H" },
  { icon: FolderOpenIcon, tKey: "navMyDossier", href: "/mon-dossier", shortcut: "D" },
  { icon: BriefcaseIcon, tKey: "navChomage", href: "/chomage", shortcut: "U" },
  { icon: WrenchIcon, tKey: "quickAllTools", href: "/outils", shortcut: "O" },
  { icon: NewspaperIcon, tKey: "quickNews", href: "/actualites", shortcut: "A" },
  { icon: PhoneIcon, tKey: "contact", href: "/contact", shortcut: "C" },
];

// Rounded items need a small vertical gap so adjacent rows don't visually merge.
const ITEM_CLASS = "rounded-lg mt-1 first:mt-0";

export function LandingCommandPalette({
  open,
  setOpen,
  tools,
}: LandingCommandPaletteProps) {
  const t = useTranslations("public.chrome");
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

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
      className="sm:max-w-xl"
    >
      <Command>
        <CommandInput placeholder={t("palettePlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          <CommandGroup heading={t("groupShortcuts")}>
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <CommandItem
                  key={link.href}
                  onSelect={() => run(() => router.push(link.href))}
                  className={ITEM_CLASS}
                >
                  <Icon />
                  <span className="flex-1">
                    {t(link.tKey as Parameters<typeof t>[0])}
                  </span>
                  <CommandShortcut>⌘{link.shortcut}</CommandShortcut>
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
                  <AudIcon />
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
                {tool.cat === "Documents" ? <FileTextIcon /> : <Building2Icon />}
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
