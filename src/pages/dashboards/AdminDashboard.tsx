import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Users, BedDouble, ClipboardCheck, Wrench, Utensils, UserX,
  Calendar as CalIcon, AlertTriangle, CheckCircle2, ChevronDown, Clock, GraduationCap,
  MessageSquare,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { dateToWeekday, SLOT_LABELS, REPAS_LABELS, PermanenceSlot, RepasType } from "@/lib/types";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getBusinessDate } from "@/lib/time";
import { WeekendEffectifCard } from "@/components/WeekendEffectifCard";

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
  const businessDate = getBusinessDate();
  const today = format(businessDate, "yyyy-MM-dd");
  const yesterday = format(subDays(businessDate, 1), "yyyy-MM-dd");
  const todayWd = dateToWeekday(businessDate);
  const yesterdayWd = dateToWeekday(subDays(businessDate, 1));

  const [stats, setStats] = useState<Stats | null>(() => {
    try {
      const cached = localStorage.getItem(`admin_stats_${today}`);
      return cached ? JSON.parse(cached) : {
        totalUsers: 0,
        totalDortoirs: 0,
        absencesAujourdhui: 0,
        restaurantLogsAujourdhui: 0,
        permanencesAujourdhui: 0,
        permanencesLogsAujourdhui: 0,
        inspectionsAujourdhui: 0,
      };
    } catch {
      return {
        totalUsers: 0,
        totalDortoirs: 0,
        absencesAujourdhui: 0,
        restaurantLogsAujourdhui: 0,
        permanencesAujourdhui: 0,
        permanencesLogsAujourdhui: 0,
        inspectionsAujourdhui: 0,
      };
    }
  });

  const [missingYesterday, setMissingYesterday] = useState<MissingTask[]>(() => {
    try {
      const cached = localStorage.getItem(`admin_missing_tasks_${yesterday}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [missingOpen, setMissingOpen] = useState(false);
  const [todayActivity, setTodayActivity] = useState<{ done: MissingTask[]; pending: MissingTask[]; info: MissingTask[] }>(() => {
    try {
      const cached = localStorage.getItem(`admin_today_activity_${today}`);
      return cached ? JSON.parse(cached) : { done: [], pending: [], info: [] };
    } catch {
      return { done: [], pending: [], info: [] };
    }
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const timeOffsetRef = useRef(0); // ms offset: serverUTC - deviceUTC
  const timezoneRef = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone); // corrected tz

  useEffect(() => {
    const syncTime = async () => {
      try {
        const deviceBefore = Date.now();
        const res = await fetch("https://worldtimeapi.org/api/ip", { cache: "no-store" });
        const deviceAfter = Date.now();
        if (!res.ok) throw new Error("time API error");
        const data = await res.json();
        const serverMs = data.unixtime * 1000;
        const roundTripMid = deviceBefore + (deviceAfter - deviceBefore) / 2;
        timeOffsetRef.current = serverMs - roundTripMid;
        if (data.timezone) timezoneRef.current = data.timezone;
        setCurrentTime(new Date(Date.now() + timeOffsetRef.current));
      } catch {
        // Fallback: device time only
      }
    };
    syncTime();
    const timer = setInterval(
      () => setCurrentTime(new Date(Date.now() + timeOffsetRef.current)),
      1000
    );
    return () => clearInterval(timer);
  }, []);

  // Format time using the server-confirmed timezone, not the device's potentially wrong one
  const displayTime = new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezoneRef.current,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(currentTime);

  useEffect(() => {
    // Clean old localStorage entries older than 2 days
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("admin_missing_tasks_") || k.startsWith("admin_today_activity_") || k.startsWith("admin_stats_"))) {
          if (!k.includes(today) && !k.includes(yesterday)) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {}

    (async () => {
      try {
        // Fetch ALL dashboard data in parallel in a single roundtrip
        const [
          u, d, a, p, perm, pLogs, ins,
          allProfsRes,
          dortoirAssignsRes,
          yAbsRes,
          tplRRes,
          ovRRes,
          yLogsRes,
          yInsRes,
          tAbsRes,
          tplR2Res,
          ovR2Res,
          tLogsRes,
          tplPRes,
          ovPRes,
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("dortoirs").select("*", { count: "exact", head: true }),
          supabase.from("absences").select("nombre_absents").eq("date", today),
          supabase.from("restaurant_logs").select("*", { count: "exact", head: true }).eq("date", today),
          supabase.from("permanences").select("*", { count: "exact", head: true }).eq("date", today),
          supabase.from("permanence_logs").select("*", { count: "exact", head: true }).eq("date", today),
          supabase.from("chambre_inspections").select("*", { count: "exact", head: true }).eq("date", today),
          // Profiles & Dortoirs
          supabase.from("profiles").select("user_id, full_name, is_active").eq("is_active", true),
          supabase.from("dortoir_assignments").select("dortoir_id, surveillant_id, dortoirs(code)"),
          // Yesterday tasks
          supabase.from("absences").select("dortoir_id").eq("date", yesterday),
          supabase.from("restaurant_template").select("surveillant_id, repas").eq("weekday", yesterdayWd),
          supabase.from("restaurant_assignments").select("surveillant_id, repas").eq("date", yesterday),
          supabase.from("restaurant_logs").select("surveillant_id, repas").eq("date", yesterday),
          supabase.from("chambre_inspections").select("chambres!inner(dortoir_id)").eq("date", yesterday),
          // Today tasks
          supabase.from("absences").select("dortoir_id").eq("date", today),
          supabase.from("restaurant_template").select("surveillant_id, repas").eq("weekday", todayWd),
          supabase.from("restaurant_assignments").select("surveillant_id, repas").eq("date", today),
          supabase.from("restaurant_logs").select("surveillant_id, repas").eq("date", today),
          supabase.from("permanence_template").select("surveillant_id, slot").eq("weekday", todayWd),
          supabase.from("permanences").select("surveillant_id, slot").eq("date", today),
        ]);

        const newStats = {
          totalUsers: u.count ?? 0,
          totalDortoirs: d.count ?? 0,
          absencesAujourdhui: (a.data ?? []).reduce((s, r: any) => s + (r.nombre_absents || 0), 0),
          restaurantLogsAujourdhui: p.count ?? 0,
          permanencesAujourdhui: perm.count ?? 0,
          permanencesLogsAujourdhui: pLogs.count ?? 0,
          inspectionsAujourdhui: ins.count ?? 0,
        };
        setStats(newStats);
        try { localStorage.setItem(`admin_stats_${today}`, JSON.stringify(newStats)); } catch {}

        const allProfs = allProfsRes.data ?? [];
        const nameById: Record<string, string> = Object.fromEntries(
          allProfs.map((p: any) => [p.user_id, p.full_name || "(sans nom)"])
        );
        const dortoirAssigns = dortoirAssignsRes.data ?? [];

        // 1. Absences yesterday
        const missing: MissingTask[] = [];
        const absDoneSet = new Set((yAbsRes.data ?? []).map((x: any) => x.dortoir_id));
        dortoirAssigns.forEach((da: any) => {
          if (nameById[da.surveillant_id] && !absDoneSet.has(da.dortoir_id)) {
            missing.push({
              type: "ABSENCE",
              surveillant_id: da.surveillant_id,
              surveillantName: nameById[da.surveillant_id],
              detail: `Absences Dortoir ${da.dortoirs?.code ?? "?"}`,
            });
          }
        });

        // 2. Restaurant yesterday
        const rawExpectedResto = [
          ...((tplRRes.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
          ...((ovRRes.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
        ];
        const expectedResto = Array.from(
          new Map(
            rawExpectedResto
              .filter((e) => !isRedundantRestoSlot(yesterdayWd, e.r))
              .map((e) => [`${e.s}:${e.r}`, e])
          ).values()
        );
        const restoDoneSet = new Set((yLogsRes.data ?? []).map((x: any) => `${x.surveillant_id}:${x.repas}`));
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

        // 3. Inspections yesterday
        const inspDoneSet = new Set((yInsRes.data ?? []).map((x: any) => x.chambres?.dortoir_id).filter(Boolean));
        dortoirAssigns.forEach((da: any) => {
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
        try { localStorage.setItem(`admin_missing_tasks_${yesterday}`, JSON.stringify(missing)); } catch {}

        // ---- Compute TODAY pending vs done
        const done: MissingTask[] = [];
        const pending: MissingTask[] = [];
        const info: MissingTask[] = [];

        // Today absences
        const tAbsSet = new Set((tAbsRes.data ?? []).map((x: any) => x.dortoir_id));
        dortoirAssigns.forEach((da: any) => {
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
        const rawExpectedToday = [
          ...((tplR2Res.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
          ...((ovR2Res.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, r: x.repas })),
        ];
        const expectedToday = Array.from(
          new Map(
            rawExpectedToday
              .filter((e) => !isRedundantRestoSlot(todayWd, e.r))
              .map((e) => [`${e.s}:${e.r}`, e])
          ).values()
        );
        const tLogsSet = new Set((tLogsRes.data ?? []).map((x: any) => `${x.surveillant_id}:${x.repas}`));
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
        const rawExpectedPerms = [
          ...((tplPRes.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, slot: x.slot })),
          ...((ovPRes.data ?? []) as any[]).map((x) => ({ s: x.surveillant_id, slot: x.slot })),
        ];
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

        const newActivity = { done, pending, info };
        setTodayActivity(newActivity);
        try { localStorage.setItem(`admin_today_activity_${today}`, JSON.stringify(newActivity)); } catch {}
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      }
    })();
  }, []);

  const handleContactSurveillant = (surveillantId: string, surveillantName: string) => {
    const tasks = missingYesterday.filter(m => m.surveillant_id === surveillantId);
    const date = format(subDays(getBusinessDate(), 1), "d MMMM yyyy", { locale: fr });
    const lines = tasks.map(t => `• ${t.detail}`).join('\n');
    const draft = `Bonjour ${surveillantName},\n\nNous avons constaté que les tâches suivantes ne sont pas été effectuées hier (${date}) :\n${lines}\n\nMerci de m'en parler.\n\nCordialement`;
    navigate('/messagerie', { state: { openWithUserId: surveillantId, draftMessage: draft } });
  };

  const cards = [
    { label: "Absences", icon: UserX, color: "text-warning", bg: "bg-warning-soft", link: "/admin/absences", desc: "Suivi quotidien" },
    { label: "Restaurant", icon: Utensils, color: "text-success", bg: "bg-success-soft", link: "/admin/restaurant", desc: "Effectifs repas" },
    { label: "Inspections", icon: ClipboardCheck, color: "text-info", bg: "bg-accent", link: "/admin/inspections", desc: "État des chambres" },
    { label: "Permanences", icon: Clock, color: "text-primary", bg: "bg-primary-soft", link: "/admin/permanences", desc: "Supervision des tours" },
    { label: "Étudiants", icon: GraduationCap, color: "text-primary", bg: "bg-primary-soft", link: "/etudiants", desc: "Liste des résidents" },
    { label: "Réclamations", icon: Wrench, color: "text-destructive", bg: "bg-destructive/10", link: "/reclamations", desc: "Suivi des tickets" },
    { label: "Messagerie", icon: MessageSquare, color: "text-primary", bg: "bg-primary-soft", link: "/messagerie", desc: "Échanges & alertes" },
    { label: "Utilisateurs", icon: Users, color: "text-primary", bg: "bg-primary-soft", link: "/utilisateurs", desc: "Gestion des accès" },
    { label: "Dortoirs", icon: BedDouble, color: "text-info", bg: "bg-accent", link: "/dortoirs", desc: "Configuration" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="mb-2">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Bonjour Mr <span className="bg-clip-text text-transparent bg-gradient-primary drop-shadow-sm">{profile?.full_name?.split(" ")[0] || ""}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-2 text-lg flex items-center gap-2">
          {format(getBusinessDate(), "EEEE d MMMM yyyy", { locale: fr })}
          <span className="text-border mx-1">|</span>
          <span className="font-mono tabular-nums text-foreground">{displayTime}</span>
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


      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.link} className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className={`h-12 w-12 rounded-full ${c.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{c.label}</div>
                {/* Les tuiles qui portent un chiffre l'affichent en grand ;
                    les autres gardent leur apparence d'origine. */}
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

        {/* Troisième colonne de la grille : effectif weekend, visible toute
            la semaine jusqu'au jeudi suivant. */}
        <WeekendEffectifCard />
      </div>
    </div>
  );
}
