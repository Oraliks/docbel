import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { DemandeList } from "@/components/docbel/demande-list";
import { MesDemarchesClient } from "@/components/docbel/mes-demarches-client";
import { ProfilePage } from "@/components/user/profile-page";
import { NouvelleDemandeButton } from "@/components/docbel/nouvelle-demande-button";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const demandes: DemandeSummary[] = [
  { runId: "synthetic-run", index: 1, startedAtISO: "2026-10-01T12:00:00Z", completed: 1, total: 3, lifecycle: "in_progress" },
  { runId: "synthetic-complete", index: 2, startedAtISO: "2026-10-02T12:00:00Z", completed: 3, total: 3, lifecycle: "completed_editable" },
];

function render(child: ReturnType<typeof createElement>) {
  // Provider typing requires children in its props for React.createElement.
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, {
    locale: "fr", messages, children: child,
  }));
}

describe("V1 existing démarche consultation", () => {
  it("présente le profil en lecture seule sans action de sauvegarde ou suppression fermée", () => {
    const html = render(createElement(ProfilePage, { initial: null, userName: "Recette synthétique", userEmail: "recipe@example.invalid" }));
    expect(html).toContain(messages.public.design.profileReadOnlyTitle);
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).not.toContain(messages.public.dossier.profileDeleteCta);
    expect(html).not.toContain(messages.public.dossier.profileSave);
  });
  it("keeps access to both existing runs without start or mutation actions", () => {
    const html = render(createElement(DemandeList, {
      bundleId: "synthetic-bundle", slug: "dossier-test", bundleName: "Test", demandes,
    }));
    expect(html).toContain(messages.public.temporaryClosure.existing);
    expect(html).toContain('/d/dossier-test?bundleRun=synthetic-run');
    expect(html).toContain('/d/dossier-test?bundleRun=synthetic-complete');
    expect(html).not.toContain("demarrer=1");
    expect(html).not.toContain(messages.public.dossier.demandeAbandon);
    expect(html).not.toContain(messages.public.dossier.demandeNew);
  });

  it("retains retrieval for completed runs and consultation for incomplete runs", () => {
    const html = render(createElement(MesDemarchesClient, { groups: [{
      bundle: { id: "synthetic-bundle", slug: "dossier-test", name: "Test", icon: null, color: null },
      demarches: demandes,
    }] }));
    expect(html).toContain('/d/dossier-test?bundleRun=synthetic-complete#recuperer-envoyer');
    expect(html).toContain('/d/dossier-test?bundleRun=synthetic-run');
    expect(html).toContain(messages.public.design.existingResume);
    expect(html).not.toContain("demarrer=1");
    expect(html).not.toContain(messages.public.dossier.demandeAbandon);
    expect(html).not.toContain(messages.public.dossier.demandeNew);
  });

  it("does not expose a persisted run creation control at legacy call sites", () => {
    expect(render(createElement(NouvelleDemandeButton, {
      bundleId: "synthetic-bundle", slug: "dossier-test",
    }))).toBe("");
  });
});
