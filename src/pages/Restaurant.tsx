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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Save, Eye, Plus, FileDown } from "lucide-react";
import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { REPAS_LABELS, RepasType, dateToWeekday } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateTablePdf } from "@/lib/pdf";

export default function Restaurant() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(searchParams.get("date") || format(new Date(), "yyyy-MM-dd"));

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
  };
  const [assignments, setAssignments] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ repas: "DEJEUNER" as RepasType, nombre_eleves: 0, status: "RAS", observations: "" });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [y, m, d] = date.split("-").map(Number);
      const wd = dateToWeekday(new Date(y, m - 1, d));

      const [aRes, lRes, tRes] = await Promise.all([
        supabase.from("restaurant_assignments").select("*").eq("date", date).order("repas"),
        supabase.from("restaurant_logs").select("*").eq("date", date).order("repas"),
        supabase.from("restaurant_template").select("*").eq("weekday", wd),
      ]);

      const allData = [...(aRes.data ?? []), ...(lRes.data ?? []), ...(tRes.data ?? [])];
      const userIds = Array.from(new Set(allData.map((x: any) => x.surveillant_id)));
      
      let nameById: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name || "—"]));
      }

      const mapWithProfile = (list: any[]) => list.map(item => ({
        ...item,
        profiles: { full_name: nameById[item.surveillant_id] || "—" }
      }));

      setAssignments(mapWithProfile(aRes.data ?? []));
      setLogs(mapWithProfile(lRes.data ?? []));
      setTemplates(mapWithProfile(tRes.data ?? []));
    } catch (err) {
      console.error("Load error:", err);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, date, isAdmin]);

  const openLog = (repas: RepasType) => {
    const existing = logs.find((l) => l.repas === repas && l.surveillant_id === user?.id);
    if (existing) {
      setEditing(existing);
      const isProblem = existing.observations && existing.observations !== "RAS" && existing.observations.trim() !== "";
      setForm({ 
        repas, 
        nombre_eleves: existing.nombre_eleves, 
        status: isProblem ? "PROBLEM" : "RAS",
        observations: isProblem ? existing.observations : "" 
      });
    } else {
      setEditing(null);
      setForm({ repas, nombre_eleves: 0, status: "RAS", observations: "" });
    }
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const assign = assignments.find((a) => a.repas === form.repas && (isAdmin || a.surveillant_id === user.id));
    const payload = {
      assignment_id: assign?.id ?? null,
      surveillant_id: editing?.surveillant_id ?? user.id,
      date,
      repas: form.repas,
      nombre_eleves: Number(form.nombre_eleves) || 0,
      observations: form.status === "RAS" ? "RAS" : form.observations,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("restaurant_logs").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("restaurant_logs").insert(payload));
    }
    if (error) { toast.error(error.message); return; }
    
    if (form.status === "PROBLEM" && form.observations) {
      await supabase.from("notifications").insert({
        role: "ADMIN",
        title: `Problème signalé au ${REPAS_LABELS[form.repas]}`,
        message: form.observations,
        link: `/restaurant?date=${date}`
      });
    }
    
    toast.success("Effectif enregistré");
    await supabase.from("activity_logs").insert({
      user_id: user.id, action: "Effectif restaurant", entity: "restaurant_logs",
    });
    setOpen(false);
    load();
  };

  const exportWeekPdf = async () => {
    // Sunday-anchored: take the week containing the selected date (Mon-Sun)
    const ws = startOfWeek(new Date(date), { weekStartsOn: 1 });
    const we = endOfWeek(new Date(date), { weekStartsOn: 1 });
    const start = format(ws, "yyyy-MM-dd");
    const end = format(we, "yyyy-MM-dd");

    const { data: weekLogs } = await supabase
      .from("restaurant_logs")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date");

    const ids = Array.from(new Set((weekLogs ?? []).map((l: any) => l.surveillant_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids)
      : { data: [] as any[] };
    const nameById: Record<string, string> = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name || "—"]));

    const rows = (weekLogs ?? []).map((l: any) => [
      format(new Date(l.date), "EEE dd/MM", { locale: fr }),
      REPAS_LABELS[l.repas as RepasType],
      nameById[l.surveillant_id] || "—",
      l.nombre_eleves,
      l.observations || "",
    ]);
    const total = (weekLogs ?? []).reduce((s: number, l: any) => s + (l.nombre_eleves || 0), 0);

    generateTablePdf({
      title: "Effectif Restaurant — Semaine",
      subtitle: `Du ${format(ws, "d MMM yyyy", { locale: fr })} au ${format(we, "d MMM yyyy", { locale: fr })}`,
      filename: `restaurant_${start}_${end}.pdf`,
      head: ["Date", "Repas", "Surveillant", "Nb élèves", "Observations"],
      rows,
      foot: [["", "", "TOTAL", String(total), ""]],
    });
    toast.success("PDF généré");
  };

  const getTaskStatus = (r: RepasType, hasLog: boolean) => {
    if (hasLog) return { label: "Terminé", color: "bg-green-500 hover:bg-green-600 text-white" };
    
    const now = new Date();
    const targetDate = new Date(date);
    
    // Simple logic: if date is past -> Missed. If today -> In progress. If future -> In progress/waiting.
    // We can refine this with hours, but basic logic suffices.
    const isToday = now.toDateString() === targetDate.toDateString();
    const isPast = targetDate < now && !isToday;
    
    if (isPast) return { label: "Manqué", color: "bg-red-500 hover:bg-red-600 text-white" };
    return { label: "En cours", color: "bg-yellow-500 hover:bg-yellow-600 text-white" };
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Restaurant</h1>
          <p className="text-muted-foreground mt-1">Effectif des élèves par service</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={exportWeekPdf}>
              <FileDown className="h-4 w-4 mr-1" /> PDF semaine
            </Button>
          )}
          <Label htmlFor="d" className="text-sm">Date</Label>
          <Input id="d" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-auto" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })}</CardTitle>
          <CardDescription>
            {isAdmin ? "Vue de tous les services" : "Vos services assignés"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["PETIT_DEJEUNER", "DEJEUNER", "DINER"] as RepasType[]).map((r) => {
                const myAssigns = assignments.filter((a) => a.repas === r);
                const myTemplates = templates.filter((t) => t.repas === r);
                const myLogs = logs.filter((l) => l.repas === r);
                const myLog = myLogs.find((l) => l.surveillant_id === user?.id);
                
                // Combined assigned status: either in explicit assignments or in the template
                const isUserAssigned = myAssigns.some((a) => a.surveillant_id === user?.id) || 
                                      myTemplates.some((t) => t.surveillant_id === user?.id);
                
                const totalAssignedCount = myAssigns.length + myTemplates.length;

                const assignedUsers = [...myAssigns, ...myTemplates].map(x => x.profiles?.full_name).filter(Boolean);
                const assignedNames = Array.from(new Set(assignedUsers)).join(", ");

                return (
                  <div key={r} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{REPAS_LABELS[r]}</div>
                      {!isAdmin && isUserAssigned && (
                        <Badge className={myLog ? "bg-green-500 text-white hover:bg-green-600" : "bg-yellow-500 text-white hover:bg-yellow-600"}>
                          {myLog ? "Terminé" : "En cours"}
                        </Badge>
                      )}
                      {isAdmin && (
                        <Badge className={getTaskStatus(r, myLogs.length > 0).color}>
                          {getTaskStatus(r, myLogs.length > 0).label}
                        </Badge>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="text-sm text-muted-foreground mb-3">
                        <span className="font-medium text-foreground">Assigné à: </span>
                        {totalAssignedCount === 0 ? "Personne" : assignedNames}
                      </div>
                    )}
                    {myLogs.length > 0 && (
                      <div className="text-sm space-y-1 mb-3">
                        {myLogs.map((l) => (
                          <div key={l.id} className="flex justify-between items-center bg-muted/30 p-2 rounded">
                            <span className="truncate pr-2">{l.profiles?.full_name ?? "Vous"}</span>
                            <span className="font-semibold bg-background px-2 py-0.5 rounded shadow-sm">{l.nombre_eleves} él.</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isUserAssigned && !isAdmin && (
                      <Button size="sm" variant={myLog ? "outline" : "default"} className="w-full mt-2" onClick={() => openLog(r)}>
                        {myLog ? <><Eye className="h-3.5 w-3.5 mr-1" /> Modifier</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Pointer</>}
                      </Button>
                    )}
                    {!isUserAssigned && !isAdmin && (
                      <p className="text-xs text-muted-foreground mt-2 italic text-center">Non assigné</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{REPAS_LABELS[form.repas]}</DialogTitle>
            <DialogDescription>{format(new Date(date), "dd/MM/yyyy")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nb">Nombre d'élèves</Label>
              <Input id="nb" type="number" min={0} value={form.nombre_eleves}
                onChange={(e) => setForm({ ...form, nombre_eleves: Number(e.target.value) })} />
            </div>
            <div className="space-y-3">
              <Label>Statut du service</Label>
              <RadioGroup value={form.status} onValueChange={(v) => setForm({ ...form, status: v })} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="RAS" id="ras" />
                  <Label htmlFor="ras" className="font-normal cursor-pointer">RAS (Rien à signaler)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PROBLEM" id="prob" />
                  <Label htmlFor="prob" className="font-normal cursor-pointer">Problème</Label>
                </div>
              </RadioGroup>
            </div>
            {form.status === "PROBLEM" && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="obs">Description du problème</Label>
                <Textarea id="obs" rows={3} value={form.observations}
                  placeholder="Décrivez le problème rencontré..."
                  onChange={(e) => setForm({ ...form, observations: e.target.value })} />
              </div>
            )}
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
