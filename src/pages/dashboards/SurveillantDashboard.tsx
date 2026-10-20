import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Loader2, ClipboardList, Utensils, Calendar as CalIcon, BedDouble, Clock, Briefcase, MessageSquare,
  UserX, ClipboardCheck, Calendar, GraduationCap, Wrench, CalendarOff,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SLOT_LABELS, REPAS_LABELS, dateToWeekday, PermanenceSlot } from "@/lib/types";
import { useAbsenceRequests } from "@/hooks/useAbsenceRequests";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { DoneBadge } from "@/components/StatusBadge";
import { getBusinessDate } from "@/lib/time";

const SLOT_TIMES: Record<PermanenceSlot, { start: string, end: string }> = {
  MATIN: { start: "08:00", end: "13:00" },
  APRES_MIDI: { start: "14:00", end: "19:00" },
  NUIT: { start: "20:00", end: "23:00" },
};

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

export default function SurveillantDashboard() {
  const { user, profile } = useAuth();
  const { pendingTaskCount } = useAbsenceRequests();
  const { unreadMap } = useUnreadCounts(user?.id ?? null);
  const totalUnreadMessages = Object.values(unreadMap).reduce((acc, count) => acc + count, 0);
  const [loading, setLoading] = useState(true);
  const [myDortoirs, setMyDortoirs] = useState<any[]>([]);
  const [todayPerms, setTodayPerms] = useState<any[]>([]);
  const [todayResto, setTodayResto] = useState<any[]>([]);
  const [todayInspections, setTodayInspections] = useState<any[]>([]);
  const [absenceDoneToday, setAbsenceDoneToday] = useState<Record<string, boolean>>({});
  const [restoLogs, setRestoLogs] = useState<Record<string, boolean>>({});
  const [logsAssigned, setLogsAssigned] = useState<any[]>([]);
  const [isWeekendPerm, setIsWeekendPerm] = useState(false);

  useEffect(() => {
    if (!user) return;
    const businessDate = getBusinessDate();
    const today = format(businessDate, "yyyy-MM-dd");
    const wd = dateToWeekday(businessDate);
    (async () => {
      const weekStartStr = format(startOfWeek(businessDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      
      const [da, permTpl, permOv, restoTpl, restoOv, wp, pLogs] = await Promise.all([
        supabase.from("dortoir_assignments").select("*, dortoirs(*)").eq("surveillant_id", user.id),
        supabase.from("permanence_template").select("*").eq("surveillant_id", user.id).eq("weekday", wd),
        supabase.from("permanences").select("*").eq("surveillant_id", user.id).eq("date", today),
        supabase.from("restaurant_template").select("*").eq("surveillant_id", user.id).eq("weekday", wd),
        supabase.from("restaurant_assignments").select("*").eq("surveillant_id", user.id).eq("date", today),
        supabase.from("weekend_permanences").select("id").eq("surveillant_id", user.id).eq("week_start_date", weekStartStr),
        supabase.from("permanence_logs").select("*").eq("surveillant_id", user.id).eq("date", today),
      ]);
      
      setMyDortoirs(da.data ?? []);
      const allPerms = [...(permTpl.data ?? []), ...(permOv.data ?? [])];
      setTodayPerms(allPerms.filter(p => !isRedundantSlot(wd, p.slot)));
      setLogsAssigned(pLogs.data ?? []);
      
      const allResto = [...(restoTpl.data ?? []), ...(restoOv.data ?? [])];
      const validResto = allResto.filter((r: any) => !isRedundantRestoSlot(wd, r.repas));
      // Deduplicate by repas type so we don't show the same meal twice
      const uniqueResto = Array.from(new Map(validResto.map((r: any) => [r.repas, r])).values());
      setTodayResto(uniqueResto);
      
      setIsWeekendPerm((wp.data ?? []).length > 0);

      const dortoirIds = (da.data ?? []).map((d: any) => d.dortoir_id);
      if (dortoirIds.length) {
        // Check absences: one record per dortoir per day.
        // Any co-surveillant's submission counts for the whole dortoir.
        const { data: abs } = await supabase
          .from("absences")
          .select("dortoir_id")
          .eq("date", today)
          .in("dortoir_id", dortoirIds);
        const map: Record<string, boolean> = {};
        dortoirIds.forEach((id: string) => (map[id] = false));
        (abs ?? []).forEach((a: any) => (map[a.dortoir_id] = true));
        setAbsenceDoneToday(map);

        // Check inspections by chambre_id (scoped to this user's dortoirs),
        // NOT by surveillant_id, so that a co-surveillant's completed inspection
        // also shows as done for the current user.
        const { data: myChambres } = await supabase
          .from("chambres")
          .select("id")
          .in("dortoir_id", dortoirIds);
        const myChambreIds = (myChambres ?? []).map((c: any) => c.id);
        if (myChambreIds.length) {
          const { data: inspData } = await supabase
            .from("chambre_inspections")
            .select("id")
            .eq("date", today)
            .in("chambre_id", myChambreIds);
          setTodayInspections(inspData ?? []);
        } else {
          setTodayInspections([]);
        }
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

  const cards = [
    {
      label: "Absences & Inspections",
      icon: ClipboardCheck,
      color: "text-warning",
      bg: "bg-warning-soft",
      link: "/absences",
      desc: "Appel & état des lieux",
    },
    {
      label: "Restaurant",
      icon: Utensils,
      color: "text-success",
      bg: "bg-success-soft",
      link: "/restaurant",
      desc: "Effectifs repas",
    },
    {
      label: "Permanences",
      icon: Clock,
      color: "text-primary",
      bg: "bg-primary-soft",
      link: "/permanences",
      desc: "Pointage des tours",
    },
    {
      label: "Messagerie",
      icon: MessageSquare,
      color: "text-primary",
      bg: "bg-primary-soft",
      link: "/messagerie",
      desc: totalUnreadMessages > 0 ? `${totalUnreadMessages} message(s) non lu(s)` : "Échanges & alertes",
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined,
      isUnread: totalUnreadMessages > 0,
    },
    {
      label: "Réclamations",
      icon: Wrench,
      color: "text-destructive",
      bg: "bg-destructive/10",
      link: "/reclamations",
      desc: "Signalement pannes",
    },
    {
      label: "Étudiants",
      icon: GraduationCap,
      color: "text-primary",
      bg: "bg-primary-soft",
      link: "/etudiants",
      desc: "Liste des résidents",
    },
    {
      label: "Demandes d'absence",
      icon: CalendarOff,
      color: "text-warning",
      bg: "bg-warning-soft",
      link: "/demandes-absence",
      desc: "Congés & délégations",
      badge: pendingTaskCount > 0 ? pendingTaskCount : undefined,
    },
    {
      label: "Dortoirs",
      icon: BedDouble,
      color: "text-info",
      bg: "bg-accent",
      link: "/dortoirs",
      desc: "Chambres & lits",
    },
    {
      label: "Calendrier",
      icon: Calendar,
      color: "text-primary",
      bg: "bg-primary-soft",
      link: "/calendrier",
      desc: "Planning & relèves",
    },
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.link}
            className={`group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md ${
              c.isUnread ? "border-destructive/80 ring-2 ring-destructive/40 shadow-sm" : ""
            }`}
          >
            {c.isUnread && c.badge != null && c.badge > 0 && (
              <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-sm">
                  {c.badge}
                </span>
              </span>
            )}
            {!c.isUnread && c.badge != null && c.badge > 0 && (
              <span className="absolute top-2 right-2 h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                {c.badge}
              </span>
            )}
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div
                className={`h-12 w-12 rounded-full ${c.bg} flex items-center justify-center transition-transform group-hover:scale-110 relative ${
                  c.isUnread ? "animate-bounce ring-2 ring-destructive ring-offset-2" : ""
                }`}
              >
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground flex items-center justify-center gap-1.5">
                  {c.label}
                  {c.isUnread && (
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-ping" />
                  )}
                </div>
                <div className={`text-xs mt-0.5 ${c.isUnread ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  {c.desc}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-primary" /> Mes dortoirs
            </CardTitle>
            <CardDescription>Effectif absences quotidien</CardDescription>
          </CardHeader>
          <CardContent>
            {myDortoirs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dortoir affecté. Contactez l'administrateur.</p>
            ) : (
              <ul className="space-y-2">
                {myDortoirs.map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <div className="font-semibold">Dortoir {d.dortoirs.code}</div>
                      <div className="text-xs text-muted-foreground">Effectif du soir</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DoneBadge done={absenceDoneToday[d.dortoir_id]} />
                      <Button asChild size="sm" variant={absenceDoneToday[d.dortoir_id] ? "outline" : "default"}>
                        <Link to="/absences">{absenceDoneToday[d.dortoir_id] ? "Voir" : "Saisir les absences"}</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Inspections de chambres
            </CardTitle>
            <CardDescription>Vos inspections quotidiennes</CardDescription>
          </CardHeader>
          <CardContent>
            {myDortoirs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dortoir affecté pour l'inspection.</p>
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
                      <Link to="/absences?view=inspections">{todayInspections.length > 0 ? "Voir" : "Inspecter"}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
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
                {todayPerms.map((p: any) => {
                  const isDone = logsAssigned.some(l => 
                    l.start_time.startsWith(SLOT_TIMES[p.slot as keyof typeof SLOT_TIMES]?.start.split(':')[0] || "00")
                  );
                  return (
                    <li key={p.id} className="p-3 rounded-lg border bg-primary-soft">
                      <div className="font-semibold text-primary">{SLOT_LABELS[p.slot as keyof typeof SLOT_LABELS] || p.slot}</div>
                      <div className="flex items-center justify-between mt-2">
                        <DoneBadge done={isDone} />
                        <Button asChild size="sm" variant={isDone ? "outline" : "default"}>
                          <Link to="/permanences">{isDone ? "Voir" : "Confirmer"}</Link>
                        </Button>
                      </div>
                      {p.notes && <div className="text-xs text-muted-foreground mt-1">{p.notes}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary" /> Restaurant aujourd'hui
            </CardTitle>
            <CardDescription>Effectif des élèves au restaurant</CardDescription>
          </CardHeader>
          <CardContent>
            {todayResto.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun effectif restaurant affecté aujourd'hui.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {todayResto.map((r: any) => (
                  <li key={r.id} className="p-3 rounded-lg border bg-muted/30">
                    <div className="font-semibold">{REPAS_LABELS[r.repas as keyof typeof REPAS_LABELS]}</div>
                    <div className="flex items-center justify-between mt-2">
                      <DoneBadge done={restoLogs[r.repas]} />
                      <Button asChild size="sm" variant={restoLogs[r.repas] ? "outline" : "default"}>
                        <Link to="/restaurant">{restoLogs[r.repas] ? "Voir" : "Suivi & validation"}</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Delegated tasks quick-access */}
        {pendingTaskCount > 0 && (
          <Card className="md:col-span-2 relative overflow-hidden backdrop-blur-xl bg-blue-500/5 border-blue-200/60 shadow-sm transition-all hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Briefcase className="h-4 w-4" /> Tâches déléguées
                <span className="ml-auto h-5 w-5 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {pendingTaskCount}
                </span>
              </CardTitle>
              <CardDescription>Des collègues vous ont confié des tâches pendant leur absence</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/demandes-absence">Voir mes tâches assignées</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2 relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Rappels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isWeekendPerm && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 mb-2">
                <span className="text-destructive font-bold">⚠️</span>
                <span className="font-semibold text-destructive">Vous êtes de permanence ce week-end (Samedi 15h30-19h, Dimanche 09h30-12h30 / 15h30-18h30).</span>
              </div>
            )}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-soft border border-warning/30">
              <span className="text-warning">⏰</span>
              <span>Effectif des absences à effectuer chaque soir.</span>
            </div>
            {format(getBusinessDate(), "EEEE", { locale: fr }) === "jeudi" && (
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
