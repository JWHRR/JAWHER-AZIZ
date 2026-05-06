export type AppRole = "ADMIN" | "SURVEILLANT" | "TECHNICIEN";
export type PermanenceSlot = "MATIN" | "APRES_MIDI" | "NUIT";
export type RepasType = "PETIT_DEJEUNER" | "DEJEUNER" | "DINER";
export type ReclamationStatus = "EN_ATTENTE" | "EN_COURS" | "TERMINEE";
export type ReclamationPriority = "BASSE" | "NORMALE" | "HAUTE";
export type Weekday = "LUN" | "MAR" | "MER" | "JEU" | "VEN" | "SAM" | "DIM";

export const SLOT_LABELS: Record<PermanenceSlot, string> = {
  MATIN: "Matin (08h–13h)",
  APRES_MIDI: "Après-midi (14h–19h)",
  NUIT: "Nuit (20h–23h)",
};

export const REPAS_LABELS: Record<RepasType, string> = {
  PETIT_DEJEUNER: "Petit-déjeuner",
  DEJEUNER: "Déjeuner",
  DINER: "Dîner",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrateur",
  SURVEILLANT: "Surveillant",
  TECHNICIEN: "Technicien",
};

export const STATUS_LABELS: Record<ReclamationStatus, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
};

export const PRIORITY_LABELS: Record<ReclamationPriority, string> = {
  BASSE: "Basse",
  NORMALE: "Normale",
  HAUTE: "Haute",
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  LUN: "Lundi",
  MAR: "Mardi",
  MER: "Mercredi",
  JEU: "Jeudi",
  VEN: "Vendredi",
  SAM: "Samedi",
  DIM: "Dimanche",
};

export const WEEKDAYS_ORDER: Weekday[] = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

/** Convert a JS Date to our Weekday enum (Monday = LUN). */
export function dateToWeekday(d: Date): Weekday {
  // JS getDay: 0=Sun..6=Sat. Map to Mon=0..Sun=6
  const idx = (d.getDay() + 6) % 7;
  return WEEKDAYS_ORDER[idx];
}

export interface WeekendPermanence {
  id: string;
  surveillant_id: string;
  week_start_date: string;
  created_at: string;
  full_name?: string;
}

export interface PermanenceLog {
  id: string;
  surveillant_id: string;
  date: string;
  start_time: string;
  end_time: string;
  observation: string | null;
  created_at: string;
  full_name?: string;
}
