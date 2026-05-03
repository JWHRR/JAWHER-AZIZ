import { useEffect, useState } from "react";
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
import { Loader2, Plus, Save, Eye, FileDown } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { DoneBadge } from "@/components/StatusBadge";
import { generateTablePdf } from "@/lib/pdf";
import { WeeklyAbsenceHistory } from "@/components/WeeklyAbsenceHistory";

interface DortoirAssign {
  id: string;
  dortoir_id: string;
  dortoirs: { id: string; code: string };
}

export default function Absences() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [myDortoirs, setMyDortoirs] = useState<DortoirAssign[]>([]);
  const [allDortoirs, setAllDortoirs] = useState<{ id: string; code: string }[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ dortoir_id: "", nombre_absents: 0, noms_absents: "", observations: "" });
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    if (isAdmin) {
      const [dort, abs, etud] = await Promise.all([
        supabase.from("dortoirs").select("id, code").order("code"),
        supabase.from("absences").select("*, dortoirs(code)").eq("date", date).order("created_at"),
        supabase.from("etudiants").select("id, nom_complet, chambre_id, chambres!inner(numero, dortoir_id)")
      ]);
      setAllDortoirs(dort.data ?? []);
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
          supabase.from("etudiants").select("id, nom_complet, chambre_id, chambres!inner(numero, dortoir_id)")
        ]);
        setAbsences(absRes.data ?? []);
        // Filter students to only those in the surveillant's dortoirs
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

  const checkThreeConsecutiveAbsences = async (dortoir_id: string, currentNames: string[], currentDateStr: string) => {
    if (!currentNames.length) return;
    
    // Get last two days
    const current = new Date(currentDateStr);
    const prev1 = format(subDays(current, 1), "yyyy-MM-dd");
    const prev2 = format(subDays(current, 2), "yyyy-MM-dd");

    const { data: pastAbs } = await supabase
      .from("absences")
      .select("date, noms_absents")
      .eq("dortoir_id", dortoir_id)
      .in("date", [prev1, prev2]);
      
    if (!pastAbs || pastAbs.length < 2) return;

    const names1 = (pastAbs.find(a => a.date === prev1)?.noms_absents || "").split("\n").map(n => n.trim()).filter(Boolean);
    const names2 = (pastAbs.find(a => a.date === prev2)?.noms_absents || "").split("\n").map(n => n.trim()).filter(Boolean);

    const consecutiveAbsentees = currentNames.filter(name => names1.includes(name) && names2.includes(name));

    if (consecutiveAbsentees.length > 0) {
      // Send notification to Admin
      await supabase.from("notifications").insert({
        role: "ADMIN",
        title: "Alerte Absences Consécutives",
        message: `${consecutiveAbsentees.join(", ")} a/ont été absent(s) 3 nuits consécutives dans le dortoir ${dortoirsToShow.find(d => d.id === dortoir_id)?.code}.`
      });
      // Notification to current user (surveillant)
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Alerte Absences Consécutives",
        message: `${consecutiveAbsentees.join(", ")} a/ont été absent(s) 3 nuits consécutives.`
      });
      toast.warning(`${consecutiveAbsentees.length} étudiant(s) absent(s) 3 nuits consécutives!`);
    }
  };

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
          <Label htmlFor="date" className="text-sm">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })}</CardTitle>
          <CardDescription>{isAdmin ? "Tous les dortoirs" : "Vos dortoirs assignés"}</CardDescription>
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
                      {a ? <><Eye className="h-3.5 w-3.5 mr-1" /> Voir / modifier</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Pointer</>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'effectif" : "Nouvel effectif"}</DialogTitle>
            <DialogDescription>
              Dortoir {dortoirsToShow.find((d) => d.id === form.dortoir_id)?.code} · {format(new Date(date), "dd/MM/yyyy")}
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
    </div>
  );
}
