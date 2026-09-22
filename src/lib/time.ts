let timeOffset = 0;
let isTimeInitialized = false;

/** Timezone the application runs on (IPEST, Tunisia). */
export const APP_TIME_ZONE = "Africa/Tunis";

/**
 * Initializes the application time by fetching it from a reliable API (WorldTimeAPI).
 * Calculates the offset between local device time and true time.
 * Falls back to local time if the API fails.
 */
export const initAppTime = async () => {
  if (isTimeInitialized) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Attempting to get time for Tunisia (IPEST context)
    const res = await fetch(`https://worldtimeapi.org/api/timezone/${APP_TIME_ZONE}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("Time API returned an error");
    const data = await res.json();

    // API returns ISO8601 string in data.datetime
    const apiTime = new Date(data.datetime).getTime();
    if (!Number.isFinite(apiTime)) throw new Error("Time API returned an unusable datetime");

    timeOffset = apiTime - Date.now();
    isTimeInitialized = true;
    console.log("App time initialized with offset:", timeOffset, "ms");
  } catch (err) {
    console.warn("Failed to fetch accurate time, falling back to local device time:", err);
    timeOffset = 0;
    isTimeInitialized = true;
  }
};

/**
 * Returns the true current date/time based on the fetched offset.
 */
export const getTrueDate = (): Date => {
  return new Date(Date.now() + timeOffset);
};

const zonedPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** The hour (Tunis local time) at which a new work day begins. */
export const WORK_DAY_START_HOUR = 8;

/**
 * Returns the business date for the application: the current *work* day,
 * as read on a clock in Tunisia, anchored to 08:00.
 *
 * Any moment between 00:00 and 07:59 (Tunis time) is attributed to the
 * **previous** calendar day, because the work day has not started yet.
 * The returned Date carries the Tunis wall-clock time in the device's own
 * fields, so `format()`, `startOfWeek()` and friends from date-fns — which
 * all read local fields — report the correct work day even if the device's
 * timezone is wrong.
 */
export const getBusinessDate = (dateOverride?: Date): Date => {
  const baseDate = dateOverride || getTrueDate();
  if (Number.isNaN(baseDate.getTime())) return new Date();

  const parts = zonedPartsFormatter.formatToParts(baseDate);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  if ([year, month, day, hour, minute, second].some((n) => !Number.isFinite(n))) {
    return baseDate;
  }

  // Before the work day starts, attribute the moment to the previous calendar day.
  if (hour < WORK_DAY_START_HOUR) {
    const prev = new Date(year, month - 1, day - 1, hour % 24, minute, second, baseDate.getMilliseconds());
    return prev;
  }

  return new Date(year, month - 1, day, hour % 24, minute, second, baseDate.getMilliseconds());
};

/**
 * Parses a "yyyy-MM-dd" string as a LOCAL calendar day.
 *
 * `new Date("2026-09-21")` is parsed by JavaScript as UTC midnight, which is
 * still the 20th for any timezone behind UTC. Anchoring at midday keeps the
 * day stable whatever the offset. Use this everywhere a date input, a URL
 * parameter or a database `date` column is turned back into a Date.
 */
export const parseLocalDate = (value: string | Date): Date => {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
};

/** The current business day as a "yyyy-MM-dd" string. */
export const getBusinessDateStr = (): string => {
  const d = getBusinessDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Nombre de jours écoulés depuis un horodatage (`created_at`, en UTC).
 *
 * Compte des jours de CALENDRIER tunisiens, pas des tranches de 24 h :
 * une réclamation déclarée hier à 23h50 a « 1 jour », pas « 0 ».
 * Renvoie 0 pour aujourd'hui, et jamais de valeur négative.
 */
export const daysSince = (value: string | Date, now?: Date): number => {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return 0;
  const a = getBusinessDate(created);
  const b = getBusinessDate(now);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  return diff > 0 ? diff : 0;
};

/** Libellé court de l'ancienneté : « aujourd'hui », « 1 jour », « 12 jours ». */
export const ageLabel = (value: string | Date, now?: Date): string => {
  const d = daysSince(value, now);
  if (d === 0) return "aujourd'hui";
  return d === 1 ? "1 jour" : `${d} jours`;
};
