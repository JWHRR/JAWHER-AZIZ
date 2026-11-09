import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/time";
import { dateToWeekday, REPAS_LABELS, RepasType } from "@/lib/types";

export interface MissingTask {
  type: "ABSENCE" | "RESTAURANT" | "PERMANENCE" | "INSPECTION";
  surveillantName: string;
  surveillant_id: string;
  detail: string;
}

export const isRedundantRestoSlot = (wd: string, repas: string) => {
  if (wd === "SAM" && repas === "DINER") return true;
  if (wd === "DIM") return true;
  return false;
};

export async function fetchMissingTasksForDate(targetDate: string): Promise<MissingTask[]> {
  const wd = dateToWeekday(parseLocalDate(targetDate));

  const [
    allProfsRes,
    dortoirAssignsRes,
    absRes,
    tplRRes,
    ovRRes,
    logsRes,
    insRes,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name, is_active").eq("is_active", true),
    supabase.from("dortoir_assignments").select("dortoir_id, surveillant_id, dortoirs(code)"),
    supabase.from("absences").select("dortoir_id").eq("date", targetDate),
    supabase.from("restaurant_template").select("surveillant_id, repas").eq("weekday", wd),
    supabase.from("restaurant_assignments").select("surveillant_id, repas").eq("date", targetDate),
    supabase.from("restaurant_logs").select("surveillant_id, repas").eq("date", targetDate),
    supabase.from("chambre_inspections").select("chambres!inner(dortoir_id)").eq("date", targetDate),
  ]);

  const allProfs = allProfsRes.data ?? [];
  const nameById: Record<string, string> = Object.fromEntries(
    allProfs.map((p: any) => [p.user_id, p.full_name || "(sans nom)"])
  );
  const dortoirAssigns = dortoirAssignsRes.data ?? [];

  const missing: MissingTask[] = [];

  // 1. Absences
  const absDoneSet = new Set((absRes.data ?? []).map((x: any) => x.dortoir_id));
  dortoirAssigns.forEach((da: any) => {
    if (nameById[da.surveillant_id] && !absDoneSet.has(da.dortoir_id)) {
      missing.push({
        type: "ABSENCE",
        surveillant_id: da.surveillant_id,
        surveillantName: nameById[da.surveillant_id],
        detail: `Absences Dortoir ${da.dortoirs?.code ?? "?"}`,
      });
    }
  });

  // 2. Restaurant
  const rawExpectedResto = [
    ...((tplRRes.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
    ...((ovRRes.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
  ];
  const expectedResto = Array.from(
    new Map(
      rawExpectedResto
        .filter((e) => !isRedundantRestoSlot(wd, e.r))
        .map((e) => [`${e.s}:${e.r}`, e])
    ).values()
  );
  const restoDoneSet = new Set((logsRes.data ?? []).map((x: any) => `${x.surveillant_id}:${x.repas}`));
  expectedResto.forEach((e) => {
    if (nameById[e.s] && !restoDoneSet.has(`${e.s}:${e.r}`)) {
      missing.push({
        type: "RESTAURANT",
        surveillant_id: e.s,
        surveillantName: nameById[e.s],
        detail: `Effectif ${REPAS_LABELS[e.r as RepasType] ?? e.r}`,
      });
    }
  });

  // 3. Inspections
  const inspDoneSet = new Set((insRes.data ?? []).map((x: any) => x.chambres?.dortoir_id).filter(Boolean));
  dortoirAssigns.forEach((da: any) => {
    if (nameById[da.surveillant_id] && !inspDoneSet.has(da.dortoir_id)) {
      missing.push({
        type: "INSPECTION",
        surveillant_id: da.surveillant_id,
        surveillantName: nameById[da.surveillant_id],
        detail: `Inspection Dortoir ${da.dortoirs?.code ?? "?"}`,
      });
    }
  });

  return missing;
}
