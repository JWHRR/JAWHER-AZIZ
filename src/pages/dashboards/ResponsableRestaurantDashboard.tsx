import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Utensils, CalendarDays, Sun, FileDown } from "lucide-react";
import { addDays, format, startOfWeek, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { REPAS_LABELS, RepasType, dateToWeekday } from "@/lib/types";
import { getBusinessDate, parseLocalDate } from "@/lib/time";
import { generateTablePdf } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const REPAS_ORDER: RepasType[] = ["PETIT_DEJEUNER", "DEJEUNER", "DINER"];

type Count = number | null | undefined;

const isRedundantRestoSlot = (date: Date, repas: RepasType) => {
  const wd = dateToWeekday(date);
  if (wd === "SAM" && repas === "DINER") return true;
  if (wd === "DIM") return true;
  return false;
};

export const weekendAnchor = (d: Date) => {
  const monday = startOfWeek(d, { weekStartsOn: 1 });
  const thursday = addDays(monday, 3);
  return d < thursday ? subDays(thursday, 7) : thursday;
};

export interface DayRow {
  date: string;
  label: string;
  perRepas: Record<string, Count>;
  total: number;
}

const countToText = (v: Count) => (v === null ? "-" : v === undefined ? "non saisi" : String(v));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const buildWeekPdfTable = (week: DayRow[], weekTotal: number) => ({
  head: ["Jour", ...REPAS_ORDER.map((r) => REPAS_LABELS[r]), "Total"],
  rows: week.map((row) => [
    capitalize(row.label),
    ...REPAS_ORDER.map((r) => countToText(row.perRepas[r])),
    String(row.total),
  ]),
  foot: [["Total semaine", ...REPAS_ORDER.map(() => ""), String(weekTotal)]],
});

export default function ResponsableRestaurantDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState<DayRow | null>(null);
  const [week, setWeek] = useState<DayRow[]>([]);
  const [weekendRows, setWeekendRows] = useState<{ code: string; nombre: number }[]>([]);
  const [weekendDate, setWeekendDate] = useState<Date>(() => weekendAnchor(getBusinessDate()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const businessDate = getBusinessDate();
        const monday = startOfWeek(businessDate, { weekStartsOn: 1 });
        const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
        const weekStart = format(monday, "yyyy-MM-dd");
        const weekEnd = format(addDays(monday, 6), "yyyy-MM-dd");
        const anchor = weekendAnchor(businessDate);
        setWeekendDate(anchor);

        const [logsRes, weRes, dortRes] = await Promise.all([
          supabase.from("restaurant_logs").select("date, repas, nombre_eleves").gte("date", weekStart).lte("date", weekEnd),
          supabase.from("weekend_effectifs").select("dortoir_id, nombre_presents").eq("semaine_du", format(anchor, "yyyy-MM-dd")),
          supabase.from("dortoirs").select("id, code"),
        ]);

        const firstError = logsRes.error ?? weRes.error ?? dortRes.error;
        if (firstError) { console.error("Chargement restaurant:", firstError); setError(firstError.message); }

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
            if (isRedundantRestoSlot(d, r)) { perRepas[r] = null; continue; }
            const v = logged[r];
            perRepas[r] = v;
            if (typeof v === "number") total += v;
          }
          return { date: key, label: format(d, "EEEE d MMM", { locale: fr }), perRepas, total };
        });

        setWeek(rows);
        setToday(rows.find((r) => r.date === format(businessDate, "yyyy-MM-dd")) ?? null);

        const codeById: Record<string, string> = Object.fromEntries((dortRes.data ?? []).map((d: any) => [d.id, d.code]));
        setWeekendRows((weRes.data ?? []).map((w: any) => ({ code: codeById[w.dortoir_id] ?? "-", nombre: w.nombre_presents ?? 0 })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement des effectifs...</p>
      </div>
    );
  }

  const weekTotal = week.reduce((s, r) => s + r.total, 0);
  const weekendTotal = weekendRows.reduce((s, r) => s + r.nombre, 0);
  const todayTotal = today?.total ?? 0;

  const renderCount = (v: Count) => {
    if (v === null) return <span className="text-muted-foreground/50">-</span>;
    if (v === undefined) return <span className="text-muted-foreground italic text-xs">-</span>;
    return <span className="font-semibold">{v}</span>;
  };

  const exportWeekPdf = () => {
    if (!week.length) return;
    const from = week[0].date;
    const to = week[week.length - 1].date;
    generateTablePdf({
      title: "Effectif Restaurant - Semaine",
      subtitle: `Du ${format(parseLocalDate(from), "d MMMM yyyy", { locale: fr })} au ${format(parseLocalDate(to), "d MMMM yyyy", { locale: fr })} - comptage releve par les surveillants`,
      filename: `effectif_restaurant_${from}_${to}.pdf`,
      ...buildWeekPdfTable(week, weekTotal),
    });
    toast.success("PDF genere");
  };

  const exportWeekendPdf = () => {
    const anchor = format(weekendDate, "yyyy-MM-dd");
    generateTablePdf({
      title: "Effectif Weekend",
      subtitle: `Weekend du ${format(addDays(weekendDate, 1), "EEEE d MMMM yyyy", { locale: fr })}`,
      filename: `effectif_weekend_${anchor}.pdf`,
      head: ["Dortoir", "Presents"],
      rows: weekendRows.map((r) => [r.code, String(r.nombre)]),
      foot: [["Total", String(weekendTotal)]],
    });
    toast.success("PDF genere");
  };

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Bonjour, {profile?.full_name?.split(" ")[0] || ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          {format(getBusinessDate(), "EEEE d MMMM yyyy", { locale: fr })} — Tableau de bord restaurant
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Impossible de lire les effectifs : {error}
        </div>
      )}

      {/* ── Résumé du jour ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total aujourd'hui</div>
          <div className="text-4xl font-bold">{todayTotal}</div>
          <div className="text-xs text-muted-foreground">repas servis</div>
        </div>
        {REPAS_ORDER.map((r) => {
          const v = today?.perRepas[r];
          return (
            <div key={r} className="rounded-lg border bg-card p-4 flex flex-col gap-1">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {r === "PETIT_DEJEUNER" ? "Petit-déjeuner" : r === "DEJEUNER" ? "Déjeuner" : "Dîner"}
              </div>
              <div className="text-3xl font-bold">
                {v === null ? "—" : v === undefined ? (
                  <span className="text-base text-muted-foreground font-normal">—</span>
                ) : v}
              </div>
              <div className="text-xs text-muted-foreground">repas servis</div>
            </div>
          );
        })}
      </div>

      {/* ── Weekly table (desktop) / stacked cards (mobile) ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Effectif de la semaine
              </CardTitle>
              <CardDescription className="mt-1">
                Du {week.length ? format(parseLocalDate(week[0].date), "d MMM", { locale: fr }) : ""}{" "}
                au {week.length ? format(parseLocalDate(week[6].date), "d MMM yyyy", { locale: fr }) : ""}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportWeekPdf} className="shrink-0">
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>

          {/* Mobile: stacked day cards */}
          <div className="sm:hidden space-y-2">
            {week.map((row) => {
              const isToday = row.date === format(getBusinessDate(), "yyyy-MM-dd");
              return (
                <div key={row.date} className={`rounded-lg border p-3 ${isToday ? "border-primary/40 bg-muted/30" : "bg-muted/10"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold capitalize ${isToday ? "text-primary" : ""}`}>{row.label}</span>
                    <span className="text-sm font-bold">{row.total > 0 ? `Total : ${row.total}` : ""}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {REPAS_ORDER.map((r) => {
                      const v = row.perRepas[r];
                      return (
                        <div key={r} className="flex flex-col items-center gap-0.5">
                          <span className="text-xs text-muted-foreground">{r === "PETIT_DEJEUNER" ? "Matin" : r === "DEJEUNER" ? "Midi" : "Soir"}</span>
                          <span className="text-sm font-semibold">{v === null ? "—" : v === undefined ? "—" : v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Total semaine</span>
              <span className="text-lg font-bold">{weekTotal}</span>
            </div>
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block">
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
                {week.map((row) => {
                  const isToday = row.date === format(getBusinessDate(), "yyyy-MM-dd");
                  return (
                    <TableRow key={row.date} className={isToday ? "bg-primary/5 font-semibold" : ""}>
                      <TableCell className="capitalize">{row.label}{isToday && <span className="ml-2 text-[10px] bg-primary text-primary-foreground rounded px-1 py-0.5">Auj.</span>}</TableCell>
                      {REPAS_ORDER.map((r) => (
                        <TableCell key={r} className="text-right">{renderCount(row.perRepas[r])}</TableCell>
                      ))}
                      <TableCell className="text-right font-bold">{row.total}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">Total semaine</TableCell>
                  <TableCell colSpan={REPAS_ORDER.length} />
                  <TableCell className="text-right font-bold">{weekTotal}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Weekend effectif ── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="h-4 w-4 text-primary" /> Effectif weekend
              </CardTitle>
              <CardDescription className="mt-1">
                Eleves restant a l internat pour le weekend du{" "}
                {format(addDays(weekendDate, 1), "EEEE d MMMM yyyy", { locale: fr })}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportWeekendPdf} disabled={weekendRows.length === 0} className="shrink-0">
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {weekendRows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">
              Aucun effectif weekend saisi pour cette semaine.
            </p>
          ) : (
            <>
              {/* Mobile: simple stacked list */}
              <div className="sm:hidden space-y-2">
                {weekendRows.map((r, i) => (
                  <div key={`${r.code}-${i}`} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <span className="font-medium text-sm">Dortoir {r.code}</span>
                    <span className="font-bold text-lg">{r.nombre}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-semibold text-sm">Total</span>
                  <span className="font-bold text-lg">{weekendTotal}</span>
                </div>
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dortoir</TableHead>
                      <TableHead className="text-right">Presents</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekendRows.map((r, i) => (
                      <TableRow key={`${r.code}-${i}`}>
                        <TableCell>{r.code}</TableCell>
                        <TableCell className="text-right font-semibold">{r.nombre}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{weekendTotal}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Utensils className="h-3.5 w-3.5" />
        Consultation seule - les effectifs sont saisis par les surveillants.
      </p>
    </div>
  );
}
