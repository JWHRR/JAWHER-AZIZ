import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RECLAMATION_REMINDER_TITLE } from "@/lib/types";

/**
 * L'encart rouge dans la cloche est déclenché par le TITRE de la
 * notification. Si un script SQL écrit un titre différent de la constante
 * du front, l'alerte repasse en gris sans que rien ne casse : ce test
 * verrouille les deux côtés ensemble.
 */
const SQL_FILES = [
  "rappel_reclamations_22h30.sql",
  "envoyer_rappel_maintenant.sql",
  "supabase/migrations/20260921000300_rappel_reclamations.sql",
];

const read = (f: string) => readFileSync(resolve(process.cwd(), f), "utf8");

describe("titre du rappel réclamations", () => {
  it.each(SQL_FILES)("%s écrit exactement le titre attendu", (file) => {
    const sql = read(file);
    // Le titre inséré dans notifications.title
    expect(sql).toContain(`'${RECLAMATION_REMINDER_TITLE}'`);
  });

  it("le job de 22h30 filtre sur ce même titre pour éviter les doublons", () => {
    const sql = read("rappel_reclamations_22h30.sql");
    const occurrences = sql.split(`'${RECLAMATION_REMINDER_TITLE}'`).length - 1;
    // au moins deux fois : le garde-fou anti-doublon et l'insertion
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("le titre n'est pas vide et reste lisible", () => {
    expect(RECLAMATION_REMINDER_TITLE.trim()).toBe(RECLAMATION_REMINDER_TITLE);
    expect(RECLAMATION_REMINDER_TITLE.length).toBeGreaterThan(0);
  });
});
