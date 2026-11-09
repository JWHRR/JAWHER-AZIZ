import { describe, it, expect } from "vitest";
import type { MissingTask } from "@/lib/missingTasks";

describe("Missing Tasks logic", () => {
  const sampleTasks: MissingTask[] = [
    {
      type: "ABSENCE",
      surveillant_id: "surv-1",
      surveillantName: "Ali Ben Salah",
      detail: "Absences Dortoir A",
    },
    {
      type: "RESTAURANT",
      surveillant_id: "surv-1",
      surveillantName: "Ali Ben Salah",
      detail: "Effectif Dîner",
    },
    {
      type: "INSPECTION",
      surveillant_id: "surv-2",
      surveillantName: "Fatma Mansouri",
      detail: "Inspection Dortoir B",
    },
  ];

  it("calculates accurate summary breakdown and surveillant count", () => {
    const total = sampleTasks.length;
    const absences = sampleTasks.filter((t) => t.type === "ABSENCE").length;
    const restaurants = sampleTasks.filter((t) => t.type === "RESTAURANT").length;
    const inspections = sampleTasks.filter((t) => t.type === "INSPECTION").length;
    const uniqueSurveillants = new Set(sampleTasks.map((t) => t.surveillant_id)).size;

    expect(total).toBe(3);
    expect(absences).toBe(1);
    expect(restaurants).toBe(1);
    expect(inspections).toBe(1);
    expect(uniqueSurveillants).toBe(2);
  });

  it("groups tasks by surveillant correctly", () => {
    const groups: Record<
      string,
      { surveillantId: string; surveillantName: string; tasks: MissingTask[] }
    > = {};

    sampleTasks.forEach((task) => {
      if (!groups[task.surveillant_id]) {
        groups[task.surveillant_id] = {
          surveillantId: task.surveillant_id,
          surveillantName: task.surveillantName,
          tasks: [],
        };
      }
      groups[task.surveillant_id].tasks.push(task);
    });

    const groupList = Object.values(groups);
    expect(groupList).toHaveLength(2);

    const aliGroup = groupList.find((g) => g.surveillantId === "surv-1");
    expect(aliGroup).toBeDefined();
    expect(aliGroup?.tasks).toHaveLength(2);
    expect(aliGroup?.tasks.map((t) => t.type)).toEqual(["ABSENCE", "RESTAURANT"]);

    const fatmaGroup = groupList.find((g) => g.surveillantId === "surv-2");
    expect(fatmaGroup).toBeDefined();
    expect(fatmaGroup?.tasks).toHaveLength(1);
    expect(fatmaGroup?.tasks[0].type).toBe("INSPECTION");
  });

  it("filters tasks by category and search keyword correctly", () => {
    const filterTasks = (tasks: MissingTask[], type: string, search: string) => {
      const term = search.trim().toLowerCase();
      return tasks.filter((task) => {
        const matchType = type === "ALL" || task.type === type;
        const matchSearch =
          !term ||
          task.surveillantName.toLowerCase().includes(term) ||
          task.detail.toLowerCase().includes(term);
        return matchType && matchSearch;
      });
    };

    // Filter by type
    expect(filterTasks(sampleTasks, "ABSENCE", "")).toHaveLength(1);
    expect(filterTasks(sampleTasks, "RESTAURANT", "")).toHaveLength(1);

    // Search by surveillant name
    expect(filterTasks(sampleTasks, "ALL", "Ali")).toHaveLength(2);
    expect(filterTasks(sampleTasks, "ALL", "Fatma")).toHaveLength(1);

    // Search by detail
    expect(filterTasks(sampleTasks, "ALL", "Dortoir B")).toHaveLength(1);
    expect(filterTasks(sampleTasks, "ALL", "Inexistant")).toHaveLength(0);
  });
});
