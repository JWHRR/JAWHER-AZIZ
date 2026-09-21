import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { getBusinessDate } from "@/lib/time";

const WEEKDAYS_ORDER = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const dateToWeekday = (d: Date) => WEEKDAYS_ORDER[(d.getDay() + 6) % 7];

describe("getBusinessDate", () => {
  it("stays on the same calendar day in the early morning", () => {
    // Monday 2026-09-21, 01:30 in Tunis (UTC+1)
    const monday0130Tunis = new Date("2026-09-21T00:30:00Z");
    const business = getBusinessDate(monday0130Tunis);
    expect(format(business, "yyyy-MM-dd")).toBe("2026-09-21");
    expect(dateToWeekday(business)).toBe("LUN");
  });

  it("stays on the same calendar day just before midnight", () => {
    // Monday 2026-09-21, 23:45 in Tunis
    const monday2345Tunis = new Date("2026-09-21T22:45:00Z");
    expect(format(getBusinessDate(monday2345Tunis), "yyyy-MM-dd")).toBe("2026-09-21");
  });

  it("rolls over to the next day at midnight, not at 08:00", () => {
    // Tuesday 2026-09-22, 00:05 in Tunis
    const tuesday0005Tunis = new Date("2026-09-21T23:05:00Z");
    const business = getBusinessDate(tuesday0005Tunis);
    expect(format(business, "yyyy-MM-dd")).toBe("2026-09-22");
    expect(dateToWeekday(business)).toBe("MAR");
  });

  it("reports the Tunisian day even when the instant is a different day in UTC", () => {
    // 2026-09-20T23:30Z is already Monday 00:30 in Tunis
    expect(format(getBusinessDate(new Date("2026-09-20T23:30:00Z")), "yyyy-MM-dd")).toBe(
      "2026-09-21"
    );
  });
});
