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
import { Loader2, Plus, Save, Eye, FileDown, CalendarDays, AlertTriangle, History, Users, Search } from "lucide-react";
import { format, subDays, isThursday, isFriday, isSaturday, isSunday, isMonday } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { DoneBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateTablePdf } from "@/lib/pdf";
import { WeeklyAbsenceHistory } from "@/components/WeeklyAbsenceHistory";
import { getBusinessDate, parseLocalDate } from "@/lib/time";

interface DortoirAssign {
  id: string;
  dortoir_id: string;
  dortoirs: { id: string; code: string };
}

export default function Absences() {
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
  const view = searchParams.get("view") || "daily";

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
    if (view === "consecutive") {
      loadConsecutiveAbsences();
    }
  }, [view, user, date, isAdmin, absences, myDortoirs]);

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
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Absences</h1>
          <p className="text-muted-foreground mt-1">Effectif quotidien par dortoir</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && <WeeklyAbsenceHistory />}
          {(isThursday(parseLocalDate(date)) || isFriday(parseLocalDate(date)) || isSaturday(parseLocalDate(date)) || isSunday(parseLocalDate(date)) || isMonday(parseLocalDate(date))) && (
            <Button variant="outline" size="sm" onClick={exportWeekendPdf} className="border-primary text-primary">
              <FileDown className="h-4 w-4 mr-1" /> Effectif weekend (PDF)
            </Button>
          )}
          <Label htmlFor="date" className="text-sm">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-auto" />
        </div>
      </div>

      {/* Top Toggle Controls */}
      <div className="flex border-b border-border/80 gap-6">
        <button
          onClick={() => setSearchParams({ date, view: "daily" })}
          className={`pb-2.5 text-sm font-semibold transition-colors relative ${
            view !== "consecutive"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Effectif Quotidien
          </div>
        </button>
        <button
          onClick={() => setSearchParams({ date, view: "consecutive" })}
          className={`pb-2.5 text-sm font-semibold transition-colors relative ${
            view === "consecutive"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            Absences Consécutives (3+ nuits)
          </div>
        </button>
      </div>

      {view !== "consecutive" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })}</CardTitle>
              <CardDescription>{isAdmin ? "Tous les dortoirs" : "Vos dortoirs affectés"}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : dortoirsToShow.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun dortoir disponible.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dortoirsToShow.map((d) => {
                    const a = absences.find((x) => x.dortoir_id === d.id);
                    return (
                      <li key={d.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">Dortoir {d.code}</div>
                          <DoneBadge done={!!a} />
                        </div>
                        {a && (
                          <div className="text-sm text-muted-foreground mt-2">
                            {a.nombre_absents} absent{a.nombre_absents > 1 ? "s" : ""}
                          </div>
                        )}
                        <Button size="sm" variant={a ? "outline" : "default"} className="mt-3 w-full" onClick={() => openNew(d.id)}>
                          {a ? <><Eye className="h-3.5 w-3.5 mr-1" /> Voir / modifier</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Tournée & Inspection</>}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* SECTION EFFECTIF WEEKEND */}
          {isThursday(parseLocalDate(date)) && !isAdmin && (
            <div className="ring-4 ring-orange-400 ring-offset-2 rounded-xl animate-pulse-ring">
              <Card className="border-2 border-orange-400 rounded-xl overflow-hidden shadow-lg shadow-orange-200/60 dark:shadow-orange-900/40">
                {/* Attention banner */}
                <div className="bg-orange-500 text-white px-5 py-3 flex items-center gap-3">
                  <CalendarDays className="h-6 w-6 shrink-0" />
                  <div>
                    <p className="font-extrabold text-base uppercase tracking-wide">
                      ⚠️ ACTION REQUISE — Effectif Weekend
                    </p>
                    <p className="text-orange-100 text-xs font-medium mt-0.5">
                      C'est jeudi — renseignez obligatoirement l'effectif présent ce week-end pour chaque dortoir.
                    </p>
                  </div>
                </div>
                <CardContent className="pt-5">
                  {allDortoirs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun dortoir disponible.</p>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {allDortoirs.map((d) => {
                        const we = weekendEffectifs.find((x) => x.dortoir_id === d.id);
                        const isAssignedToMe = myDortoirs.some((myD) => myD.dortoir_id === d.id);
                        const canEdit = isAdmin || isAssignedToMe;

                        return (
                          <li
                            key={d.id}
                            className={`p-4 rounded-lg border-2 bg-card transition-colors ${
                              we
                                ? "border-green-400 bg-green-50/40 dark:bg-green-950/20"
                                : "border-orange-300 bg-orange-50/40 dark:bg-orange-950/20"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-base">Dortoir {d.code}</div>
                              <DoneBadge done={!!we} />
                            </div>
                            <div className="text-sm mt-2 min-h-[40px]">
                              {we ? (
                                <div>
                                  <span className="font-bold text-green-700 dark:text-green-400 text-lg">{we.nombre_presents} présent(s)</span>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Saisi par : {we.profiles?.full_name || "—"}
                                  </div>
                                </div>
                              ) : (
                                <span className="italic text-orange-600 dark:text-orange-400 font-medium">⚠️ Non renseigné</span>
                              )}
                            </div>
                            {canEdit ? (
                              <Button
                                size="sm"
                                variant={we ? "outline" : "default"}
                                className={`mt-3 w-full font-bold ${!we ? "bg-orange-500 hover:bg-orange-600 text-white border-0" : ""}`}
                                onClick={() => openWeekend(d.id)}
                              >
                                {we ? <><Eye className="h-3.5 w-3.5 mr-1" /> Modifier</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Renseigner</>}
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" disabled className="mt-3 w-full bg-muted/40 cursor-not-allowed">
                                Lecture seule
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {consecutiveLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : consecutiveAbsencesList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
                <h3 className="font-semibold text-lg">Aucune alerte active</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                  Aucun étudiant n'a été absent plus de 3 nuits consécutives dans vos dortoirs d'affectation.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un étudiant par nom ou numéro de chambre..."
                  value={consecutiveSearch}
                  onChange={(e) => setConsecutiveSearch(e.target.value)}
                />
              </div>

              {filteredConsecutiveAbsences.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground italic">
                    Aucun résultat ne correspond à votre recherche.
                  </CardContent>
                </Card>
              ) : isAdmin ? (
                // Group by Dortoir for Admin
                (() => {
                  const grouped: Record<string, any[]> = {};
                  filteredConsecutiveAbsences.forEach(item => {
                    const code = item.dortoirCode || "Inconnu";
                    if (!grouped[code]) grouped[code] = [];
                    grouped[code].push(item);
                  });

                  return Object.entries(grouped)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([code, list]) => (
                      <Card key={code} className="border-l-4 border-l-amber-500 shadow-sm">
                        <CardHeader className="pb-3 border-b">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-primary" />
                            Dortoir {code}
                          </CardTitle>
                          <CardDescription>{list.length} alerte(s) active(s)</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-4">
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader className="bg-muted/50">
                                <TableRow>
                                  <TableHead>Étudiant</TableHead>
                                  <TableHead>Téléphone</TableHead>
                                  <TableHead>Chambre</TableHead>
                                  <TableHead>Nombre de Nuits</TableHead>
                                  <TableHead>Période d'Absence</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {list.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-accent/40">
                                    <TableCell className="font-semibold py-3">{item.nom_complet}</TableCell>
                                    <TableCell className="py-3">{item.telephone || <span className="text-muted-foreground italic">-</span>}</TableCell>
                                    <TableCell className="py-3">Chambre {item.chambreNumero}</TableCell>
                                    <TableCell className="py-3">
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200/50">
                                        <AlertTriangle className="h-3 w-3 animate-bounce" /> {item.count} nuits consécutives
                                      </span>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs py-3 text-muted-foreground">
                                      Du {format(new Date(item.start), "dd-MM-yyyy")} au {format(new Date(item.end), "dd-MM-yyyy")}
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
                // Single flat table for Surveillant (their own assigned dorms)
                <Card className="border-l-4 border-l-amber-500 shadow-sm">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Alertes Absences Consécutives
                    </CardTitle>
                    <CardDescription>Étudiants absents depuis 3 nuits consécutives ou plus.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-4">
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Étudiant</TableHead>
                            <TableHead>Téléphone</TableHead>
                            <TableHead>Dortoir</TableHead>
                            <TableHead>Chambre</TableHead>
                            <TableHead>Nombre de Nuits</TableHead>
                            <TableHead>Période d'Absence</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredConsecutiveAbsences.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-accent/40">
                              <TableCell className="font-semibold py-3">{item.nom_complet}</TableCell>
                              <TableCell className="py-3">{item.telephone || <span className="text-muted-foreground italic">-</span>}</TableCell>
                              <TableCell className="py-3">Dortoir {item.dortoirCode}</TableCell>
                              <TableCell className="py-3">Chambre {item.chambreNumero}</TableCell>
                              <TableCell className="py-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200/50">
                                  <AlertTriangle className="h-3 w-3" /> {item.count} nuits consécutives
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-xs py-3 text-muted-foreground">
                                Du {format(new Date(item.start), "dd-MM-yyyy")} au {format(new Date(item.end), "dd-MM-yyyy")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

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
