import { describe, it, expect } from "vitest";
import {
  getPreviousCalendarDay,
  findStreaks,
  calculateConsecutiveAbsences,
} from "../lib/consecutiveAbsences";

describe("consecutiveAbsences logic", () => {
  describe("getPreviousCalendarDay", () => {
    it("returns the exact previous day without skipping weekends", () => {
      expect(getPreviousCalendarDay("2026-11-18")).toBe("2026-11-17");
      expect(getPreviousCalendarDay("2026-11-16")).toBe("2026-11-15"); // Monday -> Sunday (not skipped!)
      expect(getPreviousCalendarDay("2026-11-15")).toBe("2026-11-14"); // Sunday -> Saturday
      expect(getPreviousCalendarDay("2026-11-01")).toBe("2026-10-31"); // Month boundary
      expect(getPreviousCalendarDay("2026-01-01")).toBe("2025-12-31"); // Year boundary
    });
  });

  describe("findStreaks (no weekend skipping, every 3+ days)", () => {
    it("identifies a 3-day consecutive absence including weekend days", () => {
      // Friday 2026-11-13, Saturday 2026-11-14, Sunday 2026-11-15
      const dates = ["2026-11-13", "2026-11-14", "2026-11-15"];
      const streaks = findStreaks(dates);
      expect(streaks).toHaveLength(1);
      expect(streaks[0]).toEqual({
        count: 3,
        start: "2026-11-13",
        end: "2026-11-15",
      });
    });

    it("does NOT count Friday and Monday as consecutive if weekend wasn't absent", () => {
      // Friday 2026-11-13 and Monday 2026-11-16 only (2 days, separated by weekend)
      const dates = ["2026-11-13", "2026-11-16"];
      const streaks = findStreaks(dates);
      expect(streaks).toHaveLength(0);
    });

    it("counts 4 consecutive days across weekend (Fri, Sat, Sun, Mon)", () => {
      const dates = ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"];
      const streaks = findStreaks(dates);
      expect(streaks).toHaveLength(1);
      expect(streaks[0]).toEqual({
        count: 4,
        start: "2026-11-13",
        end: "2026-11-16",
      });
    });

    it("ignores streaks with less than 3 days", () => {
      expect(findStreaks(["2026-11-10", "2026-11-11"])).toHaveLength(0);
      expect(findStreaks(["2026-11-10"])).toHaveLength(0);
      expect(findStreaks([])).toHaveLength(0);
    });

    it("identifies multiple distinct streaks for the same student", () => {
      const dates = [
        "2026-10-01", "2026-10-02", "2026-10-03", // Streak 1 (3 days)
        "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08" // Streak 2 (4 days)
      ];
      const streaks = findStreaks(dates);
      expect(streaks).toHaveLength(2);
      expect(streaks[0]).toEqual({
        count: 4,
        start: "2026-11-05",
        end: "2026-11-08",
      });
      expect(streaks[1]).toEqual({
        count: 3,
        start: "2026-10-01",
        end: "2026-10-03",
      });
    });
  });

  describe("calculateConsecutiveAbsences (records stay permanently)", () => {
    it("preserves completed past streaks so the record stays", () => {
      const students = [
        {
          id: "stu-1",
          nom_complet: "Ahmed Ben Ali",
          telephone: "12345678",
          chambres: {
            numero: "101",
            dortoirs: { id: "dortoir-a", code: "A" }
          }
        }
      ];

      // Historical absences: student was absent Nov 10, 11, 12 (3 days)
      // Then on Nov 13, student was present (not absent).
      // Dortoir latest checklist date is Nov 13.
      const pastAbsences = [
        { dortoir_id: "dortoir-a", date: "2026-11-13", noms_absents: "Someone Else" },
        { dortoir_id: "dortoir-a", date: "2026-11-12", noms_absents: "Ahmed Ben Ali" },
        { dortoir_id: "dortoir-a", date: "2026-11-11", noms_absents: "Ahmed Ben Ali" },
        { dortoir_id: "dortoir-a", date: "2026-11-10", noms_absents: "Ahmed Ben Ali" },
      ];

      const records = calculateConsecutiveAbsences(students, pastAbsences);
      // The record must NOT be discarded!
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        studentId: "stu-1",
        nom_complet: "Ahmed Ben Ali",
        count: 3,
        start: "2026-11-10",
        end: "2026-11-12",
        isActive: false,
        status: "terminee",
      });
    });

    it("marks streaks as active when they reach the latest checklist date", () => {
      const students = [
        {
          id: "stu-2",
          nom_complet: "Sami Trabelsi",
          telephone: "98765432",
          chambres: {
            numero: "202",
            dortoirs: { id: "dortoir-b", code: "B" }
          }
        }
      ];

      const pastAbsences = [
        { dortoir_id: "dortoir-b", date: "2026-11-18", noms_absents: "Sami Trabelsi" },
        { dortoir_id: "dortoir-b", date: "2026-11-17", noms_absents: "Sami Trabelsi" },
        { dortoir_id: "dortoir-b", date: "2026-11-16", noms_absents: "Sami Trabelsi" },
      ];

      const records = calculateConsecutiveAbsences(students, pastAbsences);
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        studentId: "stu-2",
        nom_complet: "Sami Trabelsi",
        count: 3,
        start: "2026-11-16",
        end: "2026-11-18",
        isActive: true,
        status: "en_cours",
      });
    });
  });
});
