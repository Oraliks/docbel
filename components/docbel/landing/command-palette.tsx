"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

const QUICK_LINKS = [
  { icon: HomeIcon, label: "Accueil", href: "/", shortcut: "H" },
  { icon: FolderOpenIcon, label: "Mon dossier", href: "/mon-dossier", shortcut: "D" },
  { icon: WrenchIcon, label: "Tous les outils", href: "/outils", shortcut: "O" },
  { icon: NewspaperIcon, label: "Actualités", href: "/actualites", shortcut: "A" },
  { icon: PhoneIcon, label: "Contact", href: "/contact", shortcut: "C" },
];

// Rounded items need a small vertical gap so adjacent rows don't visually merge.
const ITEM_CLASS = "rounded-lg mt-1 first:mt-0";

export function LandingCommandPalette({
  open,
  setOpen,
  tools,
}: LandingCommandPaletteProps) {
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
      title="Recherche globale"
      description="Outils, espaces et raccourcis"
      className="sm:max-w-xl"
    >
      <Command>
        <CommandInput placeholder="Rechercher un outil, un guide, un espace…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup heading="Raccourcis">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <CommandItem
                  key={link.href}
                  onSelect={() => run(() => router.push(link.href))}
                  className={ITEM_CLASS}
                >
                  <Icon />
                  <span className="flex-1">{link.label}</span>
                  <CommandShortcut>⌘{link.shortcut}</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Espaces">
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
          <CommandGroup heading="Outils">
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
