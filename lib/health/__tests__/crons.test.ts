import { describe, expect, it } from "vitest";
import { CRONS_PLANIFIES, listerCrons } from "../crons";
import vercelConfig from "@/vercel.json";

describe("listerCrons", () => {
  it("garde le chemin et l'horaire de chaque cron déclaré", () => {
    const crons = listerCrons(
      { crons: [{ path: "/api/cron/x", schedule: "0 3 * * *" }] },
      { "/api/cron/x": "Tâche X" },
    );
    expect(crons).toEqual([{ path: "/api/cron/x", schedule: "0 3 * * *", label: "Tâche X" }]);
  });

  it("affiche un cron NON libellé sous son chemin plutôt que de le taire", () => {
    // C'est tout l'intérêt de la dérivation : la tâche ajoutée demain apparaît
    // le jour même, même si personne n'a pensé à lui écrire un nom.
    const [cron] = listerCrons({ crons: [{ path: "/api/cron/neuf", schedule: "@daily" }] }, {});
    expect(cron.label).toBe("/api/cron/neuf");
  });

  it("supporte une configuration sans crons", () => {
    expect(listerCrons({})).toEqual([]);
  });
});

describe("CRONS_PLANIFIES", () => {
  it("liste EXACTEMENT les crons de vercel.json", () => {
    // La table en dur de `/admin/monitoring` en montrait six sur treize : sept
    // tâches — dont les deux purges RGPD — tournaient sans apparaître nulle
    // part, et l'écran affirmait le contraire.
    expect(CRONS_PLANIFIES.map((c) => c.path)).toEqual(vercelConfig.crons.map((c) => c.path));
  });

  it("nomme chaque cron réellement déclaré", () => {
    const sansNom = CRONS_PLANIFIES.filter((c) => c.label === c.path).map((c) => c.path);
    expect(sansNom).toEqual([]);
  });
});
