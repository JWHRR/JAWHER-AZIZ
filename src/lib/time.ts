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

/**
 * Returns the business date for the application: the current calendar day,
 * as read on a clock in Tunisia.
 *
 * The returned Date carries the Tunis wall-clock time in the device's own
 * fields, so `format()`, `startOfWeek()` and friends from date-fns — which all
 * read local fields — report the Tunisian day even if the device's timezone is
 * wrong. The day rolls over at midnight, like the calendar.
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

  return new Date(year, month - 1, day, hour % 24, minute, second, baseDate.getMilliseconds());
};
