import { describe, it, expect } from "vitest";
import {
  groupRunsForMesDemarches,
  type MesDemarchesRunInput,
} from "../mes-demarches";

const bundleA = {
  id: "bundle-a",
  slug: "chomage-complet",
  name: "Chômage complet",
  icon: "briefcase",
  color: "#7C3AED",
  itemCount: 3,
};
const bundleB = {
  id: "bundle-b",
  slug: "allocations-insertion",
  name: "Allocations d'insertion",
  icon: null,
  color: null,
  itemCount: 2,
};

function run(
  overrides: Partial<MesDemarchesRunInput> & {
    id: string;
    bundle: MesDemarchesRunInput["bundle"];
  },
): MesDemarchesRunInput {
  return {
    startedAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-01T10:00:00Z",
    status: "in_progress",
    completedAt: null,
    anonymizedAt: null,
    completedTemplateIds: ["x"],
    eligibilityAnswers: {},
    payloads: {},
    ...overrides,
  };
}

describe("groupRunsForMesDemarches", () => {
  it("regroupe des runs de 2 dossiers mélangés en 2 groupes ordonnés par activité la plus récente", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "a1",
        bundle: bundleA,
        startedAt: "2026-07-01T10:00:00Z",
        updatedAt: "2026-07-01T10:00:00Z",
      }),
      run({
        id: "b1",
        bundle: bundleB,
        startedAt: "2026-07-05T10:00:00Z",
        updatedAt: "2026-07-10T09:00:00Z",
      }),
      run({
        id: "a2",
        bundle: bundleA,
        startedAt: "2026-07-08T10:00:00Z",
        updatedAt: "2026-07-08T10:00:00Z",
      }),
    ];

    const groups = groupRunsForMesDemarches(runs);

    // bundle-b (activité max 07-10) passe avant bundle-a (activité max 07-08),
    // alors même que le run bundle-a le plus ANCIEN (a1) apparaît en premier
    // dans le tableau d'entrée — la fonction ne doit pas se fier à l'ordre
    // d'arrivée mais recalculer l'activité par groupe.
    expect(groups.map((g) => g.bundle.id)).toEqual(["bundle-b", "bundle-a"]);
    // La forme du bundle exposée ne doit PAS fuiter `itemCount` (interne au
    // calcul de progression) : seulement id/slug/name/icon/color.
    expect(groups[0].bundle).toEqual({
      id: "bundle-b",
      slug: "allocations-insertion",
      name: "Allocations d'insertion",
      icon: null,
      color: null,
    });
  });

  it("exclut les runs sans progression (bundleRunHasProgress)", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "empty",
        bundle: bundleA,
        completedTemplateIds: [],
        eligibilityAnswers: {},
        payloads: {},
      }),
      run({ id: "withProgress", bundle: bundleA, completedTemplateIds: ["x"] }),
    ];

    const groups = groupRunsForMesDemarches(runs);

    expect(groups).toHaveLength(1);
    expect(groups[0].demarches.map((d) => d.runId)).toEqual(["withProgress"]);
  });

  it("un dossier dont aucun run n'a de progression n'apparaît pas du tout", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "empty",
        bundle: bundleA,
        completedTemplateIds: [],
        eligibilityAnswers: {},
        payloads: {},
      }),
    ];

    expect(groupRunsForMesDemarches(runs)).toEqual([]);
  });

  it("trie les démarches d'un même groupe du plus récent au plus ancien", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "old",
        bundle: bundleA,
        startedAt: "2026-07-01T10:00:00Z",
        updatedAt: "2026-07-01T10:00:00Z",
      }),
      run({
        id: "new",
        bundle: bundleA,
        startedAt: "2026-07-09T10:00:00Z",
        updatedAt: "2026-07-09T10:00:00Z",
      }),
    ];

    const [group] = groupRunsForMesDemarches(runs);

    expect(group.demarches.map((d) => d.runId)).toEqual(["new", "old"]);
  });

  it("total est gated par le lifecycle : en cours, garde toujours 1 de marge au-dessus de completedTemplateIds (jamais 100%)", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "a1",
        bundle: bundleA, // itemCount: 3
        completedTemplateIds: ["x", "y", "z", "w"], // 4 >= itemCount, run EN COURS
        status: "in_progress",
        completedAt: null,
      }),
    ];

    const [group] = groupRunsForMesDemarches(runs);

    // +1 de marge au-dessus de completedTemplateIds.length (4) : jamais 100%
    // tant que lifecycle !== "completed_editable".
    expect(group.demarches[0]).toMatchObject({
      runId: "a1",
      index: 1,
      total: 5,
      completed: 4,
      lifecycle: "in_progress",
    });
    expect(group.demarches[0].completed).toBeLessThan(
      group.demarches[0].total,
    );
  });

  it("régression bug critique Task 3.1 : 3 items de base complétés + 1 compagnon déclenché non rempli → jamais 100% en cours (3 sur 4, pas 3 sur 3)", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "a1",
        bundle: bundleA, // itemCount: 3 (compte seulement les items DE BASE)
        // Les 3 items de base sont complétés (completedTemplateIds.length ===
        // itemCount), mais le run reste "in_progress" : un compagnon C1
        // déclenché par les réponses déjà saisies n'a pas encore été rempli —
        // invisible pour `itemCount`. Avant le fix (mode "total global" de
        // buildDemandeSummaries), ceci produisait total=3, completed=3 =
        // 100% affiché alors que le pill dit "En cours" (contradiction, bug).
        completedTemplateIds: ["x", "y", "z"],
        status: "in_progress",
        completedAt: null,
      }),
    ];

    const [group] = groupRunsForMesDemarches(runs);

    expect(group.demarches[0].lifecycle).toBe("in_progress");
    expect(group.demarches[0]).toMatchObject({ total: 4, completed: 3 });
    expect(group.demarches[0].completed).toBeLessThan(
      group.demarches[0].total,
    );
  });

  it("run terminé (lifecycle completed_editable) : total inclut les compagnons complétés, la barre est pleine (completed === total)", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "a1",
        bundle: bundleA, // itemCount: 3
        // 3 items de base + 1 compagnon déclenché, TOUS complétés.
        completedTemplateIds: ["x", "y", "z", "companion-1"],
        status: "completed",
        completedAt: "2026-07-15T10:00:00Z",
      }),
    ];

    const [group] = groupRunsForMesDemarches(runs);

    expect(group.demarches[0].lifecycle).toBe("completed_editable");
    expect(group.demarches[0]).toMatchObject({ total: 4, completed: 4 });
    expect(group.demarches[0].completed).toBe(group.demarches[0].total);
  });
});
