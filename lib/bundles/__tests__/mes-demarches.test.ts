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

  it("construit les résumés via buildDemandeSummaries : total = itemCount du dossier, completed clampé, lifecycle dérivé", () => {
    const runs: MesDemarchesRunInput[] = [
      run({
        id: "a1",
        bundle: bundleA, // itemCount: 3
        completedTemplateIds: ["x", "y", "z", "w"], // 4 > total → clampé à 3
        status: "in_progress",
        completedAt: null,
      }),
    ];

    const [group] = groupRunsForMesDemarches(runs);

    expect(group.demarches[0]).toMatchObject({
      runId: "a1",
      index: 1,
      total: 3,
      completed: 3,
      lifecycle: "in_progress",
    });
  });
});
