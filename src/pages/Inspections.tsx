import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, DoorOpen, AlertTriangle, Star } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Chambre {
  id: string;
  numero: string;
  capacite: number;
  dortoir_id: string;
  dortoir_code?: string;
}
interface Inspection {
  id: string;
  chambre_id: string;
  surveillant_id: string;
  date: string;
  proprete: number;
  ordre: number;
  degats: boolean;
  observations: string | null;
  surveillant_name?: string;
  chambre_numero?: string;
  dortoir_code?: string;
}

export default function Inspections() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [chambres, setChambres] = useState<Chambre[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [recentInspections, setRecentInspections] = useState<Inspection[]>([]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    chambre_id: "",
    proprete: 5,
    ordre: 5,
    degats: false,
    observations: "",
  });

  const load = async () => {
    setLoading(true);
    if (!user) return;

    // Load chambres available to this user
    let chambreData: any[] = [];
    if (isAdmin) {
      const { data } = await supabase.from("chambres").select("*, dortoirs(code)").order("numero");
      chambreData = (data ?? []).map((c: any) => ({ ...c, dortoir_code: c.dortoirs?.code }));
    } else {
      // Surveillant: only chambres in their assigned dortoirs
      const { data: da } = await supabase
        .from("dortoir_assignments")
        .select("dortoir_id")
        .eq("surveillant_id", user.id);
      const dortoirIds = (da ?? []).map((x: any) => x.dortoir_id);
      if (dortoirIds.length) {
        const { data } = await supabase
          .from("chambres")
          .select("*, dortoirs(code)")
          .in("dortoir_id", dortoirIds)
          .order("numero");
        chambreData = (data ?? []).map((c: any) => ({ ...c, dortoir_code: c.dortoirs?.code }));
      }
    }
    setChambres(chambreData);

    // Today's inspections
    const insQuery = supabase
      .from("chambre_inspections")
      .select("*")
      .eq("date", date);
    const { data: ins } = isAdmin ? await insQuery : await insQuery.eq("surveillant_id", user.id);

    // Recent (last 7 days) for context
    const since = format(subDays(new Date(date), 6), "yyyy-MM-dd");
    const recentQuery = supabase
      .from("chambre_inspections")
      .select("*")
      .gte("date", since)
      .lte("date", date)
      .order("date", { ascending: false })
      .limit(60);
    const { data: rec } = isAdmin ? await recentQuery : await recentQuery.eq("surveillant_id", user.id);

    // Enrich names
    const surveillantIds = Array.from(new Set([
      ...(ins ?? []).map((x: any) => x.surveillant_id),
      ...(rec ?? []).map((x: any) => x.surveillant_id),
    ]));
    let nameById: Record<string, string> = {};
    if (surveillantIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", surveillantIds);
      nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name || "—"]));
    }
    const chambreById = Object.fromEntries(chambreData.map((c) => [c.id, c]));

    const enrich = (rows: any[]): Inspection[] =>
      rows.map((r) => ({
        ...r,
        surveillant_name: nameById[r.surveillant_id] || "—",
        chambre_numero: chambreById[r.chambre_id]?.numero ?? "?",
        dortoir_code: chambreById[r.chambre_id]?.dortoir_code ?? "?",
      }));

    setInspections(enrich(ins ?? []));
    setRecentInspections(enrich(rec ?? []));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, date, isAdmin]);

  const inspectedChambreIds = useMemo(
    () => new Set(inspections.map((i) => i.chambre_id)),
    [inspections]
  );

  const openNew = () => {
    setForm({ chambre_id: "", proprete: 5, ordre: 5, degats: false, observations: "" });
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.chambre_id) { toast.error("Choisir une chambre"); return; }
    const { error } = await supabase.from("chambre_inspections").insert({
      chambre_id: form.chambre_id,
      surveillant_id: user.id,
      date,
      proprete: form.proprete,
      ordre: form.ordre,
      degats: form.degats,
      observations: form.observations || null,
    });
    if (error) {
      if (error.code === "23505") toast.error("Cette chambre a déjà été inspectée à cette date.");
      else toast.error(error.message);
      return;
    }
    toast.success("Inspection enregistrée");
    await supabase.from("activity_logs").insert({
      user_id: user.id, action: "Inspection chambre", entity: "chambre_inspections",
    });
    setOpen(false);
    load();
  };

  const Stars = ({ n }: { n: number }) => (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );

  const isToday = date === format(new Date(), "yyyy-MM-dd");
  const remainingChambres = chambres.filter((c) => !inspectedChambreIds.has(c.id));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Inspections de chambres</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Suivi des inspections quotidiennes" : "Inspectez une chambre par jour"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="d" className="text-sm">Date</Label>
          <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          {!isAdmin && isToday && (
            <Button onClick={openNew} disabled={chambres.length === 0} title={chambres.length === 0 ? "Aucune chambre assignée" : "Ajouter une inspection"}>
              <Plus className="h-4 w-4 mr-1" /> Nouvelle inspection
            </Button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <Card className={inspections.length > 0 ? "border-success" : (chambres.length === 0 ? "border-destructive" : "border-warning")}>
          <CardContent className="pt-4 flex items-center gap-3">
            <DoorOpen className={`h-5 w-5 ${inspections.length > 0 ? "text-success" : (chambres.length === 0 ? "text-destructive" : "text-warning")}`} />
            <div className="flex-1">
              <div className="font-medium text-sm">
                {chambres.length === 0 
                  ? "⚠ Vous n'êtes assigné à aucun dortoir pour le moment."
                  : inspections.length > 0
                  ? `✓ Vous avez inspecté ${inspections.length} chambre(s) aujourd'hui`
                  : "Vous devez inspecter au moins une chambre aujourd'hui"}
              </div>
              <div className="text-xs text-muted-foreground">
                {chambres.length} chambre(s) disponible(s) dans vos dortoirs · {remainingChambres.length} restantes
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Inspections du {format(new Date(date), "d MMMM yyyy", { locale: fr })}
              </CardTitle>
              <CardDescription>{inspections.length} inspection(s) ce jour</CardDescription>
            </CardHeader>
            <CardContent>
              {inspections.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucune inspection.</p>
              ) : (
                <ul className="divide-y">
                  {inspections.map((i) => (
                    <li key={i.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">
                          Chambre {i.chambre_numero} · Dortoir {i.dortoir_code}
                          {i.degats && <Badge variant="destructive" className="ml-2"><AlertTriangle className="h-3 w-3 mr-1" />Dégâts</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Par {i.surveillant_name}
                        </div>
                        {i.observations && (
                          <div className="text-sm mt-1 text-muted-foreground">{i.observations}</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 text-xs shrink-0">
                        <div className="flex items-center gap-2"><span className="text-muted-foreground w-16">Propreté</span><Stars n={i.proprete} /></div>
                        <div className="flex items-center gap-2"><span className="text-muted-foreground w-16">Ordre</span><Stars n={i.ordre} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">7 derniers jours</CardTitle>
                <CardDescription>Historique récent</CardDescription>
              </CardHeader>
              <CardContent>
                {recentInspections.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucune inspection.</p>
                ) : (
                  <ul className="text-sm divide-y">
                    {recentInspections.map((i) => (
                      <li key={i.id} className="py-2 flex justify-between gap-2">
                        <span>
                          {format(new Date(i.date), "dd/MM")} · Ch. {i.chambre_numero} (D. {i.dortoir_code}) · {i.surveillant_name}
                          {i.degats && <span className="ml-2 text-destructive text-xs">⚠ dégâts</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">P:{i.proprete} O:{i.ordre}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle inspection</DialogTitle>
            <DialogDescription>{format(new Date(date), "EEEE d MMMM", { locale: fr })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chambre</Label>
              <Select value={form.chambre_id} onValueChange={(v) => setForm({ ...form, chambre_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir une chambre..." /></SelectTrigger>
                <SelectContent>
                  {remainingChambres.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">Toutes les chambres sont déjà inspectées aujourd'hui.</div>
                  ) : remainingChambres.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Chambre {c.numero} · Dortoir {c.dortoir_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Propreté (1–5)</Label>
                <Select value={String(form.proprete)} onValueChange={(v) => setForm({ ...form, proprete: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ordre (1–5)</Label>
                <Select value={String(form.ordre)} onValueChange={(v) => setForm({ ...form, ordre: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="deg" checked={form.degats} onCheckedChange={(v) => setForm({ ...form, degats: !!v })} />
              <Label htmlFor="deg" className="text-sm cursor-pointer">Dégâts constatés</Label>
            </div>
            <div className="space-y-2">
              <Label>Observations</Label>
              <Textarea rows={3} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
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
