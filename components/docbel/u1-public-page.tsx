"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe2,
  Loader2,
  MapPin,
  Phone,
  Printer,
  Mail,
  Building2,
  ExternalLink,
  ChevronDown,
  Check,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/docbel/country-flag";
import type { U1Extra, AdditionalService } from "@/lib/u1-institutions";

type Institution = {
  id: string;
  country: string;
  countryCode: string | null;
  flag: string;
  organization: string;
  department: string | null;
  alternateName: string | null;
  addressLines: string[];
  postalAddress: string | null;
  phone: string | null;
  fax: string | null;
  website: string | null;
  emails: string[];
  extra: U1Extra;
};

type ApiResponse = {
  count: number;
  lastUpdated: string;
  items: Institution[];
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function InfoRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-primary mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function AdditionalServiceCard({ service }: { service: AdditionalService }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      {service.name && (
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {service.name}
        </div>
      )}
      {service.organization && (
        <div className="font-medium">{service.organization}</div>
      )}
      {service.department && (
        <div className="text-sm text-muted-foreground">{service.department}</div>
      )}
      {Array.isArray(service.address) && service.address.length > 0 && (
        <div className="text-sm">
          {service.address.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
      {service.phone && (
        <div className="text-sm">
          <Phone size={12} className="inline mr-1.5" />
          {service.phone}
        </div>
      )}
      {service.email && (
        <a
          href={`mailto:${service.email}`}
          className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
        >
          <Mail size={12} />
          {service.email}
        </a>
      )}
      {service.website && (
        <a
          href={service.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
        >
          <Globe2 size={12} />
          {service.website}
        </a>
      )}
    </div>
  );
}

function InstitutionDetail({ inst }: { inst: Institution }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-start gap-3">
          <CountryFlag
            code={inst.countryCode}
            country={inst.country}
            size={36}
            className="mt-1 shadow-sm"
          />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{inst.country}</h2>
            <p className="text-primary font-medium mt-0.5">{inst.organization}</p>
            {inst.alternateName && (
              <p className="text-sm text-muted-foreground italic">{inst.alternateName}</p>
            )}
            {inst.department && (
              <p className="text-sm text-muted-foreground">{inst.department}</p>
            )}
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          {(inst.addressLines.length > 0 || inst.postalAddress) && (
            <InfoRow icon={<MapPin size={16} />}>
              {inst.postalAddress && (
                <div className="text-sm text-muted-foreground italic mb-1">
                  {inst.postalAddress}
                </div>
              )}
              {inst.addressLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </InfoRow>
          )}

          {inst.phone && (
            <InfoRow icon={<Phone size={16} />}>
              <a href={`tel:${inst.phone.replace(/\s/g, "")}`} className="hover:text-primary">
                {inst.phone}
              </a>
            </InfoRow>
          )}

          {inst.fax && (
            <InfoRow icon={<Printer size={16} />}>
              <span className="text-muted-foreground">Fax : </span>
              {inst.fax}
            </InfoRow>
          )}

          {inst.emails.length > 0 && (
            <InfoRow icon={<Mail size={16} />}>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {inst.emails.map((email) => (
                  <a
                    key={email}
                    href={`mailto:${email}`}
                    className="text-primary hover:underline break-all"
                  >
                    {email}
                  </a>
                ))}
              </div>
            </InfoRow>
          )}

          {inst.website && (
            <InfoRow icon={<Globe2 size={16} />}>
              <a
                href={inst.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1.5 break-all"
              >
                {inst.website}
                <ExternalLink size={12} />
              </a>
            </InfoRow>
          )}
        </div>

        {inst.extra?.visitorAddress && inst.extra.visitorAddress.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-1.5">Adresse visiteurs</p>
            <div className="text-sm text-muted-foreground">
              {inst.extra.visitorAddress.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {inst.extra?.regionalServicesU1 && (
          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-1.5">Services régionaux U1</p>
            <a
              href={inst.extra.regionalServicesU1}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
            >
              {inst.extra.regionalServicesU1}
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        {inst.extra?.additionalServices && inst.extra.additionalServices.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-semibold">Services complémentaires</p>
            {inst.extra.additionalServices.map((svc, i) => (
              <AdditionalServiceCard key={i} service={svc} />
            ))}
          </div>
        )}

        {inst.extra?.additionalInfo && (
          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-2">Informations complémentaires</p>
            <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
              {Object.entries(inst.extra.additionalInfo).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground capitalize">
                    {k.replace(/_/g, " ")}
                  </dt>
                  <dd>
                    {typeof v === "string" && /^https?:\/\//.test(v) ? (
                      <a
                        href={v}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1.5 break-all"
                      >
                        {v}
                        <ExternalLink size={12} />
                      </a>
                    ) : Array.isArray(v) ? (
                      v.join(", ")
                    ) : (
                      String(v)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountryCombobox({
  items,
  value,
  onChange,
  placeholder = "Sélectionnez un pays…",
}: {
  items: Institution[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [triggerWidth, setTriggerWidth] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = items.find((i) => i.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.country.toLowerCase().includes(q) ||
        i.organization.toLowerCase().includes(q) ||
        (i.alternateName?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  function handleOpenChange(next: boolean) {
    if (next && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
    if (!next) setQuery("");
    setOpen(next);
    if (next) {
      // Focus the search input once the popover content has mounted
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        className={cn(
          "flex w-full h-12 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "data-[state=open]:border-ring",
          "dark:bg-input/30 dark:hover:bg-input/50"
        )}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <CountryFlag code={selected.countryCode} country={selected.country} size={22} />
            <span className="truncate font-medium">{selected.country}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0"
        style={{ width: triggerWidth || undefined }}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un pays…"
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-sm text-muted-foreground text-center">
              Aucun pays ne correspond
            </div>
          ) : (
            filtered.map((inst) => {
              const isSelected = inst.id === value;
              return (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => {
                    onChange(inst.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    isSelected && "bg-accent/50"
                  )}
                >
                  <CountryFlag
                    code={inst.countryCode}
                    country={inst.country}
                    size={20}
                    className="shrink-0"
                  />
                  <span className="flex-1 truncate">{inst.country}</span>
                  {isSelected && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function U1PublicPage() {
  const [items, setItems] = useState<Institution[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/data/u1-institutions");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setItems(json.items ?? []);
        setLastUpdated(json.lastUpdated ?? "");
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Building2 size={22} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Attestation U1 — institutions européennes
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Sélectionnez un pays pour voir l&apos;institution compétente où demander votre
          attestation U1 (ex-E301), équivalent du C4 au niveau européen. Données issues de
          l&apos;
          <a
            href="https://www.onem.be/page/attestations-europeennes---adresses-des-services-competents-en-matiere-de-chomage-dans-les-pays-de-l-eee-et-en-suisse"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            ONEM
          </a>
          .
        </p>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mt-2">
            Dernière mise à jour : {formatDate(lastUpdated)}
          </p>
        )}
      </div>

      {/* Country selector */}
      <div className="mb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>Aucune institution disponible</EmptyTitle>
              <EmptyDescription>
                Les données ne sont pas encore en base. Réessayez plus tard.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <CountryCombobox items={items} value={selectedId} onChange={setSelectedId} />
        )}
      </div>

      {/* Detail */}
      {selected && <InstitutionDetail inst={selected} />}
    </div>
  );
}
