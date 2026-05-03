import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Trash2, FileDown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { ReclamationStatus, ReclamationPriority, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { generateTablePdf } from "@/lib/pdf";

export default function Reclamations() {
  const { user, primaryRole } = useAuth();
  const canEditStatus = primaryRole === "ADMIN" || primaryRole === "TECHNICIEN";
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [dortoirs, setDortoirs] = useState<{ id: string; code: string }[]>([]);
  const [tab, setTab] = useState<ReclamationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    description: "",
    lieu: "",
    dortoir_id: "",
    priority: "NORMALE" as ReclamationPriority,
    type: "Autre",
  });
  
  const [openExport, setOpenExport] = useState(false);
  const RECLAMATION_TYPES = ["Électricité", "Plomberie", "Menuiserie", "Autre"];
  const [exportTypes, setExportTypes] = useState<Set<string>>(new Set(RECLAMATION_TYPES));

  const load = async () => {
    setLoading(true);
    const [r, d] = await Promise.all([
      supabase.from("reclamations").select("*, dortoirs(code)").order("created_at", { ascending: false }),
      supabase.from("dortoirs").select("id, code").order("code"),
    ]);
    const reclamations = r.data ?? [];
    const creatorIds = Array.from(new Set(reclamations.map((x: any) => x.created_by).filter(Boolean)));
    let nameById: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", creatorIds);
      nameById = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
    }
    setItems(reclamations.map((x: any) => ({ ...x, creator: { full_name: nameById[x.created_by] ?? "—" } })));
    setDortoirs(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user || !form.titre.trim()) { toast.error("Titre requis"); return; }
    const finalDortoirId = (form.dortoir_id === "none" || form.dortoir_id === "autre" || !form.dortoir_id) ? null : form.dortoir_id;
    const finalLieu = form.dortoir_id === "autre" ? "Autre.." : null;
    const { error } = await supabase.from("reclamations").insert({
      titre: form.titre,
      description: form.description || null,
      lieu: finalLieu,
      dortoir_id: finalDortoirId,
      priority: form.priority,
      type: form.type,
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    
    if (form.priority === "HAUTE") {
      await supabase.from("notifications").insert([
        { role: "ADMIN", title: "🚨 Réclamation Urgente", message: `${form.type} - ${form.titre}`, link: "/reclamations" },
        { role: "TECHNICIEN", title: "🚨 Réclamation Urgente", message: `${form.type} - ${form.titre}`, link: "/reclamations" }
      ]);
    }

    toast.success("Réclamation créée");
    await supabase.from("activity_logs").insert({
      user_id: user.id, action: "Créé réclamation", entity: "reclamations",
    });
    setOpenCreate(false);
    setForm({ titre: "", description: "", lieu: "", dortoir_id: "", priority: "NORMALE", type: "Autre" });
    load();
  };

  const updateStatus = async (id: string, status: ReclamationStatus) => {
    const payload: any = { status };
    if (status === "TERMINEE") payload.resolved_at = new Date().toISOString();
    else payload.resolved_at = null;
    const { error } = await supabase.from("reclamations").update(payload).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Statut mis à jour");
    await supabase.from("activity_logs").insert({
      user_id: user?.id ?? null, action: `Statut → ${STATUS_LABELS[status]}`, entity: "reclamations", entity_id: id,
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette réclamation ?")) return;
    const { error } = await supabase.from("reclamations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimée");
    load();
  };

  const filtered = items.filter((r) => {
    if (tab !== "ALL" && r.status !== tab) return false;
    if (search && !`${r.titre} ${r.description ?? ""} ${r.lieu ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportTodayPdf = () => {
    if (exportTypes.size === 0) {
      toast.error("Veuillez sélectionner au moins un type.");
      return;
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const todayItems = items.filter((r) => r.created_at.startsWith(today) && exportTypes.has(r.type || "Autre"));
    const pendingItems = items.filter((r) => r.status !== "TERMINEE" && exportTypes.has(r.type || "Autre"));

    const buildRows = (rows: any[]) => rows.map((r) => [
      r.type || "Autre",
      r.titre,
      r.description || "—",
      r.dortoirs?.code ? r.dortoirs.code : (r.lieu || "—"),
      PRIORITY_LABELS[r.priority as ReclamationPriority],
      r.creator?.full_name ?? "—",
    ]);

    generateTablePdf({
      title: "Réclamations",
      subtitle: `Filtres: ${Array.from(exportTypes).join(", ")} | Du jour (${todayItems.length}) + non terminées (${pendingItems.length}) — ${format(new Date(), "d MMMM yyyy", { locale: fr })}`,
      filename: `reclamations_${today}.pdf`,
      head: ["Type", "Réclamation", "Description", "N° du dortoir", "Priorité", "Auteur"],
      rows: [
        ...(todayItems.length ? [["— RÉCLAMATIONS DU JOUR —", "", "", "", "", ""]] : []),
        ...buildRows(todayItems),
        ...(pendingItems.length ? [["— NON TERMINÉES —", "", "", "", "", ""]] : []),
        ...buildRows(pendingItems),
      ],
    });
    toast.success("PDF généré");
    setOpenExport(false);
  };

  const toggleExportType = (t: string) => {
    const newTypes = new Set(exportTypes);
    if (newTypes.has(t)) newTypes.delete(t);
    else newTypes.add(t);
    setExportTypes(newTypes);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Réclamations</h1>
          <p className="text-muted-foreground mt-1">Suivi et résolution des incidents</p>
        </div>
        <div className="flex gap-2">
          {(isAdmin || canEditStatus) && (
            <Dialog open={openExport} onOpenChange={setOpenExport}>
              <DialogTrigger asChild>
                <Button variant="outline"><FileDown className="h-4 w-4 mr-1" /> Exporter PDF</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Exporter les réclamations</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <Label>Filtrer par type</Label>
                  <div className="space-y-2">
                    {RECLAMATION_TYPES.map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <Checkbox 
                          id={`exp-${t}`} 
                          checked={exportTypes.has(t)} 
                          onCheckedChange={() => toggleExportType(t)} 
                        />
                        <Label htmlFor={`exp-${t}`} className="cursor-pointer">{t}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenExport(false)}>Annuler</Button>
                  <Button onClick={exportTodayPdf}>Générer PDF</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nouvelle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle réclamation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Réclamation *</Label>
                  <Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex : Robinet cassé" />
                </div>
                <div className="space-y-2">
                  <Label>Type de réclamation</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECLAMATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description (optionnelle)</Label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>N° du dortoir</Label>
                    <Select value={form.dortoir_id || "none"} onValueChange={(v) => setForm({ ...form, dortoir_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {dortoirs.map((d) => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}
                        <SelectItem value="autre">Autre..</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as ReclamationPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PRIORITY_LABELS) as ReclamationPriority[]).map((p) => (
                          <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCreate(false)}>Annuler</Button>
                <Button onClick={create}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="ALL">Toutes</TabsTrigger>
          <TabsTrigger value="EN_ATTENTE">En attente</TabsTrigger>
          <TabsTrigger value="EN_COURS">En cours</TabsTrigger>
          <TabsTrigger value="TERMINEE">Terminées</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune réclamation.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <Card key={r.id}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold">{r.titre}</h3>
                          <Badge variant="outline">{r.type || "Autre"}</Badge>
                          <StatusBadge status={r.status} />
                          <PriorityBadge priority={r.priority} />
                        </div>
                        {r.description && <p className="text-sm text-muted-foreground mb-2">{r.description}</p>}
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          {r.lieu && <span>📍 {r.lieu}</span>}
                          {r.dortoirs?.code && <span>🛏 Dortoir {r.dortoirs.code}</span>}
                          <span>👤 {r.creator?.full_name ?? "—"}</span>
                          <span>🕐 {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {canEditStatus && (
                          <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as ReclamationStatus)}>
                            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_LABELS) as ReclamationStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
