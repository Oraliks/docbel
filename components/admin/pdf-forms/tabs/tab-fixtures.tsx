"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon, TrashIcon, DownloadIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { TestFixture } from "@/lib/pdf-forms/fixtures";
import type { UseFormData } from "../use-form-data";

/// Onglet admin « Fixtures de test » — Feature #8 des ameliorations
/// post-plan bindings-canonical-ux.
///
/// Chaque fixture = { id, name, description?, payload } — l'admin peut
/// generer un PDF de test avec un fixture donne sans re-taper les champs.
/// Sert aussi de non-regression : diff les bytes generes apres une
/// modification pour verifier qu'aucun stamp n'a change silencieusement.
///
/// Le payload est edite comme du JSON brut dans un Textarea — au save on
/// parse et on valide grossierement. Un editeur riche (form-driven)
/// pourrait venir plus tard mais le JSON reste le seul moyen de couvrir
/// 100% des types (fullname, array, checkbox).
export function TabFixtures({ data }: { data: UseFormData }) {
  const t = useTranslations("admin.pdf");
  const { form, patchForm } = data;
  const [busy, setBusy] = useState<string | null>(null);

  if (!form) return null;
  const fixtures = form.testFixtures ?? [];

  function updateFixtures(next: TestFixture[]) {
    patchForm({ testFixtures: next });
  }

  function addFixture() {
    const now = new Date().toISOString();
    const nextId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `fx-${Date.now()}`;
    updateFixtures([
      ...fixtures,
      {
        id: nextId,
        name: t("fixturesDefaultName", { n: fixtures.length + 1 }),
        payload: {},
        createdAt: now,
      },
    ]);
  }

  function removeFixture(id: string) {
    updateFixtures(fixtures.filter((f) => f.id !== id));
  }

  function patchOne(id: string, patch: Partial<TestFixture>) {
    updateFixtures(fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function generatePdf(fixture: TestFixture) {
    setBusy(fixture.id);
    try {
      const res = await fetch(`/api/admin/pdf/forms/${form!.id}/test-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: form!.fields, payload: fixture.payload }),
      });
      if (!res.ok) {
        toast.error(t("fixturesGenerateFail"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = fixture.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "fixture";
      a.download = `${form!.slug}-${safe}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("fixturesHelp")}
        </p>
        <Button size="sm" variant="secondary" onClick={addFixture}>
          <PlusIcon className="size-4" /> {t("fixturesAdd")}
        </Button>
      </div>

      {fixtures.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <FileTextIcon className="mx-auto mb-2 size-8 opacity-40" />
            {t("fixturesEmpty")}
          </CardContent>
        </Card>
      )}

      {fixtures.map((f) => (
        <FixtureRow
          key={f.id}
          fixture={f}
          busy={busy === f.id}
          onPatch={(patch) => patchOne(f.id, patch)}
          onRemove={() => removeFixture(f.id)}
          onGenerate={() => generatePdf(f)}
        />
      ))}
    </div>
  );
}

function FixtureRow({
  fixture,
  busy,
  onPatch,
  onRemove,
  onGenerate,
}: {
  fixture: TestFixture;
  busy: boolean;
  onPatch: (p: Partial<TestFixture>) => void;
  onRemove: () => void;
  onGenerate: () => void;
}) {
  const t = useTranslations("admin.pdf");
  const [payloadStr, setPayloadStr] = useState(() => JSON.stringify(fixture.payload, null, 2));
  const [payloadError, setPayloadError] = useState<string | null>(null);

  function commitPayload() {
    try {
      const parsed = JSON.parse(payloadStr);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setPayloadError(t("fixturesPayloadNotObject"));
        return;
      }
      setPayloadError(null);
      onPatch({ payload: parsed });
    } catch (err) {
      setPayloadError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("fixturesNameLabel")}</Label>
            <Input value={fixture.name} onChange={(e) => onPatch({ name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("fixturesDescLabel")}</Label>
            <Input
              value={fixture.description ?? ""}
              onChange={(e) => onPatch({ description: e.target.value || undefined })}
              placeholder={t("fixturesDescPlaceholder")}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("fixturesPayloadLabel")}</Label>
          <Textarea
            className="font-mono text-xs"
            rows={8}
            value={payloadStr}
            onChange={(e) => setPayloadStr(e.target.value)}
            onBlur={commitPayload}
          />
          {payloadError && (
            <span className="text-[11px] text-destructive">{payloadError}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <TrashIcon className="size-4" /> {t("fixturesDelete")}
          </Button>
          <Button size="sm" onClick={onGenerate} disabled={busy}>
            <DownloadIcon className="size-4" />
            {busy ? t("fixturesGenerating") : t("fixturesGenerate")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
