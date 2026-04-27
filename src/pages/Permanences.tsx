import { useEffect, useState, useMemo } from "react";
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
import { Loader2, Save, Plus, Clock, Calendar as CalIcon, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { PermanenceLog, PermanenceSlot, SLOT_LABELS, dateToWeekday } from "@/lib/types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SLOT_TIMES: Record<PermanenceSlot, { start: string, end: string }> = {
  MATIN: { start: "08:00", end: "13:00" },
  APRES_MIDI: { start: "14:00", end: "19:00" },
  NUIT: { start: "20:00", end: "23:00" },
};

export default function Permanences() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<PermanenceLog[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ 
    start_time: "08:00", 
    end_time: "13:00", 
    observation: "" 
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const wd = dateToWeekday(date);

      let logsQuery = supabase.from("permanence_logs").select("*").eq("date", dateStr).order("start_time");
      let assignQuery = supabase.from("permanences").select("*, profiles(full_name)").eq("date", dateStr);
      let tplQuery = supabase.from("permanence_template").select("*, profiles:profiles!permanence_template_surveillant_id_fkey(full_name)").eq("weekday", wd);
      
      if (!isAdmin) {
        logsQuery = logsQuery.eq("surveillant_id", user.id);
        assignQuery = assignQuery.eq("surveillant_id", user.id);
        tplQuery = tplQuery.eq("surveillant_id", user.id);
      }

      const [logsRes, assignRes, tplRes] = await Promise.all([logsQuery, assignQuery, tplQuery]);
      
      if (logsRes.error) throw logsRes.error;
      
      const combinedLogs = logsRes.data || [];
      if (combinedLogs.length > 0) {
        const userIds = Array.from(new Set(combinedLogs.map((x: any) => x.surveillant_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        const nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name || "—"]));
        setLogs(combinedLogs.map(l => ({ ...l, full_name: nameById[l.surveillant_id] })));
      } else {
        setLogs([]);
      }

      setAssignments(assignRes.data || []);
      setTemplates(tplRes.data || []);
    } catch (err: any) {
      toast.error("Erreur lors du chargement: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, date, isAdmin]);

  const confirmAssignment = (slot: PermanenceSlot) => {
    const times = SLOT_TIMES[slot];
    setForm({
      start_time: times.start,
      end_time: times.end,
      observation: `Confirmation de la permanence : ${SLOT_LABELS[slot].split(" (")[0]}`
    });
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const payload = {
      surveillant_id: user.id,
      date: format(date, "yyyy-MM-dd"),
      start_time: form.start_time,
      end_time: form.end_time,
      observation: form.observation || null,
    };

    const { error } = await supabase.from("permanence_logs").insert(payload);
    if (error) { toast.error(error.message); return; }

    toast.success("Pointage enregistré");
    await supabase.from("activity_logs").insert({
      user_id: user.id, action: "Pointage permanence", entity: "permanence_logs",
    });
    setOpen(false);
    load();
  };

  const deleteLog = async (id: string) => {
    if (!confirm("Supprimer ce pointage ?")) return;
    const { error } = await supabase.from("permanence_logs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pointage supprimé");
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Permanences</h1>
          <p className="text-muted-foreground mt-1">Enregistrez vos heures de présence</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
                <CalIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP", { locale: fr }) : <span>Choisir une date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle Permanence
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Permanences assignées ({format(date, "d MMMM", { locale: fr })})
          </CardTitle>
          <CardDescription>Confirmez votre présence pour les créneaux prévus</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...templates, ...assignments].length === 0 ? (
                <p className="text-sm text-muted-foreground italic col-span-2">Aucune permanence assignée pour aujourd'hui.</p>
              ) : (
                [...templates, ...assignments].map((a, i) => {
                  const isDone = logs.some(l => 
                    l.surveillant_id === a.surveillant_id && 
                    // Simple check: if there's any log for this day, we consider it "started"
                    // Better check: check if time ranges overlap or match slot
                    l.start_time.startsWith(SLOT_TIMES[a.slot as PermanenceSlot].start.split(':')[0])
                  );
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div>
                        <div className="font-semibold">{SLOT_LABELS[a.slot as PermanenceSlot].split(" (")[0]}</div>
                        <div className="text-xs text-muted-foreground">{SLOT_LABELS[a.slot as PermanenceSlot].split(" (")[1].replace(")", "")}</div>
                        {isAdmin && <div className="text-[10px] text-primary">{a.profiles?.full_name}</div>}
                      </div>
                      <Button 
                        size="sm" 
                        variant={isDone ? "outline" : "default"}
                        disabled={isDone && !isAdmin}
                        onClick={() => confirmAssignment(a.slot as PermanenceSlot)}
                      >
                        {isDone ? "Confirmé" : "Confirmer"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Historique des pointages du {format(date, "d MMMM yyyy", { locale: fr })}
          </CardTitle>
          <CardDescription>
            {isAdmin ? "Tous les pointages pour cette date" : "Vos pointages pour cette date"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
              <CalIcon className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
              <p className="text-muted-foreground">Aucune permanence enregistrée pour cette date.</p>
              {!isAdmin && (
                <Button variant="link" onClick={() => setOpen(true)} className="mt-2">
                  Enregistrer une permanence maintenant
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-lg">
                        {log.start_time.substring(0, 5)} — {log.end_time.substring(0, 5)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isAdmin ? `Par: ${log.full_name}` : "Votre pointage"}
                      </div>
                      {log.observation && (
                        <div className="mt-1 text-sm bg-muted/50 p-2 rounded italic">
                          "{log.observation}"
                        </div>
                      )}
                    </div>
                  </div>
                  {(isAdmin || log.surveillant_id === user?.id) && (
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteLog(log.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Permanence</DialogTitle>
            <DialogDescription>
              Enregistrez vos heures pour le {format(date, "dd MMMM yyyy", { locale: fr })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Heure de début</Label>
                <Input id="start" type="time" value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Heure de fin</Label>
                <Input id="end" type="time" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observation (facultatif)</Label>
              <Textarea id="obs" placeholder="Notes, particularités..." rows={3} value={form.observation}
                onChange={(e) => setForm({ ...form, observation: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-2" /> Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
