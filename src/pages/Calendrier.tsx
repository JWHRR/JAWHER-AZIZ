import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, ChevronLeft, ChevronRight, Trash2, Repeat } from "lucide-react";
import { addDays, format, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  SLOT_LABELS, REPAS_LABELS, WEEKDAY_LABELS, WEEKDAYS_ORDER,
  PermanenceSlot, RepasType, Weekday, dateToWeekday, WeekendPermanence
} from "@/lib/types";

interface TemplatePerm {
  id: string;
  surveillant_id: string;
  weekday: Weekday;
  slot: PermanenceSlot;
  notes: string | null;
  full_name?: string;
}
interface TemplateResto {
  id: string;
  surveillant_id: string;
  weekday: Weekday;
  repas: RepasType;
  full_name?: string;
}

export default function Calendrier() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [tab, setTab] = useState<"week" | "template">("week");

  // Week view state
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);

  // Templates (recurring)
  const [tplPerms, setTplPerms] = useState<TemplatePerm[]>([]);
  const [tplRestos, setTplRestos] = useState<TemplateResto[]>([]);
  // Per-week overrides (existing one-off rows)
  const [overridePerms, setOverridePerms] = useState<any[]>([]);
  const [overrideRestos, setOverrideRestos] = useState<any[]>([]);
  const [weekendPerm, setWeekendPerm] = useState<WeekendPermanence | null>(null);

  const [surveillants, setSurveillants] = useState<{ user_id: string; full_name: string }[]>([]);

  // Dialog state — add to template
  const [openP, setOpenP] = useState(false);
  const [openR, setOpenR] = useState(false);
  const [pForm, setPForm] = useState({ surveillant_id: "", weekday: "LUN" as Weekday, slot: "MATIN" as PermanenceSlot, notes: "" });
  const [rForm, setRForm] = useState({ surveillant_id: "", weekday: "LUN" as Weekday, repas: "DEJEUNER" as RepasType });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 6);

  const load = async () => {
    setLoading(true);
    const start = format(weekStart, "yyyy-MM-dd");
    const end = format(weekEnd, "yyyy-MM-dd");

    // 1. Always load template (everyone can read it)
    const [tplP, tplR] = await Promise.all([
      supabase.from("permanence_template").select("*"),
      supabase.from("restaurant_template").select("*"),
    ]);

    // 2. Load surveillant names so we can attach to template rows
    const ids = Array.from(new Set([
      ...(tplP.data ?? []).map((x: any) => x.surveillant_id),
      ...(tplR.data ?? []).map((x: any) => x.surveillant_id),
    ]));
    let nameById: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name || "(sans nom)"]));
    }

    let allTplP = (tplP.data ?? []).map((x: any) => ({ ...x, full_name: nameById[x.surveillant_id] })) as TemplatePerm[];
    let allTplR = (tplR.data ?? []).map((x: any) => ({ ...x, full_name: nameById[x.surveillant_id] })) as TemplateResto[];

    // Surveillants only see their own assignments in week view
    if (!isAdmin && user) {
      allTplP = allTplP.filter((x) => x.surveillant_id === user.id);
      allTplR = allTplR.filter((x) => x.surveillant_id === user.id);
    }
    setTplPerms(allTplP);
    setTplRestos(allTplR);

    // 3. One-off overrides for this week
    let pRes: any = { data: [] };
    let rRes: any = { data: [] };
    let wpRes: any = { data: [] };
    
    if (isAdmin) {
      [pRes, rRes, wpRes] = await Promise.all([
        supabase.from("permanences").select("*, profiles!permanences_surveillant_id_fkey(full_name)").gte("date", start).lte("date", end),
        supabase.from("restaurant_assignments").select("*, profiles!restaurant_assignments_surveillant_id_fkey(full_name)").gte("date", start).lte("date", end),
        supabase.from("weekend_permanences").select("*, profiles!weekend_permanences_surveillant_id_fkey(full_name)").eq("week_start_date", start),
      ]);
    } else if (user) {
      [pRes, rRes, wpRes] = await Promise.all([
        supabase.from("permanences").select("*").eq("surveillant_id", user.id).gte("date", start).lte("date", end),
        supabase.from("restaurant_assignments").select("*").eq("surveillant_id", user.id).gte("date", start).lte("date", end),
        supabase.from("weekend_permanences").select("*").eq("surveillant_id", user.id).eq("week_start_date", start),
      ]);
    }
    setOverridePerms(pRes.data ?? []);
    setOverrideRestos(rRes.data ?? []);
    
    if (wpRes.data && wpRes.data.length > 0) {
      const wp = wpRes.data[0];
      setWeekendPerm({ ...wp, full_name: wp.profiles?.full_name || nameById[wp.surveillant_id] });
    } else {
      setWeekendPerm(null);
    }

    // 4. Load surveillant list for admin dialogs
    if (isAdmin) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "SURVEILLANT");
      const sIds = (roles ?? []).map((r: any) => r.user_id);
      const { data: profs } = sIds.length
        ? await supabase.from("profiles").select("user_id, full_name, is_active").in("user_id", sIds)
        : { data: [] as any[] };
      const list = (profs ?? [])
        .filter((p: any) => p.is_active !== false)
        .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name || "(sans nom)" }));
      setSurveillants(list);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, weekStart, isAdmin]);

  // ---- Template CRUD ----
  const addTplPerm = async () => {
    if (!pForm.surveillant_id) { toast.error("Choisir un surveillant"); return; }
    const { error } = await supabase.from("permanence_template").insert({
      surveillant_id: pForm.surveillant_id,
      weekday: pForm.weekday,
      slot: pForm.slot,
      notes: pForm.notes || null,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ajouté au planning hebdomadaire");
    setOpenP(false); load();
  };
  const addTplResto = async () => {
    if (!rForm.surveillant_id) { toast.error("Choisir un surveillant"); return; }
    const { error } = await supabase.from("restaurant_template").insert({
      surveillant_id: rForm.surveillant_id,
      weekday: rForm.weekday,
      repas: rForm.repas,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ajouté au planning hebdomadaire");
    setOpenR(false); load();
  };
  const removeTplPerm = async (id: string) => {
    if (!confirm("Retirer cette permanence du planning récurrent ?")) return;
    const { error } = await supabase.from("permanence_template").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };
  const removeTplResto = async (id: string) => {
    if (!confirm("Retirer ce service du planning récurrent ?")) return;
    const { error } = await supabase.from("restaurant_template").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };
  const removeOverridePerm = async (id: string) => {
    const { error } = await supabase.from("permanences").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };
  const removeOverrideResto = async (id: string) => {
    const { error } = await supabase.from("restaurant_assignments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };
  
  const assignWeekendPerm = async (survId: string) => {
    if (!survId) return;
    const start = format(weekStart, "yyyy-MM-dd");
    const { error } = await supabase.from("weekend_permanences").insert({
      surveillant_id: survId,
      week_start_date: start,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Permanence de week-end assignée");
    load();
  };

  const removeWeekendPerm = async (id: string) => {
    if (!confirm("Retirer cette permanence de week-end ?")) return;
    const { error } = await supabase.from("weekend_permanences").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  // ---- Render helpers ----
  const dayPerms = (d: Date) => {
    const wd = dateToWeekday(d);
    const fromTpl = tplPerms.filter((t) => t.weekday === wd);
    const fromOverride = overridePerms.filter((p) => p.date === format(d, "yyyy-MM-dd"));
    return { fromTpl, fromOverride };
  };
  const dayRestos = (d: Date) => {
    const wd = dateToWeekday(d);
    const fromTpl = tplRestos.filter((t) => t.weekday === wd);
    const fromOverride = overrideRestos.filter((r) => r.date === format(d, "yyyy-MM-dd"));
    return { fromTpl, fromOverride };
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Calendrier</h1>
          <p className="text-muted-foreground mt-1">Planning hebdomadaire récurrent — appliqué chaque semaine de l'année</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="week"><ChevronRight className="h-3.5 w-3.5 mr-1" />Vue semaine</TabsTrigger>
          {isAdmin && <TabsTrigger value="template"><Repeat className="h-3.5 w-3.5 mr-1" />Planning récurrent</TabsTrigger>}
        </TabsList>

        {/* ---------- WEEK VIEW ---------- */}
        <TabsContent value="week" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium">
              Semaine du {format(weekStart, "d MMM", { locale: fr })} au {format(weekEnd, "d MMM yyyy", { locale: fr })}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {days.map((d) => {
                const { fromTpl: pTpl, fromOverride: pOv } = dayPerms(d);
                const { fromTpl: rTpl, fromOverride: rOv } = dayRestos(d);
                const isToday = format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                const empty = pTpl.length + pOv.length + rTpl.length + rOv.length === 0;
                return (
                  <Card key={d.toISOString()} className={isToday ? "border-primary shadow-md" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        <div className="capitalize">{format(d, "EEE", { locale: fr })}</div>
                        <div className={`text-2xl font-bold ${isToday ? "text-primary" : ""}`}>{format(d, "dd")}</div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 pt-0">
                      {pTpl.map((p) => (
                        <div key={`tp-${p.id}`} className="text-xs p-2 rounded bg-primary-soft border border-primary/20">
                          <div className="font-medium text-primary flex items-center gap-1">
                            <Repeat className="h-3 w-3" />
                            {SLOT_LABELS[p.slot].split(" (")[0]}
                          </div>
                          {isAdmin && <div className="text-muted-foreground truncate">{p.full_name}</div>}
                        </div>
                      ))}
                      {pOv.map((p: any) => (
                        <div key={`po-${p.id}`} className="text-xs p-2 rounded bg-accent border border-accent-foreground/10">
                          <div className="font-medium">{SLOT_LABELS[p.slot as PermanenceSlot].split(" (")[0]} <span className="text-[10px] text-muted-foreground">(extra)</span></div>
                          {isAdmin && <div className="text-muted-foreground truncate">{p.profiles?.full_name}</div>}
                          {isAdmin && (
                            <button onClick={() => removeOverridePerm(p.id)} className="text-destructive text-[10px] hover:underline">Suppr.</button>
                          )}
                        </div>
                      ))}
                      {rTpl.map((r) => (
                        <div key={`tr-${r.id}`} className="text-xs p-2 rounded bg-warning-soft border border-warning/20">
                          <div className="font-medium text-warning flex items-center gap-1">
                            <Repeat className="h-3 w-3" />🍽 {REPAS_LABELS[r.repas]}
                          </div>
                          {isAdmin && <div className="text-muted-foreground truncate">{r.full_name}</div>}
                        </div>
                      ))}
                      {rOv.map((r: any) => (
                        <div key={`ro-${r.id}`} className="text-xs p-2 rounded bg-warning/10 border border-warning/30">
                          <div className="font-medium text-warning">🍽 {REPAS_LABELS[r.repas as RepasType]} <span className="text-[10px] text-muted-foreground">(extra)</span></div>
                          {isAdmin && <div className="text-muted-foreground truncate">{r.profiles?.full_name}</div>}
                          {isAdmin && (
                            <button onClick={() => removeOverrideResto(r.id)} className="text-destructive text-[10px] hover:underline">Suppr.</button>
                          )}
                        </div>
                      ))}
                      {empty && <div className="text-xs text-muted-foreground italic">—</div>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          
          <Card className="mt-6 border-primary/20 bg-primary-soft/30 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-primary flex items-center justify-between">
                <span>Permanence du Week-end</span>
                {isAdmin && !weekendPerm && (
                  <div className="flex items-center gap-2 text-sm font-normal">
                    <Select onValueChange={assignWeekendPerm}>
                      <SelectTrigger className="w-[200px] h-8 bg-background">
                        <SelectValue placeholder="Assigner un surveillant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {surveillants.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardTitle>
              <CardDescription>Samedi 15h30–19h00 • Dimanche 08h00–12h00 / 14h00–19h00</CardDescription>
            </CardHeader>
            <CardContent>
              {weekendPerm ? (
                <div className="flex items-center justify-between bg-background p-3 rounded-md border">
                  <div className="font-medium flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                    {weekendPerm.full_name || "Surveillant assigné"}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="text-destructive h-8 px-2" onClick={() => removeWeekendPerm(weekendPerm.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Retirer
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic py-2">
                  Aucun surveillant n'est assigné pour ce week-end.
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground mt-4">
            <Repeat className="h-3 w-3 inline mr-1" />
            Récurrent (planning hebdomadaire) — modifié dans l'onglet « Planning récurrent ».
          </p>
        </TabsContent>

        {/* ---------- TEMPLATE EDITOR (admin) ---------- */}
        {isAdmin && (
          <TabsContent value="template" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Permanences hebdomadaires</CardTitle>
                    <CardDescription>Ce planning s'applique chaque semaine, toute l'année.</CardDescription>
                  </div>
                  <Dialog open={openP} onOpenChange={setOpenP}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Permanence</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Nouvelle permanence récurrente</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Surveillant</Label>
                          <Select value={pForm.surveillant_id} onValueChange={(v) => setPForm({ ...pForm, surveillant_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                            <SelectContent>
                              {surveillants.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Jour</Label>
                            <Select value={pForm.weekday} onValueChange={(v) => setPForm({ ...pForm, weekday: v as Weekday })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WEEKDAYS_ORDER.map((d) => <SelectItem key={d} value={d}>{WEEKDAY_LABELS[d]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Créneau</Label>
                            <Select value={pForm.slot} onValueChange={(v) => setPForm({ ...pForm, slot: v as PermanenceSlot })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(SLOT_LABELS) as PermanenceSlot[]).map((s) => (
                                  <SelectItem key={s} value={s}>{SLOT_LABELS[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea rows={2} value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenP(false)}>Annuler</Button>
                        <Button onClick={addTplPerm}>Ajouter</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                  {WEEKDAYS_ORDER.map((wd) => {
                    const items = tplPerms.filter((t) => t.weekday === wd);
                    return (
                      <div key={wd} className="border rounded-lg p-2 min-h-[120px]">
                        <div className="text-xs font-semibold mb-2">{WEEKDAY_LABELS[wd]}</div>
                        {items.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic">—</div>
                        ) : (
                          <ul className="space-y-1.5">
                            {items.map((it) => (
                              <li key={it.id} className="text-xs p-1.5 rounded bg-primary-soft">
                                <div className="font-medium text-primary">{SLOT_LABELS[it.slot].split(" (")[0]}</div>
                                <div className="text-muted-foreground truncate">{it.full_name}</div>
                                <button onClick={() => removeTplPerm(it.id)} className="text-destructive text-[10px] hover:underline">
                                  <Trash2 className="h-2.5 w-2.5 inline" /> Retirer
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Restaurant — services hebdomadaires</CardTitle>
                    <CardDescription>Ce planning s'applique chaque semaine, toute l'année.</CardDescription>
                  </div>
                  <Dialog open={openR} onOpenChange={setOpenR}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Service</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Nouveau service récurrent</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Surveillant</Label>
                          <Select value={rForm.surveillant_id} onValueChange={(v) => setRForm({ ...rForm, surveillant_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                            <SelectContent>
                              {surveillants.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Jour</Label>
                            <Select value={rForm.weekday} onValueChange={(v) => setRForm({ ...rForm, weekday: v as Weekday })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WEEKDAYS_ORDER.map((d) => <SelectItem key={d} value={d}>{WEEKDAY_LABELS[d]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Repas</Label>
                            <Select value={rForm.repas} onValueChange={(v) => setRForm({ ...rForm, repas: v as RepasType })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(REPAS_LABELS) as RepasType[]).map((s) => (
                                  <SelectItem key={s} value={s}>{REPAS_LABELS[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenR(false)}>Annuler</Button>
                        <Button onClick={addTplResto}>Ajouter</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                  {WEEKDAYS_ORDER.map((wd) => {
                    const items = tplRestos.filter((t) => t.weekday === wd);
                    return (
                      <div key={wd} className="border rounded-lg p-2 min-h-[120px]">
                        <div className="text-xs font-semibold mb-2">{WEEKDAY_LABELS[wd]}</div>
                        {items.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic">—</div>
                        ) : (
                          <ul className="space-y-1.5">
                            {items.map((it) => (
                              <li key={it.id} className="text-xs p-1.5 rounded bg-warning-soft">
                                <div className="font-medium text-warning">🍽 {REPAS_LABELS[it.repas]}</div>
                                <div className="text-muted-foreground truncate">{it.full_name}</div>
                                <button onClick={() => removeTplResto(it.id)} className="text-destructive text-[10px] hover:underline">
                                  <Trash2 className="h-2.5 w-2.5 inline" /> Retirer
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
