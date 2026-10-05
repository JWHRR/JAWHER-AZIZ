import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getBusinessDate, parseLocalDate, weekendAnchor, weekendPeriodEnd } from "@/lib/time";

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
  /**
   * Période réellement affichée. Égale à `anchor` en temps normal ; plus
   * ancienne quand la période en cours n'a pas encore été saisie et qu'on
   * se replie sur le dernier relevé disponible.
   */
  shownFor: Date | null;
  /** true quand les chiffres viennent d'une période antérieure. */
  isStale: boolean;
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

  // Quelle est la dernière période saisie, au plus tard celle en cours ?
  // Sans ce repli, un tableau de bord consulté avant la saisie du jeudi
  // n'affichait rien, alors que le relevé de la semaine précédente existe.
  const latest = await supabase
    .from("weekend_effectifs")
    .select("semaine_du")
    .lte("semaine_du", format(anchor, "yyyy-MM-dd"))
    .order("semaine_du", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shownForStr = (latest.data as any)?.semaine_du as string | undefined;

  const [weRes, dortRes] = await Promise.all([
    shownForStr
      ? supabase
          .from("weekend_effectifs")
          .select("dortoir_id, nombre_presents, surveillant_id")
          .eq("semaine_du", shownForStr)
      : Promise.resolve({ data: [], error: null } as any),
    supabase.from("dortoirs").select("id, code").order("code"),
  ]);

  // Un refus RLS renvoie une liste vide sans erreur : on remonte le message
  // plutôt que de laisser croire qu'aucun effectif n'a été saisi.
  const firstError = latest.error ?? weRes.error ?? dortRes.error;

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

  const shownFor = shownForStr ? parseLocalDate(shownForStr) : null;

  return {
    anchor,
    periodEnd,
    shownFor,
    isStale: shownFor !== null && format(shownFor, "yyyy-MM-dd") !== format(anchor, "yyyy-MM-dd"),
    rows,
    total: sumWeekendRows(rows),
    error: firstError?.message,
  };
}
