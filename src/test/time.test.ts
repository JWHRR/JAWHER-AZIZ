import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { getBusinessDate } from "@/lib/time";

const WEEKDAYS_ORDER = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const dateToWeekday = (d: Date) => WEEKDAYS_ORDER[(d.getDay() + 6) % 7];

describe("getBusinessDate", () => {
  it("work day starts at 08:00 — before that, stays on the previous work day", () => {
    // Tuesday 2026-09-22, 02:03 in Tunis (UTC+1) — work day hasn't started yet
    const tuesday0203Tunis = new Date("2026-09-22T01:03:00Z");
    const business = getBusinessDate(tuesday0203Tunis);
    // Should still be treated as Monday 2026-09-21
    expect(format(business, "yyyy-MM-dd")).toBe("2026-09-21");
    expect(dateToWeekday(business)).toBe("LUN");
  });

  it("work day starts at 08:00 — from 08:00 onward, reports the current calendar day", () => {
    // Monday 2026-09-21, 08:00 in Tunis
    const monday0800Tunis = new Date("2026-09-21T07:00:00Z");
    const business = getBusinessDate(monday0800Tunis);
    expect(format(business, "yyyy-MM-dd")).toBe("2026-09-21");
    expect(dateToWeekday(business)).toBe("LUN");
  });

  it("stays on the same work day just before midnight", () => {
    // Monday 2026-09-21, 23:45 in Tunis — still the Monday work day
    const monday2345Tunis = new Date("2026-09-21T22:45:00Z");
    expect(format(getBusinessDate(monday2345Tunis), "yyyy-MM-dd")).toBe("2026-09-21");
  });

  it("rolls over to the next work day at 08:00, not at midnight", () => {
    // Tuesday 2026-09-22, 07:59 in Tunis — still Monday's work day
    const tuesday0759Tunis = new Date("2026-09-22T06:59:00Z");
    expect(format(getBusinessDate(tuesday0759Tunis), "yyyy-MM-dd")).toBe("2026-09-21");

    // Tuesday 2026-09-22, 08:00 in Tunis — now Tuesday's work day
    const tuesday0800Tunis = new Date("2026-09-22T07:00:00Z");
    const business = getBusinessDate(tuesday0800Tunis);
    expect(format(business, "yyyy-MM-dd")).toBe("2026-09-22");
    expect(dateToWeekday(business)).toBe("MAR");
  });

  it("reports the Tunisian work day even when the instant is a different day in UTC", () => {
    // 2026-09-20T23:30Z is Monday 00:30 in Tunis — before 08:00, so still Sunday's work day
    expect(format(getBusinessDate(new Date("2026-09-20T23:30:00Z")), "yyyy-MM-dd")).toBe(
      "2026-09-20"
    );

    // 2026-09-21T07:00Z is Monday 08:00 in Tunis — Monday's work day starts
    expect(format(getBusinessDate(new Date("2026-09-21T07:00:00Z")), "yyyy-MM-dd")).toBe(
      "2026-09-21"
    );
  });
});
