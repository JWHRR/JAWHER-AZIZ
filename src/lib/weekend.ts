import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getBusinessDate, weekendAnchor, weekendPeriodEnd } from "@/lib/time";

export interface WeekendRow {
  code: string;
  nombre: number;
  saisiPar?: string;
}

export interface WeekendEffectif {
  /** Jeudi de la période en cours (`semaine_du` recherché). */
  anchor: Date;
  /** Jeudi suivant : fin de la période en cours. */
  periodEnd: Date;
  /** true tant que la période en cours n'a pas été saisie. */
  isEmpty: boolean;
  rows: WeekendRow[];
  total: number;
  error?: string;
}

/** Somme des présents. Unique endroit où ce total est calculé. */
export const sumWeekendRows = (rows: WeekendRow[]): number =>
  rows.reduce((s, r) => s + (r.nombre || 0), 0);

/**
 * Charge l'effectif weekend de la période en cours : ce que les surveillants
 * ont saisi, par dortoir, plus le total.
 *
 * Source unique pour le tableau de bord admin et celui du responsable
 * restaurant, afin que les deux affichent forcément le même nombre.
 *
 * Les jointures sont faites côté client : une jointure imbriquée PostgREST
 * dépend des clés étrangères et des droits sur la table liée.
 */
export async function loadWeekendEffectif(now?: Date): Promise<WeekendEffectif> {
  const anchor = weekendAnchor(now ?? getBusinessDate());
  const periodEnd = weekendPeriodEnd(anchor);

  // Uniquement la période en cours. Pas de repli sur une période antérieure :
  // afficher un ancien relevé le ferait passer pour celui de la semaine, et
  // un relevé vieux de plusieurs mois est pire qu'une absence de chiffre.
  const [weRes, dortRes] = await Promise.all([
    supabase
      .from("weekend_effectifs")
      .select("dortoir_id, nombre_presents, surveillant_id")
      .eq("semaine_du", format(anchor, "yyyy-MM-dd")),
    supabase.from("dortoirs").select("id, code").order("code"),
  ]);

  // Un refus RLS renvoie une liste vide sans erreur : on remonte le message
  // plutôt que de laisser croire qu'aucun effectif n'a été saisi.
  const firstError = weRes.error ?? dortRes.error;

  const codeById: Record<string, string> = Object.fromEntries(
    (dortRes.data ?? []).map((d: any) => [d.id, d.code])
  );

  const ids = Array.from(
    new Set((weRes.data ?? []).map((w: any) => w.surveillant_id).filter(Boolean))
  ) as string[];
  let nameById: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name || "—"]));
  }

  const rows: WeekendRow[] = (weRes.data ?? [])
    .map((w: any) => ({
      code: codeById[w.dortoir_id] ?? "-",
      nombre: w.nombre_presents ?? 0,
      saisiPar: nameById[w.surveillant_id],
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    anchor,
    periodEnd,
    isEmpty: rows.length === 0,
    rows,
    // Zéro tant que rien n'est saisi : remis à zéro à chaque nouvelle période.
    total: sumWeekendRows(rows),
    error: firstError?.message,
  };
}
