import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { weekendAnchor } from "@/pages/dashboards/ResponsableRestaurantDashboard";

// Weekend headcounts are stored under `semaine_du` = the Thursday of the week,
// the same key the Absences page writes with.
const anchorOf = (isoLocalDay: string) =>
  format(weekendAnchor(new Date(`${isoLocalDay}T10:00:00`)), "yyyy-MM-dd");

describe("weekendAnchor", () => {
  // Week of Mon 2026-09-21 -> Thursday is 2026-09-24
  it("uses the current Thursday from Thursday to Sunday", () => {
    expect(anchorOf("2026-09-24")).toBe("2026-09-24"); // jeudi
    expect(anchorOf("2026-09-25")).toBe("2026-09-24"); // vendredi
    expect(anchorOf("2026-09-26")).toBe("2026-09-24"); // samedi
    expect(anchorOf("2026-09-27")).toBe("2026-09-24"); // dimanche
  });

  it("falls back to the previous Thursday from Monday to Wednesday", () => {
    expect(anchorOf("2026-09-21")).toBe("2026-09-17"); // lundi
    expect(anchorOf("2026-09-22")).toBe("2026-09-17"); // mardi
    expect(anchorOf("2026-09-23")).toBe("2026-09-17"); // mercredi
  });

  it("always lands on a Thursday", () => {
    for (let i = 0; i < 21; i++) {
      const d = new Date(2026, 8, 1 + i, 10);
      expect(weekendAnchor(d).getDay()).toBe(4);
    }
  });
});
