import { subHours } from "date-fns";

let timeOffset = 0;
let isTimeInitialized = false;

/**
 * Initializes the application time by fetching it from a reliable API (WorldTimeAPI).
 * Calculates the offset between local device time and true time.
 * Falls back to local time if the API fails.
 */
export const initAppTime = async () => {
  if (isTimeInitialized) return;
  try {
    // Attempting to get time for Tunisia (IPEST context)
    const res = await fetch("https://worldtimeapi.org/api/timezone/Africa/Tunis");
    if (!res.ok) throw new Error("Time API returned an error");
    const data = await res.json();
    
    // API returns ISO8601 string in data.datetime
    const apiTime = new Date(data.datetime).getTime();
    const localTime = new Date().getTime();
    
    timeOffset = apiTime - localTime;
    isTimeInitialized = true;
    console.log("App time initialized with offset:", timeOffset, "ms");
  } catch (err) {
    console.error("Failed to fetch accurate time, falling back to local device time", err);
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

/**
 * Returns the business date for the application.
 * The application day rolls over at 8:00 AM instead of 00:00.
 * To achieve this, we subtract 8 hours from the given (or true) date.
 * Example:
 * - 07:59 AM returns the previous day's date
 * - 08:00 AM returns the current day's date
 */
export const getBusinessDate = (dateOverride?: Date): Date => {
  const baseDate = dateOverride || getTrueDate();
  return subHours(baseDate, 8);
};
