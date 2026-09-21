export type AppRole = "ADMIN" | "SURVEILLANT" | "TECHNICIEN" | "RESPONSABLE_RESTAURANT";
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

export const SLOT_TIMES: Record<PermanenceSlot, { start: string, end: string }> = {
  MATIN: { start: "08:00", end: "13:00" },
  APRES_MIDI: { start: "14:00", end: "19:00" },
  NUIT: { start: "20:00", end: "23:00" },
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
  RESPONSABLE_RESTAURANT: "Responsable Restaurant",
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

// ── Absence Requests ─────────────────────────────────────────────────────────

export type AbsenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TaskPriority  = 'LOW' | 'NORMAL' | 'HIGH';
export type TaskStatus    = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  PENDING:  'En attente',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW:    'Basse',
  NORMAL: 'Normale',
  HIGH:   'Haute',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING:     'En attente',
  IN_PROGRESS: 'En cours',
  COMPLETED:   'Terminée',
  CANCELLED:   'Annulée',
};

export interface AbsenceRequest {
  id:             string;
  surveillant_id: string;
  reason:         string;
  description:    string | null;
  start_date:     string;
  end_date:       string;
  status:         AbsenceStatus;
  replacement_id: string | null;
  admin_note:     string | null;
  attachment_url: string | null;
  reviewed_at:    string | null;
  reviewed_by:    string | null;
  created_at:     string;
  updated_at:     string;
  // enriched client-side
  surveillant_name?:  string;
  replacement_name?:  string;
  reviewer_name?:     string;
  delegated_tasks?:   DelegatedTask[];
}

export interface DelegatedTask {
  id:                          string;
  absence_request_id:          string;
  original_surveillant_id:     string;
  replacement_surveillant_id:  string;
  title:                       string;
  description:                 string | null;
  task_date:                   string;
  priority:                    TaskPriority;
  status:                      TaskStatus;
  completed_at:                string | null;
  created_at:                  string;
  updated_at:                  string;
  // enriched
  original_name?:     string;
  absence_reason?:    string;
  absence_start?:     string;
  absence_end?:       string;
}

export interface RequestStatusHistory {
  id:         string;
  request_id: string;
  old_status: AbsenceStatus | null;
  new_status: AbsenceStatus;
  changed_by: string;
  note:       string | null;
  created_at: string;
  changer_name?: string;
}

export interface CreateAbsenceRequestInput {
  reason:         string;
  description:    string;
  start_date:     string;
  end_date:       string;
  replacement_id: string;
}

export interface CreateDelegatedTaskInput {
  title:       string;
  description: string;
  task_date:   string;
  priority:    TaskPriority;
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
