import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Save, Eye, FileDown } from "lucide-react";
import { format, subDays, nextThursday, isThursday } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { DoneBadge } from "@/components/StatusBadge";
import { generateTablePdf } from "@/lib/pdf";

interface DortoirAssign {
  id: string;
  dortoir_id: string;
  dortoirs: { id: string; code: string };
}

export default function Weekend() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  
  // Default date should be the closest Thursday
  const initialDate = isThursday(new Date()) ? new Date() : nextThursday(subDays(new Date(), 6));
  const [date, setDate] = useState(format(initialDate, "yyyy-MM-dd"));
  
  const [myDortoirs, setMyDortoirs] = useState<DortoirAssign[]>([]);
  const [allDortoirs, setAllDortoirs] = useState<{ id: string; code: string; capacite?: number }[]>([]);
  const [weekendEffectifs, setWeekendEffectifs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ dortoir_id: "", nombre_presents: 0, observations: "" });

  const load = async () => {
    setLoading(true);
    if (isAdmin) {
      const [dort, eff] = await Promise.all([
        supabase.from("dortoirs").select("id, code, capacite").order("code"),
        supabase.from("weekend_effectifs").select("*, dortoirs(code)").eq("semaine_du", date).order("created_at"),
      ]);
      setAllDortoirs(dort.data ?? []);
      setWeekendEffectifs(eff.data ?? []);
    } else if (user) {
      const da = await supabase
        .from("dortoir_assignments")
        .select("id, dortoir_id, dortoirs(id, code)")
        .eq("surveillant_id", user.id);
      const myList = (da.data ?? []) as any[];
      setMyDortoirs(myList);
      const ids = myList.map((x) => x.dortoir_id);
      if (ids.length) {
        const { data: effRes } = await supabase
          .from("weekend_effectifs")
          .select("*, dortoirs(code)")
          .eq("semaine_du", date)
          .in("dortoir_id", ids);
        setWeekendEffectifs(effRes ?? []);
      } else {
        setWeekendEffectifs([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date, isAdmin]);

  const openNew = (dortoir_id: string) => {
    const existing = weekendEffectifs.find((a) => a.dortoir_id === dortoir_id);
    if (existing) {
      setEditing(existing);
      setForm({
        dortoir_id,
        nombre_presents: existing.nombre_presents,
        observations: existing.observations ?? "",
      });
    } else {
      setEditing(null);
      setForm({ dortoir_id, nombre_presents: 0, observations: "" });
    }
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    const payload = {
      dortoir_id: form.dortoir_id,
      surveillant_id: editing?.surveillant_id ?? user.id,
      semaine_du: date,
      nombre_presents: Number(form.nombre_presents) || 0,
      observations: form.observations || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("weekend_effectifs").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("weekend_effectifs").insert(payload));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Effectif mis à jour" : "Effectif enregistré");
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: editing ? "Modifié effectif weekend" : "Créé effectif weekend",
      entity: "weekend_effectifs",
      entity_id: editing?.id ?? null,
    });
    setOpen(false);
    load();
  };

  const exportPdf = async () => {
    const selectedDate = new Date(date);
    
    // Check if we already have the dortoirs loaded
    const dortoirsList = isAdmin ? allDortoirs : myDortoirs.map(d => d.dortoirs);
    
    let totalCapacite = 0;
    let totalPresents = 0;
    
    const rows = (dortoirsList ?? []).map((d: any) => {
      const rec = weekendEffectifs.find((w) => w.dortoir_id === d.id);
      const presents = rec?.nombre_presents ?? 0;
      const capacite = d.capacite ?? 0;
      const absents = Math.max(0, capacite - presents);
      
      totalCapacite += capacite;
      totalPresents += presents;
      
      return [
        `D. ${d.code}`,
        capacite,
        absents,
        presents,
        rec?.observations ?? "",
      ];
    });

    generateTablePdf({
      title: "Effectif Weekend",
      subtitle: `Semaine du ${format(selectedDate, "d MMMM yyyy", { locale: fr })}`,
      filename: `effectif_weekend_${date}.pdf`,
      head: ["Dortoir", "Capacité", "Absents", "Présents", "Observations"],
      rows,
      foot: [["TOTAL", String(totalCapacite), String(totalCapacite - totalPresents), String(totalPresents), ""]],
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
          <h1 className="text-3xl font-bold">Effectif Weekend</h1>
          <p className="text-muted-foreground mt-1">Gérer les présences pour le weekend (rempli le Jeudi)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <FileDown className="h-4 w-4 mr-1" /> Exporter PDF
            </Button>
          )}
          <Label htmlFor="date" className="text-sm">Semaine du (Jeudi)</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jeudi {format(new Date(date), "d MMMM yyyy", { locale: fr })}</CardTitle>
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
                const a = weekendEffectifs.find((x) => x.dortoir_id === d.id);
                return (
                  <li key={d.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Dortoir {d.code}</div>
                      <DoneBadge done={!!a} />
                    </div>
                    {a && (
                      <div className="text-sm text-muted-foreground mt-2">
                        {a.nombre_presents} présent{a.nombre_presents > 1 ? "s" : ""}
                      </div>
                    )}
                    <Button size="sm" variant={a ? "outline" : "default"} className="mt-3 w-full" onClick={() => openNew(d.id)}>
                      {a ? <><Eye className="h-3.5 w-3.5 mr-1" /> Voir / modifier</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Remplir</>}
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
            <DialogTitle>{editing ? "Modifier l'effectif" : "Nouvel effectif weekend"}</DialogTitle>
            <DialogDescription>
              Dortoir {dortoirsToShow.find((d) => d.id === form.dortoir_id)?.code} · Jeudi {format(new Date(date), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nb_pres">Nombre d'étudiants PRÉSENTS ce weekend</Label>
              <Input
                id="nb_pres"
                type="number"
                min={0}
                value={form.nombre_presents}
                onChange={(e) => setForm({ ...form, nombre_presents: Number(e.target.value) })}
              />
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
