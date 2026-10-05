import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sumWeekendRows, type WeekendRow } from "@/lib/weekend";

const read = (f: string) => readFileSync(resolve(process.cwd(), f), "utf8");

describe("sumWeekendRows", () => {
  const rows: WeekendRow[] = [
    { code: "A", nombre: 12 },
    { code: "B", nombre: 8 },
    { code: "C", nombre: 0 },
  ];

  it("additionne les présents de chaque dortoir", () => {
    expect(sumWeekendRows(rows)).toBe(20);
  });

  it("vaut 0 quand rien n'est saisi", () => {
    expect(sumWeekendRows([])).toBe(0);
  });

  it("encaisse une valeur manquante sans produire NaN", () => {
    expect(sumWeekendRows([{ code: "A", nombre: 5 }, { code: "B" } as WeekendRow])).toBe(5);
  });
});

/**
 * L'admin et le responsable restaurant doivent afficher le MÊME nombre.
 * Le seul moyen durable est qu'ils partagent la source : si quelqu'un
 * recalculait le total localement, les deux pourraient se mettre à diverger
 * sans que rien n'échoue.
 */
describe("une seule source pour l'effectif weekend", () => {
  const CONSUMERS = [
    "src/pages/dashboards/ResponsableRestaurantDashboard.tsx",
    "src/components/WeekendEffectifCard.tsx",
  ];

  it.each(CONSUMERS)("%s passe par lib/weekend", (file) => {
    expect(read(file)).toContain('from "@/lib/weekend"');
  });

  it("aucun écran n'interroge weekend_effectifs directement", () => {
    for (const file of CONSUMERS) {
      expect(read(file)).not.toContain('from("weekend_effectifs")');
    }
  });

  it("aucun écran ne recalcule le total à la main", () => {
    for (const file of CONSUMERS) {
      expect(read(file)).not.toMatch(/reduce\(\([^)]*\)\s*=>\s*\w+\s*\+\s*\w+\.nombre/);
    }
  });
});

/**
 * Pas de repli sur une période antérieure : un relevé vieux de plusieurs
 * mois affiché comme celui de la semaine est pire qu'une absence de chiffre.
 * Le compteur repart de 0 à chaque nouvelle période, jusqu'à la saisie du
 * jeudi.
 */
describe("remise à zéro à chaque période", () => {
  it("la somme de zéro ligne vaut 0", () => {
    expect(sumWeekendRows([])).toBe(0);
  });

  it("le chargeur n'interroge que la période en cours", () => {
    const src = read("src/lib/weekend.ts");
    expect(src).toContain('.eq("semaine_du", format(anchor, "yyyy-MM-dd"))');
    // aucun repli vers une période antérieure
    expect(src).not.toContain('.lte("semaine_du"');
    expect(src).not.toContain("isStale");
  });

  it("l'absence de saisie est signalée par isEmpty", () => {
    expect(read("src/lib/weekend.ts")).toContain("isEmpty: rows.length === 0");
  });

  it("le tableau de bord admin n'affiche plus de tuile Effectif Weekend", () => {
    const src = read("src/pages/dashboards/AdminDashboard.tsx");
    expect(src).not.toContain('label: "Effectif Weekend"');
    // mais garde la carte détaillée en bas
    expect(src).toContain("<WeekendEffectifCard />");
  });

  it("un effectif réellement saisi à 0 reste un chiffre", () => {
    expect(sumWeekendRows([{ code: "A", nombre: 0 }])).toBe(0);
  });
});
