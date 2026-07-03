"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TocSection {
  marker: string;
  anchor: string;
}

/**
 * Mini-sommaire collant des § d'un article long : suit le scroll (scroll-spy
 * via IntersectionObserver) et surligne le § courant. Saut au clic.
 */
export function SectionToc({ sections, title }: { sections: TocSection[]; title: string }) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.anchor))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <Card size="sm" className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5">
          <List className="size-4" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-0.5 text-sm">
          {sections.map((s) => (
            <li key={s.anchor}>
              <a
                href={`#${s.anchor}`}
                className={`block rounded px-2 py-1 transition-colors hover:bg-accent ${
                  active === s.anchor
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {s.marker}
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
