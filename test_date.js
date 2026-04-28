import { format, startOfWeek } from "date-fns";

const WEEKDAYS_ORDER = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
function dateToWeekday(d) {
  const idx = (d.getDay() + 6) % 7;
  return WEEKDAYS_ORDER[idx];
}

const d = new Date();
d.setDate(d.getDate() - 1); // yesterday
console.log("Date object:", d);
console.log("format:", format(d, "yyyy-MM-dd"));
console.log("weekday:", dateToWeekday(d));
console.log("weekStart:", format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"));
