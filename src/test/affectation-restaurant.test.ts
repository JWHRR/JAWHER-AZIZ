import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { getBusinessDate, parseLocalDate } from "@/lib/time";
import { dateToWeekday } from "@/lib/types";

/** Copie de la règle utilisée par les tableaux de bord et la page Restaurant. */
const isRedundantRestoSlot = (wd: string, repas: string) => {
  if (wd === "SAM" && repas === "DINER") return true;
  if (wd === "DIM") return true;
  return false;
};

describe("affectation restaurant", () => {
  // Un surveillant affecté au déjeuner du lundi voyait la mauvaise journée
  // quand il ouvrait son compte avant 08:00. La journée de travail commence
  // à 08:00 : avant ça, on est encore sur la journée précédente.
  it("à 07:00 (avant 08h), on est sur la journée de travail précédente", () => {
    const early = new Date("2026-09-21T06:00:00Z"); // lundi 07:00 à Tunis — avant 08h
    const wd = dateToWeekday(getBusinessDate(early));
    // Toujours sur dimanche car la journée lundi ne commence qu'à 08:00
    expect(wd).toBe("DIM");
  });

  it("à 08:00, on bascule sur la bonne journée de travail", () => {
    const at8 = new Date("2026-09-21T07:00:00Z"); // lundi 08:00 à Tunis
    const wd = dateToWeekday(getBusinessDate(at8));
    expect(wd).toBe("LUN");
    expect(isRedundantRestoSlot(wd, "DEJEUNER")).toBe(false);
  });

  it("garde le même jour du matin (08h+) au soir", () => {
    // Tunis est à UTC+1 toute l'année : heure de Tunis h <=> UTC h-1.
    const tunisHours = [8, 12, 19, 23];
    const days = tunisHours.map((h) => {
      const utc = new Date(Date.UTC(2026, 8, 21, h - 1, 30));
      return format(getBusinessDate(utc), "yyyy-MM-dd");
    });
    expect(new Set(days)).toEqual(new Set(["2026-09-21"]));
  });

  it("donne le jour tunisien même si l'appareil est dans un autre fuseau", () => {
    // La machine de test est en America/Los_Angeles : sans ancrage sur Tunis,
    // cet instant serait encore le 20 septembre.
    const utc = new Date("2026-09-21T09:00:00Z"); // lundi 10:00 à Tunis
    expect(format(getBusinessDate(utc), "yyyy-MM-dd")).toBe("2026-09-21");
  });
});

describe("parseLocalDate", () => {
  it("garde le jour saisi, quel que soit le fuseau", () => {
    const d = parseLocalDate("2026-09-21");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(21);
    expect(format(d, "yyyy-MM-dd")).toBe("2026-09-21");
  });

  it("donne le bon jour de la semaine", () => {
    expect(dateToWeekday(parseLocalDate("2026-09-21"))).toBe("LUN");
    expect(dateToWeekday(parseLocalDate("2026-09-25"))).toBe("VEN");
    expect(dateToWeekday(parseLocalDate("2026-09-27"))).toBe("DIM");
  });

  it("ne dérive pas sur un aller-retour date -> texte -> date", () => {
    for (let i = 0; i < 40; i++) {
      const iso = format(new Date(2026, 8, 1 + i, 12), "yyyy-MM-dd");
      expect(format(parseLocalDate(iso), "yyyy-MM-dd")).toBe(iso);
    }
  });

  it("accepte un horodatage complet sans changer de jour", () => {
    expect(format(parseLocalDate("2026-09-21T23:30:00+01:00"), "yyyy-MM-dd")).toBe("2026-09-21");
  });
});
