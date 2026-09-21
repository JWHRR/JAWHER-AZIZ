import { describe, it, expect } from "vitest";
import { daysSince, ageLabel } from "@/lib/time";
import { ageTone } from "@/components/ReclamationAge";

// Tunis = UTC+1 toute l'année : heure de Tunis h <=> UTC h-1.
const tunis = (y: number, m: number, d: number, h = 12) =>
  new Date(Date.UTC(y, m - 1, d, h - 1, 0, 0));

describe("daysSince", () => {
  const now = tunis(2026, 9, 21, 10); // lundi 21/09, 10h à Tunis

  it("renvoie 0 le jour même", () => {
    expect(daysSince(tunis(2026, 9, 21, 8), now)).toBe(0);
  });

  it("compte des jours de calendrier, pas des tranches de 24 h", () => {
    // Déclarée hier à 23h50, consultée ce matin à 10h : 10 h se sont
    // écoulées, mais c'était bien « hier » — donc 1 jour.
    expect(daysSince(tunis(2026, 9, 20, 23.833), now)).toBe(1);
  });

  it("compte correctement sur plusieurs jours", () => {
    expect(daysSince(tunis(2026, 9, 14, 12), now)).toBe(7);
    expect(daysSince(tunis(2026, 9, 7, 12), now)).toBe(14);
    expect(daysSince(tunis(2026, 8, 21, 12), now)).toBe(31);
  });

  it("ne renvoie jamais de valeur négative", () => {
    expect(daysSince(tunis(2026, 9, 25, 12), now)).toBe(0);
  });

  it("encaisse une date invalide sans planter", () => {
    expect(daysSince("pas une date", now)).toBe(0);
  });

  it("donne le même résultat quelle que soit l'heure de consultation", () => {
    const created = tunis(2026, 9, 18, 15);
    const hours = [0, 6, 12, 18, 23].map((h) => daysSince(created, tunis(2026, 9, 21, h)));
    expect(new Set(hours)).toEqual(new Set([3]));
  });
});

describe("ageLabel", () => {
  const now = tunis(2026, 9, 21, 10);

  it("accorde le singulier et le pluriel", () => {
    expect(ageLabel(tunis(2026, 9, 21, 9), now)).toBe("aujourd'hui");
    expect(ageLabel(tunis(2026, 9, 20, 9), now)).toBe("1 jour");
    expect(ageLabel(tunis(2026, 9, 19, 9), now)).toBe("2 jours");
    expect(ageLabel(tunis(2026, 9, 1, 9), now)).toBe("20 jours");
  });
});

describe("ageTone — couleur du badge", () => {
  const colour = (days: number) =>
    ageTone(days).includes("green") ? "vert"
    : ageTone(days).includes("yellow") ? "jaune"
    : ageTone(days).includes("orange") ? "orange"
    : "rouge";

  it("0 et 1 jour : vert", () => {
    expect(colour(0)).toBe("vert");
    expect(colour(1)).toBe("vert");
  });

  it("2 jours : jaune", () => {
    expect(colour(2)).toBe("jaune");
  });

  it("3 jours : orange", () => {
    expect(colour(3)).toBe("orange");
  });

  it("4 jours et plus : rouge", () => {
    expect(colour(4)).toBe("rouge");
    expect(colour(10)).toBe("rouge");
    expect(colour(365)).toBe("rouge");
  });

  it("chaque jour a exactement une couleur", () => {
    const seq = [0, 1, 2, 3, 4, 5].map(colour);
    expect(seq).toEqual(["vert", "vert", "jaune", "orange", "rouge", "rouge"]);
  });
});
