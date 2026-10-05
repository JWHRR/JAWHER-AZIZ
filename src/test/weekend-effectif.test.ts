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
    "src/pages/dashboards/AdminDashboard.tsx",
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
 * Un 0 affiché voudrait dire « personne ne reste ce weekend ».
 * Aucune saisie est une tout autre information : les deux ne doivent pas
 * se ressembler à l'écran.
 */
describe("aucune saisie ne doit pas s'afficher comme un zéro", () => {
  it("la somme de zéro ligne vaut bien 0 — d'où le besoin de distinguer", () => {
    expect(sumWeekendRows([])).toBe(0);
  });

  it("le tableau de bord admin distingue les deux cas", () => {
    const src = read("src/pages/dashboards/AdminDashboard.tsx");
    // null quand rien n'est saisi, le total sinon
    expect(src).toContain("we.rows.length > 0 ? we.total : null");
    expect(src).toContain("non saisi");
  });

  it("un vrai zéro reste affiché comme un chiffre", () => {
    // un dortoir saisi à 0 est une information : personne ne reste dans
    // ce dortoir, mais la saisie a bien eu lieu.
    expect(sumWeekendRows([{ code: "A", nombre: 0 }])).toBe(0);
  });
});

/**
 * Le tableau de bord ne doit pas se vider parce que la saisie du jeudi
 * n'a pas encore eu lieu : il se replie sur le dernier relevé connu, en le
 * datant pour qu'on ne le prenne pas pour celui de la semaine en cours.
 */
describe("repli sur le dernier relevé disponible", () => {
  it("le chargeur cherche la dernière période au plus tard celle en cours", () => {
    const src = read("src/lib/weekend.ts");
    expect(src).toContain('.lte("semaine_du"');
    expect(src).toContain('.order("semaine_du", { ascending: false })');
  });

  it("le repli est signalé par isStale et la période réelle par shownFor", () => {
    const src = read("src/lib/weekend.ts");
    expect(src).toContain("isStale:");
    expect(src).toContain("shownFor");
  });

  it("la carte détaillée nomme la période affichée, pas celle demandée", () => {
    const src = read("src/components/WeekendEffectifCard.tsx");
    expect(src).toContain("shownFor ?? anchor");
    expect(src).toContain("isStale &&");
  });

  it("la tuile admin date le chiffre quand il est ancien", () => {
    const src = read("src/pages/dashboards/AdminDashboard.tsx");
    expect(src).toContain("effectifWeekendStaleDepuis");
  });
});
