import { describe, it, expect } from "vitest";
import { buildWeekPdfTable, type DayRow } from "@/pages/dashboards/ResponsableRestaurantDashboard";

const day = (label: string, pd: any, dej: any, din: any, total: number): DayRow => ({
  date: "2026-09-21",
  label,
  perRepas: { PETIT_DEJEUNER: pd, DEJEUNER: dej, DINER: din },
  total,
});

describe("export PDF des pointages", () => {
  const week: DayRow[] = [
    day("lundi 21 sept.", 180, 240, 210, 630),
    day("samedi 26 sept.", 90, 120, null, 210), // pas de dîner le samedi
    day("dimanche 27 sept.", null, null, null, 0), // aucun service
    day("mardi 22 sept.", undefined, 240, 210, 450), // petit-déjeuner non saisi
  ];

  it("garde le même nombre de colonnes partout", () => {
    const { head, rows, foot } = buildWeekPdfTable(week, 1290);
    expect(head).toHaveLength(5); // Jour + 3 repas + Total
    rows.forEach((r) => expect(r).toHaveLength(head.length));
    foot.forEach((f) => expect(f).toHaveLength(head.length));
  });

  it("distingue service non assuré et service non saisi", () => {
    const { rows } = buildWeekPdfTable(week, 1290);
    expect(rows[1][3]).toBe("—"); // dîner du samedi : pas de service
    expect(rows[2][1]).toBe("—"); // dimanche : aucun service
    expect(rows[3][1]).toBe("non saisi"); // mardi : le surveillant n'a pas compté
    expect(rows[0][2]).toBe("240"); // un vrai chiffre reste un chiffre
  });

  it("reporte le total de la semaine dans le pied de tableau", () => {
    const { foot } = buildWeekPdfTable(week, 1290);
    expect(foot[0][0]).toBe("Total semaine");
    expect(foot[0][foot[0].length - 1]).toBe("1290");
  });

  it("met une majuscule au jour", () => {
    const { rows } = buildWeekPdfTable(week, 0);
    expect(rows[0][0]).toBe("Lundi 21 sept.");
  });

  it("accepte une semaine vide sans casser la structure", () => {
    const { head, rows, foot } = buildWeekPdfTable([], 0);
    expect(rows).toEqual([]);
    expect(foot[0]).toHaveLength(head.length);
  });
});
