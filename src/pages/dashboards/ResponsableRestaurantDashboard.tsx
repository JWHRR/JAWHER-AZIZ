import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Utensils, CalendarDays, Sun } from "lucide-react";
import { addDays, format, startOfWeek, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { REPAS_LABELS, RepasType, dateToWeekday } from "@/lib/types";
import { getBusinessDate } from "@/lib/time";

const REPAS_ORDER: RepasType[] = ["PETIT_DEJEUNER", "DEJEUNER", "DINER"];

/** null = service non assuré, undefined = service non encore saisi. */
type Count = number | null | undefined;

/** Services non assurés : le dîner du samedi et toute la journée du dimanche. */
const isRedundantRestoSlot = (date: Date, repas: RepasType) => {
  const wd = dateToWeekday(date);
  if (wd === "SAM" && repas === "DINER") return true;
  if (wd === "DIM") return true;
  return false;
};

/**
 * Les effectifs weekend sont enregistrés sous le jeudi de leur semaine
 * (`semaine_du`), comme le fait la page Absences pour les surveillants.
 */
export const weekendAnchor = (d: Date) => {
  const monday = startOfWeek(d, { weekStartsOn: 1 });
  const thursday = addDays(monday, 3);
  // Avant jeudi, le weekend concerné est encore celui de la semaine passée.
  return d < thursday ? subDays(thursday, 7) : thursday;
};

interface DayRow {
  date: string;
  label: string;
  perRepas: Record<string, Count>;
  total: number;
}

export default function ResponsableRestaurantDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<DayRow | null>(null);
  const [week, setWeek] = useState<DayRow[]>([]);
  const [weekendRows, setWeekendRows] = useState<{ code: string; nombre: number }[]>([]);
  const [weekendDate, setWeekendDate] = useState<Date>(() => weekendAnchor(getBusinessDate()));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const businessDate = getBusinessDate();
        const monday = startOfWeek(businessDate, { weekStartsOn: 1 });
        const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
        const weekStart = format(monday, "yyyy-MM-dd");
        const weekEnd = format(addDays(monday, 6), "yyyy-MM-dd");

        const anchor = weekendAnchor(businessDate);
        setWeekendDate(anchor);

        const [logsRes, weRes] = await Promise.all([
          supabase
            .from("restaurant_logs")
            .select("date, repas, nombre_eleves")
            .gte("date", weekStart)
            .lte("date", weekEnd),
          supabase
            .from("weekend_effectifs")
            .select("nombre_presents, dortoirs(code)")
            .eq("semaine_du", format(anchor, "yyyy-MM-dd")),
        ]);

        // Plusieurs surveillants peuvent saisir le même service : on additionne.
        const byDate: Record<string, Record<string, number>> = {};
        for (const l of logsRes.data ?? []) {
          const slot = (byDate[l.date] ??= {});
          slot[l.repas] = (slot[l.repas] ?? 0) + (l.nombre_eleves ?? 0);
        }

        const rows: DayRow[] = days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const logged = byDate[key] ?? {};
          const perRepas: Record<string, Count> = {};
          let total = 0;
          for (const r of REPAS_ORDER) {
            if (isRedundantRestoSlot(d, r)) {
              perRepas[r] = null;
              continue;
            }
            const v = logged[r];
            perRepas[r] = v;
            if (typeof v === "number") total += v;
          }
          return { date: key, label: format(d, "EEEE d MMM", { locale: fr }), perRepas, total };
        });

        setWeek(rows);
        setToday(rows.find((r) => r.date === format(businessDate, "yyyy-MM-dd")) ?? null);

        setWeekendRows(
          (weRes.data ?? []).map((w: any) => ({
            code: w.dortoirs?.code ?? "—",
            nombre: w.nombre_presents ?? 0,
          }))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const weekTotal = week.reduce((s, r) => s + r.total, 0);
  const weekendTotal = weekendRows.reduce((s, r) => s + r.nombre, 0);

  const renderCount = (v: Count) => {
    if (v === null) return <span className="text-muted-foreground/60">—</span>;
    if (v === undefined) return <span className="text-muted-foreground italic text-xs">non saisi</span>;
    return <span className="font-semibold">{v}</span>;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Bonjour{" "}
          <span className="bg-clip-text text-transparent bg-gradient-primary drop-shadow-sm">
            {profile?.full_name?.split(" ")[0] || ""}
          </span>{" "}
          👋
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {format(getBusinessDate(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {REPAS_ORDER.map((r) => {
          const v = today?.perRepas[r];
          return (
            <div key={r} className="stat-card">
              <div className="text-xs uppercase font-medium text-primary">{REPAS_LABELS[r]}</div>
              <div className="text-4xl font-bold mt-2">
                {v === null ? (
                  "—"
                ) : v === undefined ? (
                  <span className="text-xl text-muted-foreground italic">non saisi</span>
                ) : (
                  v
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">élèves aujourd&apos;hui</div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Effectif de la semaine
          </CardTitle>
          <CardDescription>
            Comptage relevé par les surveillants à chaque service — semaine du{" "}
            {week.length ? format(new Date(week[0].date), "d MMM", { locale: fr }) : ""} au{" "}
            {week.length ? format(new Date(week[6].date), "d MMM yyyy", { locale: fr }) : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jour</TableHead>
                  {REPAS_ORDER.map((r) => (
                    <TableHead key={r} className="text-right">{REPAS_LABELS[r]}</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {week.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="capitalize">{row.label}</TableCell>
                    {REPAS_ORDER.map((r) => (
                      <TableCell key={r} className="text-right">
                        {renderCount(row.perRepas[r])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">{row.total}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-bold">Total semaine</TableCell>
                  <TableCell colSpan={REPAS_ORDER.length} />
                  <TableCell className="text-right font-bold">{weekTotal}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" /> Effectif weekend
          </CardTitle>
          <CardDescription>
            Élèves restant à l&apos;internat pour le weekend du{" "}
            {format(addDays(weekendDate, 1), "EEEE d MMMM yyyy", { locale: fr })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {weekendRows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Aucun effectif weekend saisi pour cette semaine.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dortoir</TableHead>
                    <TableHead className="text-right">Présents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekendRows.map((r, i) => (
                    <TableRow key={`${r.code}-${i}`}>
                      <TableCell>{r.code}</TableCell>
                      <TableCell className="text-right font-semibold">{r.nombre}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{weekendTotal}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Utensils className="h-3.5 w-3.5" />
        Consultation seule — les effectifs sont saisis par les surveillants.
      </p>
    </div>
  );
}
