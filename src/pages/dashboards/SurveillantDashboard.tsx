import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ClipboardList, Utensils, Calendar as CalIcon, BedDouble } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SLOT_LABELS, REPAS_LABELS, dateToWeekday } from "@/lib/types";
import { DoneBadge } from "@/components/StatusBadge";

export default function SurveillantDashboard() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myDortoirs, setMyDortoirs] = useState<any[]>([]);
  const [todayPerms, setTodayPerms] = useState<any[]>([]);
  const [todayResto, setTodayResto] = useState<any[]>([]);
  const [todayInspections, setTodayInspections] = useState<any[]>([]);
  const [absenceDoneToday, setAbsenceDoneToday] = useState<Record<string, boolean>>({});
  const [restoLogs, setRestoLogs] = useState<Record<string, boolean>>({});
  const [isWeekendPerm, setIsWeekendPerm] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const wd = dateToWeekday(new Date());
    (async () => {
      const weekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      
      const [da, permTpl, permOv, restoTpl, restoOv, inspections, wp] = await Promise.all([
        supabase.from("dortoir_assignments").select("*, dortoirs(*)").eq("surveillant_id", user.id),
        supabase.from("permanence_template").select("*").eq("surveillant_id", user.id).eq("weekday", wd),
        supabase.from("permanences").select("*").eq("surveillant_id", user.id).eq("date", today),
        supabase.from("restaurant_template").select("*").eq("surveillant_id", user.id).eq("weekday", wd),
        supabase.from("restaurant_assignments").select("*").eq("surveillant_id", user.id).eq("date", today),
        supabase.from("chambre_inspections").select("id").eq("surveillant_id", user.id).eq("date", today),
        supabase.from("weekend_permanences").select("id").eq("surveillant_id", user.id).eq("week_start_date", weekStartStr),
      ]);
      
      setMyDortoirs(da.data ?? []);
      setTodayPerms([...(permTpl.data ?? []), ...(permOv.data ?? [])]);
      
      const allResto = [...(restoTpl.data ?? []), ...(restoOv.data ?? [])];
      // Deduplicate by repas type so we don't show the same meal twice
      const uniqueResto = Array.from(new Map(allResto.map(r => [r.repas, r])).values());
      setTodayResto(uniqueResto);
      
      setTodayInspections(inspections.data ?? []);
      setIsWeekendPerm((wp.data ?? []).length > 0);

      const dortoirIds = (da.data ?? []).map((d: any) => d.dortoir_id);
      if (dortoirIds.length) {
        const { data: abs } = await supabase
          .from("absences")
          .select("dortoir_id")
          .eq("date", today)
          .in("dortoir_id", dortoirIds);
        const map: Record<string, boolean> = {};
        dortoirIds.forEach((id: string) => (map[id] = false));
        (abs ?? []).forEach((a: any) => (map[a.dortoir_id] = true));
        setAbsenceDoneToday(map);
      }

      const repasList = uniqueResto.map((r: any) => r.repas);
      if (repasList.length) {
        const { data: logs } = await supabase
          .from("restaurant_logs")
          .select("repas")
          .eq("surveillant_id", user.id)
          .eq("date", today)
          .in("repas", repasList);
        const m: Record<string, boolean> = {};
        repasList.forEach((r: string) => (m[r] = false));
        (logs ?? []).forEach((l: any) => (m[l.repas] = true));
        setRestoLogs(m);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">Bonjour {profile?.full_name?.split(" ")[0] || ""} 👋</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-primary" /> Mes dortoirs
            </CardTitle>
            <CardDescription>Pointage absences quotidien</CardDescription>
          </CardHeader>
          <CardContent>
            {myDortoirs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dortoir assigné. Contactez l'administrateur.</p>
            ) : (
              <ul className="space-y-2">
                {myDortoirs.map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <div className="font-semibold">Dortoir {d.dortoirs.code}</div>
                      <div className="text-xs text-muted-foreground">Pointage du soir</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DoneBadge done={absenceDoneToday[d.dortoir_id]} />
                      <Button asChild size="sm" variant={absenceDoneToday[d.dortoir_id] ? "outline" : "default"}>
                        <Link to="/absences">{absenceDoneToday[d.dortoir_id] ? "Voir" : "Pointer"}</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Inspections de chambres
            </CardTitle>
            <CardDescription>Vos inspections quotidiennes</CardDescription>
          </CardHeader>
          <CardContent>
            {myDortoirs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dortoir assigné pour l'inspection.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <div className="font-semibold">Inspections d'aujourd'hui</div>
                    <div className="text-xs text-muted-foreground">{todayInspections.length} chambre(s) inspectée(s)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DoneBadge done={todayInspections.length > 0} />
                    <Button asChild size="sm" variant={todayInspections.length > 0 ? "outline" : "default"}>
                      <Link to="/inspections">{todayInspections.length > 0 ? "Voir" : "Inspecter"}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-primary" /> Permanences aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayPerms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune permanence aujourd'hui.</p>
            ) : (
              <ul className="space-y-2">
                {todayPerms.map((p: any) => (
                  <li key={p.id} className="p-3 rounded-lg border bg-primary-soft">
                    <div className="font-semibold text-primary">{SLOT_LABELS[p.slot as keyof typeof SLOT_LABELS]}</div>
                    {p.notes && <div className="text-xs text-muted-foreground mt-1">{p.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary" /> Restaurant aujourd'hui
            </CardTitle>
            <CardDescription>Pointage des élèves au restaurant</CardDescription>
          </CardHeader>
          <CardContent>
            {todayResto.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun pointage restaurant assigné aujourd'hui.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {todayResto.map((r: any) => (
                  <li key={r.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="font-semibold">{REPAS_LABELS[r.repas as keyof typeof REPAS_LABELS]}</div>
                    <div className="flex items-center justify-between mt-2">
                      <DoneBadge done={restoLogs[r.repas]} />
                      <Button asChild size="sm" variant={restoLogs[r.repas] ? "outline" : "default"}>
                        <Link to="/restaurant">{restoLogs[r.repas] ? "Voir" : "Pointer"}</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Rappels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isWeekendPerm && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 mb-2">
                <span className="text-destructive font-bold">⚠️</span>
                <span className="font-semibold text-destructive">Vous êtes de permanence ce week-end (Samedi 15h30-19h, Dimanche 08h-12h / 14h-19h).</span>
              </div>
            )}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-soft border border-warning/30">
              <span className="text-warning">⏰</span>
              <span>Pointage des absences à effectuer chaque soir.</span>
            </div>
            {format(new Date(), "EEEE", { locale: fr }) === "jeudi" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary-soft border border-primary/30">
                <span className="text-primary">📋</span>
                <span>Aujourd'hui jeudi : effectif weekend à recenser.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
