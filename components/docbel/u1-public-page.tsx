"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  Globe2Icon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PrinterIcon,
  SearchIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/docbel/country-flag";
import { GLASS_CARD, GLASS_INPUT } from "@/lib/glass-classes";
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
    <div className="flex items-start gap-3 text-[13.5px] text-[color:var(--glass-ink)]">
      <div
        className="mt-0.5 shrink-0"
        style={{ color: "var(--glass-accent-deep)" }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function AdditionalServiceCard({ service }: { service: AdditionalService }) {
  return (
    <div
      className="space-y-2 rounded-2xl p-4 text-[13px] text-[color:var(--glass-ink)]"
      style={{ background: "var(--glass-surface)" }}
    >
      {service.name ? (
        <div
          className="text-[10.5px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "var(--glass-accent-deep)" }}
        >
          {service.name}
        </div>
      ) : null}
      {service.organization ? (
        <div className="font-semibold">{service.organization}</div>
      ) : null}
      {service.department ? (
        <div className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
          {service.department}
        </div>
      ) : null}
      {Array.isArray(service.address) && service.address.length > 0 ? (
        <div>
          {service.address.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      ) : null}
      {service.phone ? (
        <div>
          <PhoneIcon className="mr-1.5 inline size-3" />
          {service.phone}
        </div>
      ) : null}
      {service.email ? (
        <a
          href={`mailto:${service.email}`}
          className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
        >
          <MailIcon className="size-3" />
          {service.email}
        </a>
      ) : null}
      {service.website ? (
        <a
          href={service.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
        >
          <Globe2Icon className="size-3" />
          {service.website}
        </a>
      ) : null}
    </div>
  );
}

function InstitutionDetail({ inst }: { inst: Institution }) {
  const t = useTranslations("public.shared");
  return (
    <Card className={GLASS_CARD}>
      <CardContent className="space-y-5 p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <CountryFlag
            code={inst.countryCode}
            country={inst.country}
            size={40}
            className="mt-1 shadow-sm"
          />
          <div>
            <h2 className="glass-display text-[28px] font-semibold leading-[1.1]">
              {inst.country}
            </h2>
            <p
              className="mt-1 font-semibold"
              style={{ color: "var(--glass-accent-deep)" }}
            >
              {inst.organization}
            </p>
            {inst.alternateName ? (
              <p className="text-[12.5px] italic text-[color:var(--glass-ink-soft)]">
                {inst.alternateName}
              </p>
            ) : null}
            {inst.department ? (
              <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                {inst.department}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="space-y-3 border-t pt-4"
          style={{ borderTopColor: "var(--glass-ink-line)" }}
        >
          {inst.addressLines.length > 0 || inst.postalAddress ? (
            <InfoRow icon={<MapPinIcon className="size-4" />}>
              {inst.postalAddress ? (
                <div className="mb-1 italic text-[color:var(--glass-ink-soft)]">
                  {inst.postalAddress}
                </div>
              ) : null}
              {inst.addressLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </InfoRow>
          ) : null}

          {inst.phone ? (
            <InfoRow icon={<PhoneIcon className="size-4" />}>
              <a
                href={`tel:${inst.phone.replace(/\s/g, "")}`}
                className="hover:text-[color:var(--glass-accent-deep)]"
              >
                {inst.phone}
              </a>
            </InfoRow>
          ) : null}

          {inst.fax ? (
            <InfoRow icon={<PrinterIcon className="size-4" />}>
              <span className="text-[color:var(--glass-ink-soft)]">{t("faxLabel")} </span>
              {inst.fax}
            </InfoRow>
          ) : null}

          {inst.emails.length > 0 ? (
            <InfoRow icon={<MailIcon className="size-4" />}>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {inst.emails.map((email) => (
                  <a
                    key={email}
                    href={`mailto:${email}`}
                    className="break-all font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
                  >
                    {email}
                  </a>
                ))}
              </div>
            </InfoRow>
          ) : null}

          {inst.website ? (
            <InfoRow icon={<Globe2Icon className="size-4" />}>
              <a
                href={inst.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 break-all font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
              >
                {inst.website}
                <ExternalLinkIcon className="size-3" />
              </a>
            </InfoRow>
          ) : null}
        </div>

        {inst.extra?.visitorAddress && inst.extra.visitorAddress.length > 0 ? (
          <DetailSection title={t("visitorAddress")}>
            <div className="text-[13px] text-[color:var(--glass-ink-soft)]">
              {inst.extra.visitorAddress.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </DetailSection>
        ) : null}

        {inst.extra?.regionalServicesU1 ? (
          <DetailSection title={t("regionalServicesU1")}>
            <a
              href={inst.extra.regionalServicesU1}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
            >
              {inst.extra.regionalServicesU1}
              <ExternalLinkIcon className="size-3" />
            </a>
          </DetailSection>
        ) : null}

        {inst.extra?.additionalServices && inst.extra.additionalServices.length > 0 ? (
          <DetailSection title={t("additionalServices")}>
            <div className="space-y-3">
              {inst.extra.additionalServices.map((svc, i) => (
                <AdditionalServiceCard key={i} service={svc} />
              ))}
            </div>
          </DetailSection>
        ) : null}

        {inst.extra?.additionalInfo ? (
          <DetailSection title={t("additionalInfo")}>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[max-content_1fr]">
              {Object.entries(inst.extra.additionalInfo).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="capitalize text-[color:var(--glass-ink-soft)]">
                    {k.replace(/_/g, " ")}
                  </dt>
                  <dd className="text-[color:var(--glass-ink)]">
                    {typeof v === "string" && /^https?:\/\//.test(v) ? (
                      <a
                        href={v}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 break-all font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
                      >
                        {v}
                        <ExternalLinkIcon className="size-3" />
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
          </DetailSection>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border-t pt-4"
      style={{ borderTopColor: "var(--glass-ink-line)" }}
    >
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-soft)]">
        {title}
      </p>
      {children}
    </div>
  );
}

function CountryCombobox({
  items,
  value,
  onChange,
  placeholder,
}: {
  items: Institution[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const t = useTranslations("public.shared");
  const placeholderText = placeholder ?? t("countrySelectPlaceholder");
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
        (i.alternateName?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  function handleOpenChange(next: boolean) {
    if (next && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
    if (!next) setQuery("");
    setOpen(next);
    if (next) setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 text-[14px] text-[color:var(--glass-ink)] transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]",
        )}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <CountryFlag
              code={selected.countryCode}
              country={selected.country}
              size={22}
            />
            <span className="truncate font-semibold">{selected.country}</span>
          </span>
        ) : (
          <span className="text-[color:var(--glass-ink-faint)]">
            {placeholderText}
          </span>
        )}
        <ChevronDownIcon className="size-4 shrink-0 text-[color:var(--glass-ink-faint)]" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0"
        style={{ width: triggerWidth || undefined }}
      >
        <div
          className="border-b p-2"
          style={{ borderBottomColor: "var(--glass-ink-line)" }}
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("countrySearchPlaceholder")}
              className={`${GLASS_INPUT} h-9 pl-8`}
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-[color:var(--glass-ink-soft)]">
              {t("noCountryMatch")}
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
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-[color:var(--glass-surface)]",
                    isSelected && "font-semibold",
                  )}
                >
                  <CountryFlag
                    code={inst.countryCode}
                    country={inst.country}
                    size={20}
                    className="shrink-0"
                  />
                  <span className="flex-1 truncate">{inst.country}</span>
                  {isSelected ? (
                    <CheckIcon
                      className="size-3.5 shrink-0"
                      style={{ color: "var(--glass-accent-deep)" }}
                    />
                  ) : null}
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
  const t = useTranslations("public.shared");
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
    [items, selectedId],
  );

  return (
    <section className="flex w-full flex-col gap-4 sm:gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("u1Eyebrow")}
        </p>
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
            }}
          >
            <Building2Icon className="size-5" />
          </span>
          <h1 className="glass-display text-[34px] font-semibold leading-[1.05] sm:text-[40px]">
            {t("u1Title")}
          </h1>
        </div>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          {t.rich("u1Intro", {
            onem: (chunks) => (
              <a
                href="https://www.onem.be/page/attestations-europeennes---adresses-des-services-competents-en-matiere-de-chomage-dans-les-pays-de-l-eee-et-en-suisse"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        {lastUpdated ? (
          <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
            {t("lastUpdated", { date: formatDate(lastUpdated) })}
          </p>
        ) : null}
      </header>

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="size-5 animate-spin text-[color:var(--glass-ink-soft)]" />
          </div>
        ) : items.length === 0 ? (
          <div className="glass-surface flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Building2Icon className="size-8 text-[color:var(--glass-ink-faint)]" />
            <p className="text-[14px] font-semibold">
              {t("noInstitutions")}
            </p>
            <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
              {t("noInstitutionsHint")}
            </p>
          </div>
        ) : (
          <CountryCombobox
            items={items}
            value={selectedId}
            onChange={setSelectedId}
          />
        )}
      </div>

      {selected ? <InstitutionDetail inst={selected} /> : null}
    </section>
  );
}
