import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface ConsecutiveStreak {
  count: number;
  start: string; // "yyyy-MM-dd" (oldest date in the streak)
  end: string;   // "yyyy-MM-dd" (newest date in the streak)
}

export interface ConsecutiveAbsenceRecord {
  studentId: string;
  nom_complet: string;
  telephone: string | null;
  dortoirId: string;
  dortoirCode: string;
  chambreNumero: string;
  count: number;
  start: string;
  end: string;
  isActive: boolean; // True if it reaches the latest checklist date for that dortoir
  status: "en_cours" | "terminee";
}

/**
 * Returns the immediately preceding calendar day formatted as "yyyy-MM-dd".
 * Consecutive logic: every day counts (no weekend skipping).
 */
export const getPreviousCalendarDay = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return format(prev, "yyyy-MM-dd");
};

/**
 * Identifies all consecutive streaks of 3 or more calendar days (count >= 3).
 * Weekends are NOT skipped: every day counts.
 */
export const findStreaks = (dates: string[]): ConsecutiveStreak[] => {
  if (!dates || dates.length === 0) return [];

  // Remove duplicates and sort descending (newest to oldest)
  const sorted = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  const streaks: ConsecutiveStreak[] = [];
  let currentStreak: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const currentDateStr = sorted[i];
    if (currentStreak.length === 0) {
      currentStreak.push(currentDateStr);
    } else {
      const lastDate = currentStreak[currentStreak.length - 1];
      const expectedPrevDate = getPreviousCalendarDay(lastDate);

      if (currentDateStr === expectedPrevDate) {
        currentStreak.push(currentDateStr);
      } else {
        if (currentStreak.length >= 3) {
          streaks.push({
            count: currentStreak.length,
            start: currentStreak[currentStreak.length - 1], // oldest date
            end: currentStreak[0],                         // newest date
          });
        }
        currentStreak = [currentDateStr];
      }
    }
  }

  if (currentStreak.length >= 3) {
    streaks.push({
      count: currentStreak.length,
      start: currentStreak[currentStreak.length - 1],
      end: currentStreak[0],
    });
  }

  return streaks;
};

/**
 * Calculates consecutive absences from students and historical absence data.
 * Keeps ALL streaks (both active and completed) so there is a permanent record.
 */
export const calculateConsecutiveAbsences = (
  students: any[],
  pastAbsences: any[],
  filterDortoirIds?: string[] | null
): ConsecutiveAbsenceRecord[] => {
  if (!students || !pastAbsences) return [];

  // Find the latest checklist date for each dortoir
  const latestChecklistDateByDortoir: Record<string, string> = {};
  pastAbsences.forEach((a) => {
    if (
      !latestChecklistDateByDortoir[a.dortoir_id] ||
      a.date > latestChecklistDateByDortoir[a.dortoir_id]
    ) {
      latestChecklistDateByDortoir[a.dortoir_id] = a.date;
    }
  });

  const results: ConsecutiveAbsenceRecord[] = [];

  students.forEach((stu: any) => {
    // Skip students with active absence authorization
    if (stu.autorisation_absence) return;

    const dortoirId = stu.chambres?.dortoirs?.id;
    const dortoirCode = stu.chambres?.dortoirs?.code || "Inconnu";
    const chambreNum = stu.chambres?.numero || "-";
    if (!dortoirId) return;

    if (filterDortoirIds && !filterDortoirIds.includes(dortoirId)) {
      return;
    }

    const latestChecklistDate = latestChecklistDateByDortoir[dortoirId];
    if (!latestChecklistDate) return;

    // Find all dates where this student was absent in this dortoir
    const studentAbsenceDates = pastAbsences
      .filter((a) => a.dortoir_id === dortoirId)
      .filter((a) => {
        const namesList = (a.noms_absents || "")
          .split("\n")
          .map((n: string) => n.trim().toLowerCase());
        return namesList.includes(stu.nom_complet.trim().toLowerCase());
      })
      .map((a) => a.date);

    const streaks = findStreaks(studentAbsenceDates);

    streaks.forEach((streak) => {
      // Record stays permanently!
      // Active if streak ends exactly on latest checklist date
      const isActive = streak.end === latestChecklistDate;

      results.push({
        studentId: stu.id,
        nom_complet: stu.nom_complet,
        telephone: stu.telephone || null,
        dortoirId,
        dortoirCode,
        chambreNumero: String(chambreNum),
        count: streak.count,
        start: streak.start,
        end: streak.end,
        isActive,
        status: isActive ? "en_cours" : "terminee",
      });
    });
  });

  // Sort: Active streaks first, then newest end date descending, then longest duration
  results.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    if (a.end !== b.end) return b.end.localeCompare(a.end);
    return b.count - a.count;
  });

  return results;
};

/**
 * Optional helper to persist/upsert records to absences_consecutives table in Supabase
 * if the table exists. Fails silently if table has not been created yet.
 */
export const persistConsecutiveRecords = async (records: ConsecutiveAbsenceRecord[]) => {
  if (!records || records.length === 0) return;

  try {
    const payload = records.map((r) => ({
      etudiant_id: r.studentId,
      nom_complet: r.nom_complet,
      dortoir_id: r.dortoirId,
      dortoir_code: r.dortoirCode,
      chambre_numero: r.chambreNumero,
      telephone: r.telephone,
      date_debut: r.start,
      date_fin: r.end,
      nombre_nuits: r.count,
      statut: r.status,
      updated_at: new Date().toISOString(),
    }));

    await supabase.from("absences_consecutives" as any).upsert(payload, {
      onConflict: "etudiant_id,date_debut,date_fin",
    });
  } catch {
    // Graceful fallback if table does not exist
  }
};
