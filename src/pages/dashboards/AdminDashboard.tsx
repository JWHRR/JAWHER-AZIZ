import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Users, BedDouble, ClipboardCheck, Wrench, TrendingUp,
  Calendar as CalIcon, AlertTriangle, DoorOpen, CheckCircle2, ChevronDown,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { dateToWeekday, SLOT_LABELS, REPAS_LABELS, PermanenceSlot, RepasType } from "@/lib/types";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getBusinessDate } from "@/lib/time";

interface Stats {
  totalUsers: number;
  totalDortoirs: number;
  absencesAujourdhui: number;
  restaurantLogsAujourdhui: number;
  permanencesAujourdhui: number;
  permanencesLogsAujourdhui: number;
  inspectionsAujourdhui: number;
}

interface MissingTask {
  type: "ABSENCE" | "RESTAURANT" | "PERMANENCE" | "INSPECTION";
  surveillantName: string;
  surveillant_id: string;
  detail: string;
}

const isRedundantSlot = (wd: string, slot: string) => {
  if (wd === "SAM" && slot === "APRES_MIDI") return true;
  if (wd === "DIM" && (slot === "MATIN" || slot === "APRES_MIDI")) return true;
  return false;
};

const isRedundantRestoSlot = (wd: string, repas: string) => {
  if (wd === "SAM" && repas === "DINER") return true;
  if (wd === "DIM") return true;
  return false;
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [missingYesterday, setMissingYesterday] = useState<MissingTask[]>([]);
  const [missingOpen, setMissingOpen] = useState(false);
  const [todayActivity, setTodayActivity] = useState<{ done: MissingTask[]; pending: MissingTask[]; info: MissingTask[] }>({ done: [], pending: [], info: [] });

  useEffect(() => {
    const businessDate = getBusinessDate();
    const today = format(businessDate, "yyyy-MM-dd");
    const yesterday = format(subDays(businessDate, 1), "yyyy-MM-dd");
    const todayWd = dateToWeekday(businessDate);
    const yesterdayWd = dateToWeekday(subDays(businessDate, 1));

    (async () => {
      // ---- Top stats
      const [u, d, a, p, perm, pLogs, ins] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("dortoirs").select("*", { count: "exact", head: true }),
        supabase.from("absences").select("nombre_absents").eq("date", today),
        supabase.from("restaurant_logs").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("permanences").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("permanence_logs").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("chambre_inspections").select("*", { count: "exact", head: true }).eq("date", today),
      ]);
      setStats({
        totalUsers: u.count ?? 0,
        totalDortoirs: d.count ?? 0,
        absencesAujourdhui: (a.data ?? []).reduce((s, r: any) => s + (r.nombre_absents || 0), 0),
        restaurantLogsAujourdhui: p.count ?? 0,
        permanencesAujourdhui: perm.count ?? 0,
        permanencesLogsAujourdhui: pLogs.count ?? 0,
        inspectionsAujourdhui: ins.count ?? 0,
      });

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
        .select("dortoir_id")
        .eq("date", yesterday);
      const absDoneSet = new Set((yAbs ?? []).map((x: any) => x.dortoir_id));
      (dortoirAssigns ?? []).forEach((da: any) => {
        if (nameById[da.surveillant_id] && !absDoneSet.has(da.dortoir_id)) {
          missing.push({
            type: "ABSENCE",
            surveillant_id: da.surveillant_id,
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
      const rawExpectedResto = [
        ...((tplR ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
        ...((ovR ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
      ];
      // Filter out redundant slots and deduplicate
      const expectedResto = Array.from(
        new Map(
          rawExpectedResto
            .filter((e) => !isRedundantRestoSlot(yesterdayWd, e.r))
            .map((e) => [`${e.s}:${e.r}`, e])
        ).values()
      );
      const { data: yLogs } = await supabase
        .from("restaurant_logs")
        .select("surveillant_id, repas")
        .eq("date", yesterday);
      const restoDoneSet = new Set((yLogs ?? []).map((x: any) => `${x.surveillant_id}:${x.repas}`));
      expectedResto.forEach((e) => {
        if (nameById[e.s] && !restoDoneSet.has(`${e.s}:${e.r}`)) {
          missing.push({
            type: "RESTAURANT",
            surveillant_id: e.s,
            surveillantName: nameById[e.s],
            detail: `Effectif ${REPAS_LABELS[e.r as RepasType] ?? e.r}`,
          });
        }
      });

      // 3. Inspections: each dortoir must have at least 1 inspection yesterday
      const { data: yIns } = await supabase
        .from("chambre_inspections")
        .select("chambres!inner(dortoir_id)")
        .eq("date", yesterday);
      const inspDoneSet = new Set((yIns ?? []).map((x: any) => x.chambres?.dortoir_id).filter(Boolean));
      (dortoirAssigns ?? []).forEach((da: any) => {
        if (nameById[da.surveillant_id] && !inspDoneSet.has(da.dortoir_id)) {
          missing.push({
            type: "INSPECTION",
            surveillant_id: da.surveillant_id,
            surveillantName: nameById[da.surveillant_id],
            detail: `Inspection Dortoir ${da.dortoirs?.code ?? "?"}`,
          });
        }
      });
      setMissingYesterday(missing);

      // ---- Compute TODAY pending vs done at a glance
      const done: MissingTask[] = [];
      const pending: MissingTask[] = [];
      const info: MissingTask[] = [];

      // Today absences
      const { data: tAbs } = await supabase
        .from("absences")
        .select("dortoir_id")
        .eq("date", today);
      const tAbsSet = new Set((tAbs ?? []).map((x: any) => x.dortoir_id));
      (dortoirAssigns ?? []).forEach((da: any) => {
        const name = nameById[da.surveillant_id];
        if (!name) return;
        const item: MissingTask = {
          type: "ABSENCE",
          surveillant_id: da.surveillant_id,
          surveillantName: name,
          detail: `Absences D. ${da.dortoirs?.code ?? "?"}`,
        };
        if (tAbsSet.has(da.dortoir_id)) done.push(item);
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
      const rawExpectedToday = [
        ...((tplR2 ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
        ...((ovR2 ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
      ];
      // Filter out redundant slots and deduplicate
      const expectedToday = Array.from(
        new Map(
          rawExpectedToday
            .filter((e) => !isRedundantRestoSlot(todayWd, e.r))
            .map((e) => [`${e.s}:${e.r}`, e])
        ).values()
      );
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
          surveillant_id: e.s,
          surveillantName: name,
          detail: REPAS_LABELS[e.r as RepasType] ?? e.r,
        };
        if (tLogsSet.has(`${e.s}:${e.r}`)) done.push(item);
        else pending.push(item);
      });

      // Today permanences
      const { data: tplP } = await supabase
        .from("permanence_template")
        .select("surveillant_id, slot")
        .eq("weekday", todayWd);
      const { data: ovP } = await supabase
        .from("permanences")
        .select("surveillant_id, slot")
        .eq("date", today);
      
      const rawExpectedPerms = [
        ...((tplP ?? []) as any[]).map((x) => ({ s: x.surveillant_id, slot: x.slot })),
        ...((ovP ?? []) as any[]).map((x) => ({ s: x.surveillant_id, slot: x.slot })),
      ];

      // Filter out redundant slots and deduplicate
      const uniquePerms = Array.from(
        new Map(
          rawExpectedPerms
            .filter((e) => !isRedundantSlot(todayWd, e.slot))
            .map((p) => [`${p.s}:${p.slot}`, p])
        ).values()
      );

      uniquePerms.forEach((e) => {
        const name = nameById[e.s];
        if (!name) return;
        info.push({
          type: "PERMANENCE",
          surveillant_id: e.s,
          surveillantName: name,
          detail: `Permanence ${SLOT_LABELS[e.slot as PermanenceSlot]?.split(" (")[0] ?? e.slot}`,
        });
      });

      setTodayActivity({ done, pending, info });
    })();
  }, []);

  if (!stats) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleContactSurveillant = (surveillantId: string, surveillantName: string) => {
    const tasks = missingYesterday.filter(m => m.surveillant_id === surveillantId);
    const date = format(subDays(getBusinessDate(), 1), "d MMMM yyyy", { locale: fr });
    const lines = tasks.map(t => `• ${t.detail}`).join('\n');
    const draft = `Bonjour ${surveillantName},\n\nNous avons constaté que les tâches suivantes ne sont pas été effectuées hier (${date}) :\n${lines}\n\nMerci de m'en parler.\n\nCordialement`;
    navigate('/messagerie', { state: { openWithUserId: surveillantId, draftMessage: draft } });
  };

  const cards = [
    { label: "Utilisateurs", icon: Users, color: "text-primary", bg: "bg-primary-soft", link: "/utilisateurs", desc: "Gestion des accès" },
    { label: "Dortoirs", icon: BedDouble, color: "text-info", bg: "bg-accent", link: "/dortoirs", desc: "Configuration" },
    { label: "Absences", icon: ClipboardCheck, color: "text-warning", bg: "bg-warning-soft", link: "/admin/absences", desc: "Suivi quotidien" },
    { label: "Restaurant", icon: TrendingUp, color: "text-success", bg: "bg-success-soft", link: "/admin/restaurant", desc: "Effectifs repas" },
    { label: "Inspections", icon: DoorOpen, color: "text-info", bg: "bg-accent", link: "/admin/inspections", desc: "État des chambres" },
    { label: "Réclamations", icon: Wrench, color: "text-destructive", bg: "bg-destructive/10", link: "/reclamations", desc: "Suivi des tickets" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="mb-2">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Bonjour <span className="bg-clip-text text-transparent bg-gradient-primary drop-shadow-sm">{profile?.full_name?.split(" ")[0] || ""}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {format(getBusinessDate(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* Collapsible: missing tasks of yesterday */}
      {missingYesterday.length > 0 && (
        <Card
          className="border-border/60 bg-muted/30 shadow-sm cursor-pointer select-none"
          onClick={() => setMissingOpen((o) => !o)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between text-muted-foreground font-medium">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground/70" />
                Tâches manquantes — hier ({format(subDays(getBusinessDate(), 1), "d MMM", { locale: fr })})
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-muted text-muted-foreground border border-border px-2.5 py-0.5 text-xs font-medium">
                  {missingYesterday.length}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${missingOpen ? "rotate-180" : ""}`}
                />
              </span>
            </CardTitle>
          </CardHeader>
          {missingOpen && (
            <CardContent onClick={(e) => e.stopPropagation()}>
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {missingYesterday.map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-background/60 border border-border/30 transition-all hover:bg-background hover:shadow-sm">
                    <button
                      onClick={() => handleContactSurveillant(m.surveillant_id, m.surveillantName)}
                      className="flex items-center gap-2 font-medium hover:text-primary transition-colors text-left group"
                      title="Cliquer pour envoyer un message"
                    >
                      <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground border-border">{m.type}</Badge>
                      <span className="group-hover:underline underline-offset-2">{m.surveillantName}</span>
                    </button>
                    <span className="text-xs text-muted-foreground">{m.detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}


      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.link} className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className={`h-12 w-12 rounded-full ${c.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{c.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
              </div>
            </div>
          </Link>
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
            {todayActivity.info.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <CalIcon className="h-3 w-3" /> Information
                </div>
                <ul className="space-y-1">
                  {todayActivity.info.map((p, i) => (
                    <li key={i} className="text-sm flex justify-between p-1.5 rounded bg-primary-soft">
                      <span>{p.surveillantName}</span>
                      <span className="text-xs text-muted-foreground">{p.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {todayActivity.done.length === 0 && todayActivity.pending.length === 0 && todayActivity.info.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucune tâche prévue aujourd'hui.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
