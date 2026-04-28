import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, X, BedDouble, DoorOpen, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export default function Dortoirs() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [dortoirs, setDortoirs] = useState<any[]>([]);
  const [assigns, setAssigns] = useState<any[]>([]);
  const [chambres, setChambres] = useState<any[]>([]);
  const [surveillants, setSurveillants] = useState<{ user_id: string; full_name: string }[]>([]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ dortoir_id: "", surveillant_id: "" });

  const [openCh, setOpenCh] = useState(false);
  const [chForm, setChForm] = useState({ dortoir_id: "", numero: "", etudiants: "" });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    
    let dQuery = supabase.from("dortoirs").select("*").order("code");
    let aQuery = supabase.from("dortoir_assignments").select("*, dortoirs(code)");
    let chQuery = supabase.from("chambres").select("*").order("numero");

    if (!isAdmin) {
      const { data: myAssigns } = await supabase.from("dortoir_assignments").select("dortoir_id").eq("surveillant_id", user.id);
      const myDortoirIds = (myAssigns ?? []).map(a => a.dortoir_id);
      
      if (myDortoirIds.length > 0) {
        dQuery = dQuery.in("id", myDortoirIds);
        aQuery = aQuery.in("dortoir_id", myDortoirIds);
        chQuery = chQuery.in("dortoir_id", myDortoirIds);
      } else {
        setDortoirs([]); setAssigns([]); setChambres([]); setSurveillants([]); setLoading(false); return;
      }
    }

    const [d, a, ch, sRoles] = await Promise.all([
      dQuery,
      aQuery,
      chQuery,
      isAdmin ? supabase.from("user_roles").select("user_id").eq("role", "SURVEILLANT") : Promise.resolve({ data: [] }),
    ]);
    const survIds = (sRoles.data ?? []).map((r: any) => r.user_id);
    const { data: survProfiles } = survIds.length
      ? await supabase.from("profiles").select("user_id, full_name, is_active").in("user_id", survIds)
      : { data: [] as any[] };

    const profileMap = new Map<string, string>();
    (survProfiles ?? []).forEach((p: any) => profileMap.set(p.user_id, p.full_name || "(sans nom)"));
    const allAssignIds = Array.from(new Set((a.data ?? []).map((x: any) => x.surveillant_id)));
    const missing = allAssignIds.filter((id) => !profileMap.has(id as string));
    if (missing.length) {
      const { data: extra } = await supabase.from("profiles").select("user_id, full_name").in("user_id", missing as string[]);
      (extra ?? []).forEach((p: any) => profileMap.set(p.user_id, p.full_name || "(sans nom)"));
    }
    const enrichedAssigns = (a.data ?? []).map((x: any) => ({
      ...x,
      surveillant_name: profileMap.get(x.surveillant_id) || "—",
    }));

    setDortoirs(d.data ?? []);
    setAssigns(enrichedAssigns);
    setChambres(ch.data ?? []);
    if (isAdmin) {
      setSurveillants(
        (survProfiles ?? [])
          .filter((p: any) => p.is_active !== false)
          .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name || "(sans nom)" }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.dortoir_id || !form.surveillant_id) { toast.error("Sélection requise"); return; }
    const { error } = await supabase.from("dortoir_assignments").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Surveillant assigné");
    setOpen(false); setForm({ dortoir_id: "", surveillant_id: "" }); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("dortoir_assignments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const createChambre = async () => {
    if (!chForm.dortoir_id || !chForm.numero) { toast.error("Numéro et dortoir requis"); return; }
    const { error } = await supabase.from("chambres").insert(chForm);
    if (error) {
      if (error.code === "23505") toast.error("Ce numéro de chambre existe déjà dans ce dortoir.");
      else toast.error(error.message);
      return;
    }
    toast.success("Chambre ajoutée");
    setOpenCh(false); setChForm({ dortoir_id: "", numero: "", etudiants: "" }); load();
  };

  const removeChambre = async (id: string) => {
    if (!confirm("Supprimer cette chambre ? Les inspections associées seront aussi supprimées.")) return;
    const { error } = await supabase.from("chambres").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dortoirs</h1>
          <p className="text-muted-foreground mt-1">Affectations, chambres et surveillants</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openCh} onOpenChange={setOpenCh}>
            <DialogTrigger asChild>
              <Button variant="outline"><DoorOpen className="h-4 w-4 mr-1" /> Nouvelle chambre</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter une chambre</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Dortoir</Label>
                  <Select value={chForm.dortoir_id} onValueChange={(v) => setChForm({ ...chForm, dortoir_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {dortoirs.map((d) => <SelectItem key={d.id} value={d.id}>Dortoir {d.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Numéro</Label>
                  <Input value={chForm.numero} onChange={(e) => setChForm({ ...chForm, numero: e.target.value })} placeholder="Ex : 101" />
                </div>
                <div className="space-y-2 mt-2">
                  <Label>Noms des étudiants (Optionnel)</Label>
                  <Textarea 
                    value={chForm.etudiants} 
                    onChange={(e) => setChForm({ ...chForm, etudiants: e.target.value })} 
                    placeholder="Ex: Ahmed Ben Ali, Youssef Mansour..." 
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCh(false)}>Annuler</Button>
                <Button onClick={createChambre}>Ajouter</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Affectation</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Affecter un surveillant</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Dortoir</Label>
                    <Select value={form.dortoir_id} onValueChange={(v) => setForm({ ...form, dortoir_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>
                        {dortoirs.map((d) => <SelectItem key={d.id} value={d.id}>Dortoir {d.code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Surveillant</Label>
                    <Select value={form.surveillant_id} onValueChange={(v) => setForm({ ...form, surveillant_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>
                        {surveillants.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button onClick={create}>Assigner</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dortoirs.map((d) => {
            const dortoirAssigns = assigns.filter((a) => a.dortoir_id === d.id);
            const dortoirChambres = chambres.filter((c) => c.dortoir_id === d.id);
            return (
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-primary" />
                    Dortoir {d.code}
                  </CardTitle>
                  <CardDescription>
                    {dortoirAssigns.length} surveillant{dortoirAssigns.length > 1 ? "s" : ""} ·{" "}
                    {dortoirChambres.length} chambre{dortoirChambres.length > 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Surveillants</div>
                    {dortoirAssigns.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucun</p>
                    ) : (
                      <ul className="space-y-1">
                        {dortoirAssigns.map((a) => (
                          <li key={a.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/40">
                            <span>{a.surveillant_name || "—"}</span>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(a.id)}>
                                <X className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Chambres</div>
                    {dortoirChambres.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Aucune</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dortoirChambres.map((c) => (
                          <div key={c.id} className="text-xs p-2 rounded bg-accent/50 border border-border/50">
                            <div className="flex items-center justify-between font-medium">
                              <span className="flex items-center gap-1"><DoorOpen className="h-3 w-3" /> Chambre {c.numero}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => removeChambre(c.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive hover:opacity-70" />
                                </button>
                              </div>
                            </div>
                            {c.etudiants && (
                              <div className="mt-1.5 flex items-start gap-1 text-muted-foreground/90">
                                <Users className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="break-words">{c.etudiants}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
