import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Save, Eye, FileDown, CalendarDays, AlertTriangle, History, Users, Search, ClipboardCheck } from "lucide-react";
import { format, subDays, isThursday, isFriday, isSaturday, isSunday, isMonday } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { DoneBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateTablePdf } from "@/lib/pdf";
import { WeeklyAbsenceHistory } from "@/components/WeeklyAbsenceHistory";
import { getBusinessDate, parseLocalDate } from "@/lib/time";
import Inspections from "./Inspections";

interface DortoirAssign {
  id: string;
  dortoir_id: string;
  dortoirs: { id: string; code: string };
}

export default function Absences({ defaultView }: { defaultView?: string } = {}) {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(searchParams.get("date") || format(getBusinessDate(), "yyyy-MM-dd"));

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
  };
  const [myDortoirs, setMyDortoirs] = useState<DortoirAssign[]>([]);
  const [allDortoirs, setAllDortoirs] = useState<{ id: string; code: string }[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ dortoir_id: "", nombre_absents: 0, noms_absents: "", observations: "" });
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // Weekend State
  const [weekendEffectifs, setWeekendEffectifs] = useState<any[]>([]);
  const [weekendOpen, setWeekendOpen] = useState(false);
  const [weekendForm, setWeekendForm] = useState({ dortoir_id: "", nombre_presents: 0 });
  const [editingWeekend, setEditingWeekend] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const isThu = isThursday(parseLocalDate(date));
    const isFri = isFriday(parseLocalDate(date));
    const isSat = isSaturday(parseLocalDate(date));
    const isSun = isSunday(parseLocalDate(date));
    const isMon = isMonday(parseLocalDate(date));
    const thuDate = isThu ? date : (isFri ? format(subDays(parseLocalDate(date), 1), "yyyy-MM-dd") : (isSat ? format(subDays(parseLocalDate(date), 2), "yyyy-MM-dd") : (isSun ? format(subDays(parseLocalDate(date), 3), "yyyy-MM-dd") : (isMon ? format(subDays(parseLocalDate(date), 4), "yyyy-MM-dd") : null))));

    // Load all dortoirs and weekend effectifs for all authenticated users
    const { data: dortData } = await supabase.from("dortoirs").select("id, code").order("code");
    const loadedDortoirs = dortData ?? [];
    setAllDortoirs(loadedDortoirs);

    let enrichedWE: any[] = [];
    if (thuDate) {
      const { data: weData } = await supabase
        .from("weekend_effectifs")
        .select("*, dortoirs(code)")
        .eq("semaine_du", thuDate)
        .order("created_at");
      const weList = weData ?? [];
      const survIds = weList.map((x: any) => x.surveillant_id);
      const nameById: Record<string, string> = {};
      if (survIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", survIds);
        (profs ?? []).forEach((p: any) => {
          nameById[p.user_id] = p.full_name;
        });
      }
      enrichedWE = weList.map((x: any) => ({
        ...x,
        profiles: { full_name: nameById[x.surveillant_id] || "—" }
      }));
    }
    setWeekendEffectifs(enrichedWE);

    if (isAdmin) {
      const [abs, etud] = await Promise.all([
        supabase.from("absences").select("*, dortoirs(code)").eq("date", date).order("created_at"),
        supabase.from("etudiants").select("id, nom_complet, chambre_id, autorisation_absence, chambres!inner(numero, dortoir_id)")
      ]);
      setAbsences(abs.data ?? []);
      setStudentsData(etud.data ?? []);
    } else if (user) {
      const da = await supabase
        .from("dortoir_assignments")
        .select("id, dortoir_id, dortoirs(id, code)")
        .eq("surveillant_id", user.id);
      const myList = (da.data ?? []) as any[];
      setMyDortoirs(myList);
      const ids = myList.map((x) => x.dortoir_id);
      if (ids.length) {
        const [absRes, etudRes] = await Promise.all([
          supabase.from("absences").select("*, dortoirs(code)").eq("date", date).in("dortoir_id", ids),
          supabase.from("etudiants").select("id, nom_complet, chambre_id, autorisation_absence, chambres!inner(numero, dortoir_id)")
        ]);
        setAbsences(absRes.data ?? []);
        const filteredEtud = (etudRes.data ?? []).filter((e: any) => ids.includes(e.chambres?.dortoir_id));
        setStudentsData(filteredEtud);
      } else {
        setAbsences([]);
        setStudentsData([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date, isAdmin]);

  const openNew = (dortoir_id: string) => {
    const existing = absences.find((a) => a.dortoir_id === dortoir_id);
    if (existing) {
      setEditing(existing);
      setForm({
        dortoir_id,
        nombre_absents: existing.nombre_absents,
        noms_absents: existing.noms_absents ?? "",
        observations: existing.observations ?? "",
      });
      // Try to pre-select students based on names
      const existingNames = (existing.noms_absents ?? "").split("\n").map((n: string) => n.trim()).filter(Boolean);
      const matchedIds = new Set<string>();
      existingNames.forEach((n: string) => {
        const found = studentsData.find(s => s.nom_complet === n && s.chambres?.dortoir_id === dortoir_id);
        if (found) matchedIds.add(found.id);
      });
      setSelectedStudents(matchedIds);
    } else {
      setEditing(null);
      setForm({ dortoir_id, nombre_absents: 0, noms_absents: "", observations: "" });
      setSelectedStudents(new Set());
    }
    setOpen(true);
  };

  const handleStudentToggle = (student: any) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(student.id)) {
      newSelected.delete(student.id);
    } else {
      newSelected.add(student.id);
    }
    setSelectedStudents(newSelected);
    
    // Auto-update the text area and number
    const names: string[] = [];
    newSelected.forEach(id => {
      const s = studentsData.find(x => x.id === id);
      if (s) names.push(s.nom_complet);
    });
    setForm(prev => ({
      ...prev,
      noms_absents: names.join("\n"),
      nombre_absents: newSelected.size
    }));
  };

  const getPreviousBusinessDay = (d: Date): Date => {
    let prev = subDays(d, 1);
    while (isSaturday(prev) || isSunday(prev)) {
      prev = subDays(prev, 1);
    }
    return prev;
  };

  const checkThreeConsecutiveAbsences = async (dortoir_id: string, currentNames: string[], currentDateStr: string) => {
    if (!currentNames.length) return;
    
    // Get last two business days
    const current = new Date(currentDateStr);
    const prev1Date = getPreviousBusinessDay(current);
    const prev2Date = getPreviousBusinessDay(prev1Date);
    
    const prev1 = format(prev1Date, "yyyy-MM-dd");
    const prev2 = format(prev2Date, "yyyy-MM-dd");

    const { data: pastAbs } = await supabase
      .from("absences")
      .select("date, noms_absents")
      .eq("dortoir_id", dortoir_id)
      .in("date", [prev1, prev2]);
      
    if (!pastAbs || pastAbs.length < 2) return;

    const names1 = (pastAbs.find(a => a.date === prev1)?.noms_absents || "").split("\n").map(n => n.trim()).filter(Boolean);
    const names2 = (pastAbs.find(a => a.date === prev2)?.noms_absents || "").split("\n").map(n => n.trim()).filter(Boolean);

    // Fetch students with autorisation_absence = true to bypass warnings
    const { data: authorizedStudents } = await supabase
      .from("etudiants")
      .select("nom_complet")
      .eq("autorisation_absence", true);

    const authorizedNames = (authorizedStudents || []).map(s => s.nom_complet.trim().toLowerCase());

    const consecutiveAbsentees = currentNames.filter(name => 
      names1.includes(name) && 
      names2.includes(name) &&
      !authorizedNames.includes(name.trim().toLowerCase())
    );

    if (consecutiveAbsentees.length > 0) {
      const dortoirCode = dortoirsToShow.find(d => d.id === dortoir_id)?.code || "";
      
      // Anti-Spam: Check if there is already an unread notification for consecutive absences in this dortoir
      const { data: existingUnread } = await supabase
        .from("notifications")
        .select("id")
        .eq("title", "Alerte Absences Consécutives")
        .eq("is_read", false)
        .like("message", `%dortoir ${dortoirCode}%`);

      if (!existingUnread || existingUnread.length === 0) {
        // Send notification to Admin
        await supabase.from("notifications").insert({
          role: "ADMIN",
          title: "Alerte Absences Consécutives",
          message: `${consecutiveAbsentees.join(", ")} a/ont été absent(s) 3 nuits consécutives dans le dortoir ${dortoirCode}.`,
          link: "/absences?view=consecutive"
        });
        
        // Notification to current user (surveillant)
        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "Alerte Absences Consécutives",
          message: `${consecutiveAbsentees.join(", ")} a/ont été absent(s) 3 nuits consécutives.`,
          link: "/absences?view=consecutive"
        });

        toast.warning(`${consecutiveAbsentees.length} étudiant(s) absent(s) 3 nuits consécutives!`);
      }
    }
  };

  // Consecutive Absences View State
  const [consecutiveAbsencesList, setConsecutiveAbsencesList] = useState<any[]>([]);
  const [consecutiveLoading, setConsecutiveLoading] = useState(false);
  const [consecutiveSearch, setConsecutiveSearch] = useState("");
  const view = searchParams.get("view") || defaultView || "daily";
  const [consecutiveModalOpen, setConsecutiveModalOpen] = useState(
    searchParams.get("view") === "consecutive" || defaultView === "consecutive"
  );
  const [mobileTab, setMobileTab] = useState<"absences" | "inspections">(
    searchParams.get("view") === "inspections" || defaultView === "inspections"
      ? "inspections"
      : "absences"
  );

  const filteredConsecutiveAbsences = consecutiveAbsencesList.filter((item) => {
    const query = consecutiveSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      (item.nom_complet || "").toLowerCase().includes(query) ||
      (item.chambreNumero || "").toLowerCase().includes(query)
    );
  });

  const findStreaks = (dates: string[]) => {
    if (dates.length === 0) return [];
    
    // Exclude Saturday (6) and Sunday (0) — weekends don't count as absence days
    const weekdayDates = dates.filter(d => {
      const day = new Date(d).getDay();
      return day !== 0 && day !== 6;
    });

    if (weekdayDates.length === 0) return [];

    // Sort dates descending
    const sorted = [...new Set(weekdayDates)].sort((a, b) => b.localeCompare(a));
    
    const streaks: { count: number; start: string; end: string }[] = [];
    let currentStreak: string[] = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const currentDateStr = sorted[i];
      if (currentStreak.length === 0) {
        currentStreak.push(currentDateStr);
      } else {
        const lastDate = new Date(currentStreak[currentStreak.length - 1]);
        const expectedPrevDate = format(getPreviousBusinessDay(lastDate), "yyyy-MM-dd");
        
        if (currentDateStr === expectedPrevDate) {
          currentStreak.push(currentDateStr);
        } else {
          if (currentStreak.length >= 3) {
            streaks.push({
              count: currentStreak.length,
              start: currentStreak[currentStreak.length - 1], // oldest date
              end: currentStreak[0] // newest date
            });
          }
          currentStreak = [currentDateStr];
        }
      }
    }
    
    if (currentStreak.length >= 3) {
      streaks.push({
        count: currentStreak.length,
        start: currentStreak[currentStreak.length - 1],
        end: currentStreak[0]
      });
    }
    
    return streaks;
  };

  const loadConsecutiveAbsences = async () => {
    setConsecutiveLoading(true);
    try {
      // 1. Fetch students & rooms & dormitories
      const { data: students } = await supabase
        .from("etudiants")
        .select(`
          id,
          nom_complet,
          telephone,
          chambre_id,
          autorisation_absence,
          chambres!inner (
            numero,
            dortoir_id,
            dortoirs!inner (
              id,
              code
            )
          )
        `);

      if (!students) return;

      // 2. Fetch all historical absences sorted by date descending
      const { data: pastAbs } = await supabase
        .from("absences")
        .select("dortoir_id, date, noms_absents")
        .order("date", { ascending: false });

      if (!pastAbs) return;

      // Find the latest checklist date for each dortoir to determine active streaks
      const latestChecklistDateByDortoir: Record<string, string> = {};
      pastAbs.forEach(a => {
        if (!latestChecklistDateByDortoir[a.dortoir_id] || a.date > latestChecklistDateByDortoir[a.dortoir_id]) {
          latestChecklistDateByDortoir[a.dortoir_id] = a.date;
        }
      });

      const results: any[] = [];

      students.forEach((stu: any) => {
        // Skip students who have active absence authorization
        if (stu.autorisation_absence) return;

        const dortoirId = stu.chambres?.dortoirs?.id;
        const dortoirCode = stu.chambres?.dortoirs?.code;
        const chambreNum = stu.chambres?.numero;
        if (!dortoirId) return;

        // Check permission:
        // Surveillant can only see their assigned dortoirs
        const isMyDortoir = myDortoirs.some(d => d.dortoir_id === dortoirId);
        if (!isAdmin && !isMyDortoir) return;

        const latestChecklistDate = latestChecklistDateByDortoir[dortoirId];
        if (!latestChecklistDate) return;

        // Find all dates where this student was absent
        const studentAbsenceDates = pastAbs
          .filter(a => a.dortoir_id === dortoirId)
          .filter(a => {
            const namesList = (a.noms_absents || "")
              .split("\n")
              .map((n: string) => n.trim().toLowerCase());
            return namesList.includes(stu.nom_complet.trim().toLowerCase());
          })
          .map(a => a.date);

        const streaks = findStreaks(studentAbsenceDates);

        streaks.forEach(streak => {
          // A streak is active only if it ends exactly on the latest checklist date for that dortoir
          // If the student was present on a newer checklist date, their streak is broken!
          if (streak.end !== latestChecklistDate) return;

          results.push({
            studentId: stu.id,
            nom_complet: stu.nom_complet,
            telephone: stu.telephone,
            dortoirId,
            dortoirCode,
            chambreNumero: chambreNum,
            count: streak.count,
            start: streak.start,
            end: streak.end
          });
        });
      });

      // Sort by streak end date descending (newest streaks first)
      results.sort((a, b) => b.end.localeCompare(a.end));

      setConsecutiveAbsencesList(results);
    } catch (err: any) {
      toast.error("Erreur de chargement: " + err.message);
    } finally {
      setConsecutiveLoading(false);
    }
  };

  useEffect(() => {
    loadConsecutiveAbsences();
  }, [user, date, isAdmin, absences, myDortoirs]);

  const save = async () => {
    if (!user) return;
    const payload = {
      dortoir_id: form.dortoir_id,
      surveillant_id: editing?.surveillant_id ?? user.id,
      date,
      nombre_absents: Number(form.nombre_absents) || 0,
      noms_absents: form.noms_absents || null,
      observations: form.observations || null,
    };
    
    let error;
    if (editing) {
      ({ error } = await supabase.from("absences").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("absences").insert(payload));
    }
    
    if (error) {
      toast.error(error.message);
      return;
    }

    const namesList = (form.noms_absents || "").split("\n").map(n => n.trim()).filter(Boolean);
    await checkThreeConsecutiveAbsences(form.dortoir_id, namesList, date);

    toast.success(editing ? "Effectif mis à jour" : "Effectif enregistré");
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: editing ? "Modifié effectif absences" : "Créé effectif absences",
      entity: "absences",
      entity_id: editing?.id ?? null,
    });
    setOpen(false);
    load();
  };

  const openWeekend = (dortoir_id: string) => {
    const existing = weekendEffectifs.find(w => w.dortoir_id === dortoir_id);
    if (existing) {
      setEditingWeekend(existing);
      setWeekendForm({ dortoir_id, nombre_presents: existing.nombre_presents });
    } else {
      setEditingWeekend(null);
      setWeekendForm({ dortoir_id, nombre_presents: 0 });
    }
    setWeekendOpen(true);
  };

  const saveWeekend = async () => {
    if (!user) return;
    const isThu = isThursday(parseLocalDate(date));
    const isFri = isFriday(parseLocalDate(date));
    const isSat = isSaturday(parseLocalDate(date));
    const isSun = isSunday(parseLocalDate(date));
    const thuDate = isThu ? date : (isFri ? format(subDays(parseLocalDate(date), 1), "yyyy-MM-dd") : (isSat ? format(subDays(parseLocalDate(date), 2), "yyyy-MM-dd") : (isSun ? format(subDays(parseLocalDate(date), 3), "yyyy-MM-dd") : null)));
    if (!thuDate) return;
    
    const payload = {
      dortoir_id: weekendForm.dortoir_id,
      surveillant_id: editingWeekend?.surveillant_id ?? user.id,
      semaine_du: thuDate,
      nombre_presents: Number(weekendForm.nombre_presents) || 0,
    };
    
    let error;
    if (editingWeekend) {
      ({ error } = await supabase.from("weekend_effectifs").update(payload).eq("id", editingWeekend.id));
    } else {
      ({ error } = await supabase.from("weekend_effectifs").insert(payload));
    }
    
    if (error) { toast.error(error.message); return; }
    toast.success("Effectif weekend enregistré");
    setWeekendOpen(false);
    load();
  };

  const exportWeekendPdf = () => {
    const isThu = isThursday(parseLocalDate(date));
    const isFri = isFriday(parseLocalDate(date));
    const isSat = isSaturday(parseLocalDate(date));
    const isSun = isSunday(parseLocalDate(date));
    const isMon = isMonday(parseLocalDate(date));
    if (!isThu && !isFri && !isSat && !isSun && !isMon) return;
    const thuDate = isThu ? date : (isFri ? format(subDays(parseLocalDate(date), 1), "yyyy-MM-dd") : (isSat ? format(subDays(parseLocalDate(date), 2), "yyyy-MM-dd") : (isSun ? format(subDays(parseLocalDate(date), 3), "yyyy-MM-dd") : format(subDays(parseLocalDate(date), 4), "yyyy-MM-dd"))));
    
    const dortoirsList = allDortoirs;
    const totalCapacite = 0;
    let totalPresents = 0;
    
    const rows = (dortoirsList ?? []).map((d: any) => {
      const rec = weekendEffectifs.find((w) => w.dortoir_id === d.id);
      const presents = rec?.nombre_presents ?? 0;
      totalPresents += presents;
      return [`D. ${d.code}`, presents];
    });

    generateTablePdf({
      title: "Effectif Weekend",
      subtitle: `Exporté le ${format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })} (Saisie du jeudi)`,
      filename: `effectif_weekend_${thuDate}.pdf`,
      head: ["Dortoir", "Présents ce weekend"],
      rows,
      foot: [["TOTAL PRÉSENTS", String(totalPresents)]],
    });
    toast.success("PDF généré");
  };

  const dortoirsToShow = isAdmin
    ? allDortoirs
    : myDortoirs.map((d) => ({ id: d.dortoir_id, code: d.dortoirs.code }));



  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Absences & Inspections</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Pointage des dortoirs et contrôle de l'état des chambres sur une seule page</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConsecutiveModalOpen(true)}
            className="h-8 text-xs font-medium gap-1.5"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <span>3+ nuits consécutives</span>
            {consecutiveAbsencesList.length > 0 && (
              <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-semibold">
                {consecutiveAbsencesList.length}
              </Badge>
            )}
          </Button>

          {isAdmin && <WeeklyAbsenceHistory />}
          {(isThursday(parseLocalDate(date)) || isFriday(parseLocalDate(date)) || isSaturday(parseLocalDate(date)) || isSunday(parseLocalDate(date)) || isMonday(parseLocalDate(date))) && (
            <Button variant="outline" size="sm" onClick={exportWeekendPdf} className="h-8 text-xs font-medium border-primary text-primary">
              <FileDown className="h-3.5 w-3.5 mr-1" /> Weekend (PDF)
            </Button>
          )}

          <div className="flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1 shadow-xs">
            <Label htmlFor="date" className="text-xs font-medium text-muted-foreground">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="h-7 w-auto border-0 p-0 text-sm focus-visible:ring-0 font-medium cursor-pointer bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* SECTION 1 : POINTAGE DES ABSENCES (DORTOIRS) */}
      <Card className="shadow-xs border">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Pointage des Dortoirs</CardTitle>
            <span className="text-xs text-muted-foreground ml-1">
              ({isAdmin ? "Tous les dortoirs" : "Vos affectations"})
            </span>
          </div>
          <Badge variant="outline" className="text-xs font-medium">
            {absences.length} / {dortoirsToShow.length} pointé(s)
          </Badge>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : dortoirsToShow.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-3">Aucun dortoir disponible.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {dortoirsToShow.map((d) => {
                const a = absences.find((x) => x.dortoir_id === d.id);
                return (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg border bg-card flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Dortoir {d.code}</span>
                        <DoneBadge done={!!a} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {a ? (
                          <span className={a.nombre_absents > 0 ? "text-destructive font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>
                            {a.nombre_absents} absent{a.nombre_absents > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span>Non pointé</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={a ? "outline" : "default"}
                      className="h-7 text-xs font-medium shrink-0"
                      onClick={() => openNew(d.id)}
                    >
                      {a ? (
                        <><Eye className="h-3 w-3 mr-1" /> Modifier</>
                      ) : (
                        <><Plus className="h-3 w-3 mr-1" /> Pointer</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION EFFECTIF WEEKEND (JEUDI) */}
      {isThursday(parseLocalDate(date)) && !isAdmin && (
        <Card className="border shadow-xs overflow-hidden">
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <p className="font-semibold text-xs sm:text-sm">
                Effectif Weekend (Jeudi) — Renseignez l'effectif présent ce week-end
              </p>
            </div>
          </div>
          <CardContent className="p-3 sm:p-4">
            {myDortoirs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun dortoir affecté.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {myDortoirs.map((myD) => {
                  const d = { id: myD.dortoir_id, code: myD.dortoirs.code };
                  const we = weekendEffectifs.find((x) => x.dortoir_id === d.id);

                  return (
                    <div
                      key={d.id}
                      className="p-3 rounded-lg border bg-card flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">Dortoir {d.code}</span>
                          <DoneBadge done={!!we} />
                        </div>
                        <div className="text-xs mt-0.5">
                          {we ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {we.nombre_presents} présent(s)
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Non renseigné</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={we ? "outline" : "default"}
                        className="h-7 text-xs font-medium"
                        onClick={() => openWeekend(d.id)}
                      >
                        {we ? "Modifier" : "Renseigner"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 2 : INSPECTIONS DES CHAMBRES (PLEINE LARGEUR) */}
      <Inspections embeddedDate={date} hideHeader={true} />

      {/* DIALOG ABSENCES CONSECUTIVES (3+ NUITS) */}
      <Dialog open={consecutiveModalOpen} onOpenChange={setConsecutiveModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Absences Consécutives (3+ nuits)
            </DialogTitle>
            <DialogDescription>
              Étudiants absents depuis 3 nuits consécutives ou plus (hors week-ends).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 text-sm"
                placeholder="Rechercher un étudiant par nom ou numéro de chambre..."
                value={consecutiveSearch}
                onChange={(e) => setConsecutiveSearch(e.target.value)}
              />
            </div>

            {consecutiveLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredConsecutiveAbsences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg border-dashed">
                <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <h4 className="font-semibold text-sm">Aucune alerte active</h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-0.5">
                  Aucun étudiant n'a été absent plus de 3 nuits consécutives dans vos dortoirs d'affectation.
                </p>
              </div>
            ) : isAdmin ? (
              (() => {
                const grouped: Record<string, any[]> = {};
                filteredConsecutiveAbsences.forEach((item) => {
                  const code = item.dortoirCode || "Inconnu";
                  if (!grouped[code]) grouped[code] = [];
                  grouped[code].push(item);
                });

                return Object.entries(grouped)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, list]) => (
                    <Card key={code} className="border shadow-xs">
                      <CardHeader className="py-2.5 px-4 border-b">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" /> Dortoir {code}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">{list.length} alerte(s)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader className="bg-muted/50 text-xs">
                              <TableRow>
                                <TableHead>Étudiant</TableHead>
                                <TableHead>Téléphone</TableHead>
                                <TableHead>Chambre</TableHead>
                                <TableHead>Nuits</TableHead>
                                <TableHead>Période</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="text-xs">
                              {list.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-semibold py-2.5">{item.nom_complet}</TableCell>
                                  <TableCell className="py-2.5">{item.telephone || "—"}</TableCell>
                                  <TableCell className="py-2.5">Ch. {item.chambreNumero}</TableCell>
                                  <TableCell className="py-2.5">
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                      <AlertTriangle className="h-3 w-3 text-muted-foreground" /> {item.count} nuits
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-[11px] py-2.5 text-muted-foreground">
                                    Du {format(new Date(item.start), "dd/MM")} au {format(new Date(item.end), "dd/MM")}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ));
              })()
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50 text-xs">
                    <TableRow>
                      <TableHead>Étudiant</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Dortoir</TableHead>
                      <TableHead>Chambre</TableHead>
                      <TableHead>Nuits</TableHead>
                      <TableHead>Période</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {filteredConsecutiveAbsences.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold py-2.5">{item.nom_complet}</TableCell>
                        <TableCell className="py-2.5">{item.telephone || "—"}</TableCell>
                        <TableCell className="py-2.5">Dortoir {item.dortoirCode}</TableCell>
                        <TableCell className="py-2.5">Ch. {item.chambreNumero}</TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3 text-muted-foreground" /> {item.count} nuits
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] py-2.5 text-muted-foreground">
                          Du {format(new Date(item.start), "dd/MM")} au {format(new Date(item.end), "dd/MM")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConsecutiveModalOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG ABSENCES */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'effectif" : "Nouvel effectif"}</DialogTitle>
            <DialogDescription>
              Dortoir {dortoirsToShow.find((d) => d.id === form.dortoir_id)?.code} · {format(parseLocalDate(date), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-[40vh] overflow-y-auto border rounded-md p-3 bg-muted/20">
              <Label>Sélectionner les absents</Label>
              {(() => {
                const dortoirStudents = studentsData.filter(s => s.chambres?.dortoir_id === form.dortoir_id);
                if (dortoirStudents.length === 0) return <p className="text-xs text-muted-foreground italic">Aucun étudiant dans ce dortoir</p>;
                
                // Group by chambre
                const byChambre: Record<string, any[]> = {};
                dortoirStudents.forEach(s => {
                  const ch = s.chambres?.numero || "Inconnue";
                  if (!byChambre[ch]) byChambre[ch] = [];
                  byChambre[ch].push(s);
                });

                return Object.entries(byChambre)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([chambreNum, students]) => (
                  <div key={chambreNum} className="mb-4 last:mb-0">
                    <div className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded mb-2">Chambre {chambreNum}</div>
                    <div className="space-y-1.5 px-2">
                      {students.map(s => (
                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 p-1 rounded">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300"
                            checked={selectedStudents.has(s.id)}
                            onChange={() => handleStudentToggle(s)}
                          />
                          <span>{s.nom_complet}</span>
                          {s.autorisation_absence && (
                            <span className="ml-2 text-[10px] uppercase font-bold text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20">
                              Absence justifiée
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nb">Nombre d'absents (Total)</Label>
                <Input
                  id="nb"
                  type="number"
                  min={0}
                  value={form.nombre_absents}
                  onChange={(e) => setForm({ ...form, nombre_absents: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noms">Noms saisis manuellement</Label>
                <Textarea
                  id="noms"
                  rows={2}
                  value={form.noms_absents}
                  onChange={(e) => setForm({ ...form, noms_absents: e.target.value })}
                  placeholder="Un nom par ligne"
                  className="text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observations</Label>
              <Textarea
                id="obs"
                rows={2}
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EFFECTIF WEEKEND */}
      <Dialog open={weekendOpen} onOpenChange={setWeekendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Effectif Weekend</DialogTitle>
            <DialogDescription>
              Dortoir {dortoirsToShow.find((d) => d.id === weekendForm.dortoir_id)?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre TOTAL d'étudiants PRÉSENTS ce weekend</Label>
              <Input
                type="number"
                min={0}
                value={weekendForm.nombre_presents}
                onChange={(e) => setWeekendForm({ ...weekendForm, nombre_presents: Number(e.target.value) })}
                placeholder="Saisissez uniquement un nombre..."
                className="text-lg font-bold"
              />
            </div>
            <p className="text-xs text-muted-foreground italic">
              Aucune liste nominative n'est requise. Seul le nombre total compte.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWeekendOpen(false)}>Annuler</Button>
            <Button onClick={saveWeekend}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
