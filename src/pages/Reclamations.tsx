import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Trash2, FileDown, Pencil, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { ReclamationStatus, ReclamationPriority, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { generateTablePdf } from "@/lib/pdf";

const RECLAMATION_TYPES = ["Électricité", "Plomberie", "Menuiserie", "Autre"];

/** Sentinelles du Select "N° du dortoir" (Radix interdit la valeur ""). */
const NO_DORTOIR = "none";
const OTHER_LIEU = "autre";

const emptyForm = {
  titre: "",
  description: "",
  lieu: "",
  dortoir_id: NO_DORTOIR,
  priority: "NORMALE" as ReclamationPriority,
  type: "Autre",
};

/** Date locale au format yyyy-MM-dd (created_at est en UTC : on ne peut pas
 *  comparer les chaînes ISO directement sans décaler d'un jour). */
const localDay = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");

export default function Reclamations() {
  const { user, primaryRole } = useAuth();
  const canEditStatus = primaryRole === "ADMIN" || primaryRole === "TECHNICIEN" || primaryRole === "SURVEILLANT";
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [dortoirs, setDortoirs] = useState<{ id: string; code: string }[]>([]);
  const [tab, setTab] = useState<ReclamationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [openExport, setOpenExport] = useState(false);
  const [exportTypes, setExportTypes] = useState<Set<string>>(new Set(RECLAMATION_TYPES));

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const [r, d] = await Promise.all([
      supabase.from("reclamations").select("*, dortoirs(code)").order("created_at", { ascending: false }),
      supabase.from("dortoirs").select("id, code").order("code"),
    ]);

    if (r.error) {
      setLoadError(r.error.message);
      setItems([]);
      setDortoirs(d.data ?? []);
      setLoading(false);
      return;
    }

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

  const save = async () => {
    if (!user) { toast.error("Session expirée, reconnectez-vous."); return; }
    if (!form.titre.trim()) { toast.error("Le champ « Réclamation » est requis."); return; }
    if (form.dortoir_id === OTHER_LIEU && !form.lieu.trim()) {
      toast.error("Précisez l'emplacement.");
      return;
    }

    const isOther = form.dortoir_id === OTHER_LIEU;
    const payload = {
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      // "Autre.." => emplacement libre saisi par l'utilisateur
      lieu: isOther ? form.lieu.trim() : null,
      dortoir_id: isOther || form.dortoir_id === NO_DORTOIR ? null : form.dortoir_id,
      priority: form.priority,
      type: form.type,
    };

    setSaving(true);
    try {
      if (editingId) {
        // .select() : sans cela une UPDATE bloquée par la RLS renvoie
        // "succès" avec 0 ligne et l'utilisateur ne voit aucune erreur.
        const { data, error } = await supabase
          .from("reclamations").update(payload).eq("id", editingId).select("id");
        if (error) { toast.error(error.message); return; }
        if (!data || data.length === 0) {
          toast.error("Modification refusée : vous n'avez pas les droits sur cette réclamation.");
          return;
        }
        toast.success("Réclamation mise à jour");
        await supabase.from("activity_logs").insert({
          user_id: user.id, action: "Modifié réclamation", entity: "reclamations", entity_id: editingId,
        });
      } else {
        const { data, error } = await supabase
          .from("reclamations").insert({ ...payload, created_by: user.id }).select("id").single();
        if (error) { toast.error(error.message); return; }

        if (form.priority === "HAUTE") {
          await supabase.from("notifications").insert([
            { role: "ADMIN", title: "🚨 Réclamation Urgente", message: `${form.type} - ${payload.titre}`, link: "/reclamations" },
            { role: "TECHNICIEN", title: "🚨 Réclamation Urgente", message: `${form.type} - ${payload.titre}`, link: "/reclamations" },
          ]);
        }
        toast.success("Réclamation créée");
        await supabase.from("activity_logs").insert({
          user_id: user.id, action: "Créé réclamation", entity: "reclamations", entity_id: data?.id ?? null,
        });
      }

      setOpenCreate(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpenCreate(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      titre: r.titre ?? "",
      description: r.description || "",
      lieu: r.lieu || "",
      // Un lieu libre sans dortoir => le Select doit revenir sur "Autre..",
      // sinon la valeur saisie est effacée à l'enregistrement.
      dortoir_id: r.dortoir_id ? r.dortoir_id : (r.lieu ? OTHER_LIEU : NO_DORTOIR),
      priority: (r.priority ?? "NORMALE") as ReclamationPriority,
      type: r.type || "Autre",
    });
    setOpenCreate(true);
  };

  const updateStatus = async (r: any, status: ReclamationStatus) => {
    if (r.status === status) return;
    const payload: any = { status };
    payload.resolved_at = status === "TERMINEE" ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from("reclamations").update(payload).eq("id", r.id).select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Changement refusé : droits insuffisants sur cette réclamation.");
      return;
    }

    toast.success(`Statut → ${STATUS_LABELS[status]}`);

    // Prévenir l'auteur du suivi de sa réclamation.
    if (r.created_by && r.created_by !== user?.id) {
      await supabase.from("notifications").insert({
        user_id: r.created_by,
        title: "Réclamation mise à jour",
        message: `${r.titre} → ${STATUS_LABELS[status]}`,
        link: "/reclamations",
      });
    }

    await supabase.from("activity_logs").insert({
      user_id: user?.id ?? null, action: `Statut → ${STATUS_LABELS[status]}`, entity: "reclamations", entity_id: r.id,
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette réclamation ?")) return;
    const { data, error } = await supabase
      .from("reclamations").delete().eq("id", id).select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Suppression refusée : droits insuffisants.");
      return;
    }
    toast.success("Supprimée");
    load();
  };

  const matchesSearch = (r: any) => {
    if (!search.trim()) return true;
    const haystack = [
      r.titre, r.description, r.lieu, r.type,
      r.dortoirs?.code, r.creator?.full_name,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  };

  const visible = items.filter((r) => {
    if (typeFilter !== "ALL" && (r.type || "Autre") !== typeFilter) return false;
    return matchesSearch(r);
  });

  const filtered = visible.filter((r) => tab === "ALL" || r.status === tab);

  const countFor = (s: ReclamationStatus | "ALL") =>
    s === "ALL" ? visible.length : visible.filter((r) => r.status === s).length;

  const exportTodayPdf = () => {
    if (exportTypes.size === 0) {
      toast.error("Veuillez sélectionner au moins un type.");
      return;
    }

    const today = localDay(new Date());
    const selected = items.filter((r) => exportTypes.has(r.type || "Autre"));
    const todayItems = selected.filter((r) => localDay(r.created_at) === today);
    const todayIds = new Set(todayItems.map((r) => r.id));
    // Sans ce filtre, une réclamation créée aujourd'hui et non terminée
    // apparaissait deux fois dans le PDF.
    const pendingItems = selected.filter((r) => r.status !== "TERMINEE" && !todayIds.has(r.id));

    if (todayItems.length === 0 && pendingItems.length === 0) {
      toast.error("Aucune réclamation à exporter pour ces types.");
      return;
    }

    const buildRows = (rows: any[]) => rows.map((r) => [
      r.type || "Autre",
      r.titre,
      r.description || "—",
      r.dortoirs?.code ? r.dortoirs.code : (r.lieu || "—"),
      PRIORITY_LABELS[r.priority as ReclamationPriority] ?? "—",
      STATUS_LABELS[r.status as ReclamationStatus] ?? "—",
      r.creator?.full_name ?? "—",
    ]);

    generateTablePdf({
      // 7 colonnes : illisible en portrait
      orientation: "landscape",
      title: "Réclamations",
      subtitle: `Filtres: ${Array.from(exportTypes).join(", ")} | Du jour (${todayItems.length}) + non terminées (${pendingItems.length}) — ${format(new Date(), "d MMMM yyyy", { locale: fr })}`,
      filename: `reclamations_${today}.pdf`,
      head: ["Type", "Réclamation", "Description", "N° du dortoir", "Priorité", "Statut", "Auteur"],
      rows: [
        ...(todayItems.length ? [["— RÉCLAMATIONS DU JOUR —", "", "", "", "", "", ""]] : []),
        ...buildRows(todayItems),
        ...(pendingItems.length ? [["— NON TERMINÉES —", "", "", "", "", "", ""]] : []),
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
          {canEditStatus && (
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
          <Dialog open={openCreate} onOpenChange={(val) => { setOpenCreate(val); if (!val) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nouvelle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Modifier réclamation" : "Nouvelle réclamation"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Réclamation *</Label>
                  <Input
                    value={form.titre}
                    onChange={(e) => setForm({ ...form, titre: e.target.value })}
                    placeholder="Ex : Robinet cassé"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type de réclamation</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECLAMATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                    <Select value={form.dortoir_id} onValueChange={(v) => setForm({ ...form, dortoir_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DORTOIR}>Aucun</SelectItem>
                        {dortoirs.map((d) => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}
                        <SelectItem value={OTHER_LIEU}>Autre..</SelectItem>
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
                {form.dortoir_id === OTHER_LIEU && (
                  <div className="space-y-2">
                    <Label>Emplacement *</Label>
                    <Input
                      value={form.lieu}
                      onChange={(e) => setForm({ ...form, lieu: e.target.value })}
                      placeholder="Ex : Couloir bloc B, 2ème étage"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpenCreate(false); setEditingId(null); }}>Annuler</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editingId ? "Enregistrer" : "Créer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher (titre, description, lieu, type, auteur)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem>
            {RECLAMATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="ALL">Toutes ({countFor("ALL")})</TabsTrigger>
          <TabsTrigger value="EN_ATTENTE">En attente ({countFor("EN_ATTENTE")})</TabsTrigger>
          <TabsTrigger value="EN_COURS">En cours ({countFor("EN_COURS")})</TabsTrigger>
          <TabsTrigger value="TERMINEE">Terminées ({countFor("TERMINEE")})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : loadError ? (
            <Card>
              <CardContent className="py-8 text-center space-y-3">
                <AlertTriangle className="h-6 w-6 mx-auto text-destructive" />
                <p className="font-medium">Impossible de charger les réclamations.</p>
                <p className="text-sm text-muted-foreground">{loadError}</p>
                <Button variant="outline" size="sm" onClick={load}>Réessayer</Button>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune réclamation.</CardContent></Card>
          ) : (
            <div className="rounded-md border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réclamation</TableHead>
                    <TableHead>Emplacement</TableHead>
                    <TableHead>Auteur &amp; Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{r.titre}</span>
                            <Badge variant="outline">{r.type || "Autre"}</Badge>
                          </div>
                          {r.description && <span className="text-sm text-muted-foreground">{r.description}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground gap-0.5 whitespace-nowrap">
                          {r.dortoirs?.code ? <span>🛏 Dortoir {r.dortoirs.code}</span> : null}
                          {r.lieu ? <span>📍 {r.lieu}</span> : null}
                          {(!r.dortoirs?.code && !r.lieu) && <span>—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm text-muted-foreground gap-0.5 whitespace-nowrap">
                          <span>👤 {r.creator?.full_name ?? "—"}</span>
                          <span>🕐 {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={r.priority} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditStatus && (
                            <Select value={r.status} onValueChange={(v) => updateStatus(r, v as ReclamationStatus)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(STATUS_LABELS) as ReclamationStatus[]).map((s) => (
                                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {(isAdmin || r.created_by === user?.id) && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Modifier" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          {(isAdmin || r.created_by === user?.id) && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Supprimer" onClick={() => remove(r.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
