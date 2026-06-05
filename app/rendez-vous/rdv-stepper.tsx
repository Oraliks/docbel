"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/booking/status";
import {
  GLASS_CARD,
  GLASS_INPUT,
  GLASS_LABEL,
  GLASS_PRIMARY_STYLE,
} from "@/lib/glass-classes";

interface TenantSummary {
  slug: string;
  name: string;
  category: string;
  brandColor: string | null;
  logoUrl: string | null;
}

interface Props {
  tenants: TenantSummary[];
}

const STEP_LABELS = ["Démarche", "Organisme", "Code postal"];

export function RdvStepper({ tenants }: Props) {
  const router = useRouter();

  // Unique categories present among active tenants
  const presentCategories = Array.from(
    new Set(tenants.map((t) => t.category)),
  ).filter((c) => c in CATEGORY_LABELS);

  // If only one category exists, start at step 2 with it pre-selected
  const singleCategory = presentCategories.length === 1 ? presentCategories[0] : null;

  const [step, setStep] = useState<1 | 2 | 3>(singleCategory ? 2 : 1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(singleCategory);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [cp, setCp] = useState("");

  const filteredTenants = selectedCategory
    ? tenants.filter((t) => t.category === selectedCategory)
    : tenants;

  function goBack() {
    if (step === 2) {
      if (singleCategory) return; // can't go back further
      setSelectedCategory(null);
      setStep(1);
    } else if (step === 3) {
      setSelectedTenant(null);
      setStep(2);
    }
  }

  function handleCategorySelect(cat: string) {
    setSelectedCategory(cat);
    setStep(2);
  }

  function handleTenantSelect(tenant: TenantSummary) {
    setSelectedTenant(tenant);
    setStep(3);
  }

  function handleSubmit() {
    if (!selectedTenant) return;
    const cpTrimmed = cp.trim();
    const query = cpTrimmed.length === 4 ? `?cp=${cpTrimmed}` : "";
    router.push(`/${selectedTenant.slug}/rendez-vous${query}`);
  }

  const effectiveStep = singleCategory
    ? step === 1 ? 1 : step - 1
    : step;
  const totalSteps = singleCategory ? 2 : 3;

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const n = i + 1;
          const active = n === effectiveStep;
          const done = n < effectiveStep;
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  active
                    ? "bg-[color:var(--glass-accent-deep)] text-white"
                    : done
                      ? "bg-[color:var(--glass-accent-deep)]/20 text-[color:var(--glass-accent-deep)]"
                      : "bg-[color:var(--glass-border)] text-[color:var(--glass-ink-faint)]"
                }`}
              >
                {n}
              </div>
              <span
                className={`text-[12px] font-medium ${active ? "text-[color:var(--glass-ink)]" : "text-[color:var(--glass-ink-faint)]"}`}
              >
                {singleCategory
                  ? [STEP_LABELS[1], STEP_LABELS[2]][i]
                  : STEP_LABELS[i]}
              </span>
              {i < totalSteps - 1 && (
                <div className="h-px w-6 bg-[color:var(--glass-border)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: choose category */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <p className={GLASS_LABEL}>Quelle démarche ?</p>
          <div className="flex flex-col gap-2">
            {presentCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={`${GLASS_CARD} glass-surface cursor-pointer rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-[color:var(--glass-accent-deep)]`}
              >
                <span className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                  {tenants.filter((t) => t.category === cat).length} organisme
                  {tenants.filter((t) => t.category === cat).length > 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: choose tenant */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className={GLASS_LABEL}>Quel organisme ?</p>
          <div className="flex flex-col gap-2">
            {filteredTenants.map((tenant) => (
              <button
                key={tenant.slug}
                onClick={() => handleTenantSelect(tenant)}
                className={`${GLASS_CARD} glass-surface cursor-pointer rounded-2xl p-4 text-left transition-all hover:ring-2 hover:ring-[color:var(--glass-accent-deep)]`}
              >
                <div className="flex items-center gap-3">
                  {tenant.brandColor && (
                    <div
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ background: tenant.brandColor }}
                    />
                  )}
                  <span className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
                    {tenant.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {!singleCategory && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 self-start text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
            >
              <ChevronLeft size={14} />
              Précédent
            </button>
          )}
        </div>
      )}

      {/* Step 3: postal code + confirm */}
      {step === 3 && selectedTenant && (
        <div className="flex flex-col gap-4">
          <div
            className={`${GLASS_CARD} glass-surface rounded-2xl p-4`}
          >
            <p className={GLASS_LABEL}>Organisme sélectionné</p>
            <div className="mt-1 flex items-center gap-2">
              {selectedTenant.brandColor && (
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ background: selectedTenant.brandColor }}
                />
              )}
              <span className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
                {selectedTenant.name}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cp-input" className={GLASS_LABEL}>
              Votre code postal (optionnel)
            </label>
            <input
              id="cp-input"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="ex. 1000"
              value={cp}
              onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))}
              className={`${GLASS_INPUT} h-10 w-full rounded-2xl border px-3 text-[14px] outline-none focus:ring-2 focus:ring-[color:var(--glass-accent-deep)]`}
            />
            <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
              Permet de vous orienter vers l&apos;antenne la plus proche.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
            >
              <ChevronLeft size={14} />
              Précédent
            </button>
            <button
              onClick={handleSubmit}
              style={GLASS_PRIMARY_STYLE}
              className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold transition-opacity hover:opacity-80"
            >
              Prendre rendez-vous
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
