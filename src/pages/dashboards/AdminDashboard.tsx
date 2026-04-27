import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Users, BedDouble, ClipboardCheck, Wrench, TrendingUp,
  Calendar as CalIcon, AlertTriangle, DoorOpen, CheckCircle2,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { dateToWeekday, SLOT_LABELS, REPAS_LABELS, PermanenceSlot, RepasType } from "@/lib/types";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Stats {
  totalUsers: number;
  totalDortoirs: number;
  absencesAujourdhui: number;
  reclamationsEnAttente: number;
  reclamationsEnCours: number;
  reclamationsTerminees: number;
  restaurantLogsAujourdhui: number;
  permanencesAujourdhui: number;
  permanencesLogsAujourdhui: number;
  inspectionsAujourdhui: number;
}

interface MissingTask {
  type: "ABSENCE" | "RESTAURANT" | "PERMANENCE" | "INSPECTION";
  surveillantName: string;
  detail: string;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [missingYesterday, setMissingYesterday] = useState<MissingTask[]>([]);
  const [todayActivity, setTodayActivity] = useState<{ done: MissingTask[]; pending: MissingTask[] }>({ done: [], pending: [] });

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const todayWd = dateToWeekday(new Date());
    const yesterdayWd = dateToWeekday(subDays(new Date(), 1));

    (async () => {
      // ---- Top stats
      const [u, d, a, rPend, rProg, rDone, p, perm, pLogs, ins, act] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("dortoirs").select("*", { count: "exact", head: true }),
        supabase.from("absences").select("nombre_absents").eq("date", today),
        supabase.from("reclamations").select("*", { count: "exact", head: true }).eq("status", "EN_ATTENTE"),
        supabase.from("reclamations").select("*", { count: "exact", head: true }).eq("status", "EN_COURS"),
        supabase.from("reclamations").select("*", { count: "exact", head: true }).eq("status", "TERMINEE"),
        supabase.from("restaurant_logs").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("permanences").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("permanence_logs").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("chambre_inspections").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      setStats({
        totalUsers: u.count ?? 0,
        totalDortoirs: d.count ?? 0,
        absencesAujourdhui: (a.data ?? []).reduce((s, r: any) => s + (r.nombre_absents || 0), 0),
        reclamationsEnAttente: rPend.count ?? 0,
        reclamationsEnCours: rProg.count ?? 0,
        reclamationsTerminees: rDone.count ?? 0,
        restaurantLogsAujourdhui: p.count ?? 0,
        permanencesAujourdhui: perm.count ?? 0,
        permanencesLogsAujourdhui: pLogs.count ?? 0,
        inspectionsAujourdhui: ins.count ?? 0,
      });
      setRecent(act.data ?? []);

      // ---- Profile names cache
      const { data: allProfs } = await supabase
        .from("profiles")
        .select("user_id, full_name, is_active")
        .eq("is_active", true);
      const nameById: Record<string, string> = Object.fromEntries(
        (allProfs ?? []).map((p: any) => [p.user_id, p.full_name || "(sans nom)"])
      );

      // ---- Compute missing tasks for YESTERDAY
      const missing: MissingTask[] = [];

      // 1. Absences yesterday: every dortoir-assigned surveillant should have logged for each of his dortoirs
      const { data: dortoirAssigns } = await supabase
        .from("dortoir_assignments")
        .select("dortoir_id, surveillant_id, dortoirs(code)");
      const { data: yAbs } = await supabase
        .from("absences")
        .select("dortoir_id, surveillant_id")
        .eq("date", yesterday);
      const absDoneSet = new Set((yAbs ?? []).map((x: any) => `${x.surveillant_id}:${x.dortoir_id}`));
      (dortoirAssigns ?? []).forEach((da: any) => {
        if (nameById[da.surveillant_id] && !absDoneSet.has(`${da.surveillant_id}:${da.dortoir_id}`)) {
          missing.push({
            type: "ABSENCE",
            surveillantName: nameById[da.surveillant_id],
            detail: `Absences Dortoir ${da.dortoirs?.code ?? "?"}`,
          });
        }
      });

      // 2. Restaurant: from template for yesterday's weekday + overrides
      const { data: tplR } = await supabase
        .from("restaurant_template")
        .select("surveillant_id, repas")
        .eq("weekday", yesterdayWd);
      const { data: ovR } = await supabase
        .from("restaurant_assignments")
        .select("surveillant_id, repas")
        .eq("date", yesterday);
      const expectedResto = [
        ...((tplR ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
        ...((ovR ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
      ];
      const { data: yLogs } = await supabase
        .from("restaurant_logs")
        .select("surveillant_id, repas")
        .eq("date", yesterday);
      const restoDoneSet = new Set((yLogs ?? []).map((x: any) => `${x.surveillant_id}:${x.repas}`));
      expectedResto.forEach((e) => {
        if (nameById[e.s] && !restoDoneSet.has(`${e.s}:${e.r}`)) {
          missing.push({
            type: "RESTAURANT",
            surveillantName: nameById[e.s],
            detail: `Effectif ${REPAS_LABELS[e.r as RepasType] ?? e.r}`,
          });
        }
      });

      // 3. Inspections: each dortoir-assigned surveillant should have done at least 1 inspection yesterday
      const { data: yIns } = await supabase
        .from("chambre_inspections")
        .select("surveillant_id")
        .eq("date", yesterday);
      const inspDoneSet = new Set((yIns ?? []).map((x: any) => x.surveillant_id));
      const surveillantsWithDortoirs = new Set((dortoirAssigns ?? []).map((d: any) => d.surveillant_id));
      surveillantsWithDortoirs.forEach((sid) => {
        if (nameById[sid as string] && !inspDoneSet.has(sid)) {
          missing.push({
            type: "INSPECTION",
            surveillantName: nameById[sid as string],
            detail: "Inspection chambre",
          });
        }
      });
      setMissingYesterday(missing);

      // ---- Compute TODAY pending vs done at a glance
      const done: MissingTask[] = [];
      const pending: MissingTask[] = [];

      // Today absences
      const { data: tAbs } = await supabase
        .from("absences")
        .select("dortoir_id, surveillant_id")
        .eq("date", today);
      const tAbsSet = new Set((tAbs ?? []).map((x: any) => `${x.surveillant_id}:${x.dortoir_id}`));
      (dortoirAssigns ?? []).forEach((da: any) => {
        const name = nameById[da.surveillant_id];
        if (!name) return;
        const item: MissingTask = {
          type: "ABSENCE",
          surveillantName: name,
          detail: `Absences D. ${da.dortoirs?.code ?? "?"}`,
        };
        if (tAbsSet.has(`${da.surveillant_id}:${da.dortoir_id}`)) done.push(item);
        else pending.push(item);
      });

      // Today restaurant
      const { data: tplR2 } = await supabase
        .from("restaurant_template")
        .select("surveillant_id, repas")
        .eq("weekday", todayWd);
      const { data: ovR2 } = await supabase
        .from("restaurant_assignments")
        .select("surveillant_id, repas")
        .eq("date", today);
      const expectedToday = [
        ...((tplR2 ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
        ...((ovR2 ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
      ];
      const { data: tLogs } = await supabase
        .from("restaurant_logs")
        .select("surveillant_id, repas")
        .eq("date", today);
      const tLogsSet = new Set((tLogs ?? []).map((x: any) => `${x.surveillant_id}:${x.repas}`));
      expectedToday.forEach((e) => {
        const name = nameById[e.s];
        if (!name) return;
        const item: MissingTask = {
          type: "RESTAURANT",
          surveillantName: name,
          detail: REPAS_LABELS[e.r as RepasType] ?? e.r,
        };
        if (tLogsSet.has(`${e.s}:${e.r}`)) done.push(item);
        else pending.push(item);
      });

      setTodayActivity({ done, pending });
    })();
  }, []);

  if (!stats) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: "Utilisateurs actifs", value: stats.totalUsers, icon: Users, color: "text-primary", bg: "bg-primary-soft" },
    { label: "Dortoirs", value: stats.totalDortoirs, icon: BedDouble, color: "text-info", bg: "bg-accent" },
    { label: "Absences aujourd'hui", value: stats.absencesAujourdhui, icon: ClipboardCheck, color: "text-warning", bg: "bg-warning-soft" },
    { label: "Permanences (Planning)", value: stats.permanencesAujourdhui, icon: CalIcon, color: "text-primary", bg: "bg-primary-soft" },
    { label: "Permanences (Effectuées)", value: stats.permanencesLogsAujourdhui, icon: CheckCircle2, color: "text-primary", bg: "bg-primary-soft" },
    { label: "Effectifs restaurant", value: stats.restaurantLogsAujourdhui, icon: TrendingUp, color: "text-success", bg: "bg-success-soft" },
    { label: "Inspections chambres", value: stats.inspectionsAujourdhui, icon: DoorOpen, color: "text-info", bg: "bg-accent" },
    { label: "Réclamations en attente", value: stats.reclamationsEnAttente, icon: Wrench, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="mb-2">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Bonjour <span className="bg-clip-text text-transparent bg-gradient-primary drop-shadow-sm">{profile?.full_name?.split(" ")[0] || ""}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Warnings: missing tasks of yesterday */}
      {missingYesterday.length > 0 && (
        <Card className="border-destructive/30 bg-gradient-to-br from-destructive/10 to-transparent shadow-sm backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive font-bold">
              <AlertTriangle className="h-5 w-5" />
              Tâches manquantes — hier ({format(subDays(new Date(), 1), "d MMM", { locale: fr })})
            </CardTitle>
            <CardDescription className="text-destructive/80 font-medium">{missingYesterday.length} action(s) non effectuée(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {missingYesterday.map((m, i) => (
                <li key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-background/50 border border-border/40 transition-all hover:bg-background/80 hover:shadow-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Badge variant="outline" className="text-[10px] bg-background text-destructive border-destructive/20">{m.type}</Badge>
                    {m.surveillantName}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
            </div>
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Tâche(s) du jour</CardTitle>
            <CardDescription>
              {todayActivity.done.length} effectué(s) · {todayActivity.pending.length} en attente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayActivity.pending.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-warning mb-1.5 uppercase tracking-wide">À faire</div>
                <ul className="space-y-1">
                  {todayActivity.pending.slice(0, 8).map((p, i) => (
                    <li key={i} className="text-sm flex justify-between p-1.5 rounded bg-warning-soft">
                      <span>{p.surveillantName}</span>
                      <span className="text-xs text-muted-foreground">{p.detail}</span>
                    </li>
                  ))}
                </ul>
                {todayActivity.pending.length > 8 && (
                  <p className="text-xs text-muted-foreground mt-1">… et {todayActivity.pending.length - 8} autres</p>
                )}
              </div>
            )}
            {todayActivity.done.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-success mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Effectué
                </div>
                <ul className="space-y-1">
                  {todayActivity.done.slice(0, 8).map((p, i) => (
                    <li key={i} className="text-sm flex justify-between p-1.5 rounded bg-success-soft">
                      <span>{p.surveillantName}</span>
                      <span className="text-xs text-muted-foreground">{p.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {todayActivity.done.length === 0 && todayActivity.pending.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucune tâche prévue aujourd'hui.</p>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Réclamations</CardTitle>
            <CardDescription>État global</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>En attente</span><span className="font-semibold text-warning">{stats.reclamationsEnAttente}</span></div>
            <div className="flex justify-between text-sm"><span>En cours</span><span className="font-semibold text-primary">{stats.reclamationsEnCours}</span></div>
            <div className="flex justify-between text-sm"><span>Terminées</span><span className="font-semibold text-success">{stats.reclamationsTerminees}</span></div>
            <Button asChild variant="outline" size="sm" className="w-full mt-2">
              <Link to="/reclamations">Voir tout</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune activité récente.</p>
            ) : (
              <ul className="space-y-2">
                {recent.map((a) => (
                  <li key={a.id} className="text-sm flex justify-between border-b last:border-0 pb-2 last:pb-0">
                    <span>{a.action} {a.entity ? `· ${a.entity}` : ""}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd/MM HH:mm")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
