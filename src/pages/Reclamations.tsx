import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Search, Trash2, FileDown, Pencil, AlertTriangle,
  MapPin, User, Clock, Wrench, Zap, Droplets, Hammer
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { ReclamationStatus, ReclamationPriority, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { ReclamationAge } from "@/components/ReclamationAge";
import { generateTablePdf } from "@/lib/pdf";
import { ageLabel } from "@/lib/time";

const RECLAMATION_TYPES = ["Électricité", "Plomberie", "Menuiserie", "Autre"];
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

const localDay = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");

const TypeIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case "Électricité": return <Zap className={className} />;
    case "Plomberie": return <Droplets className={className} />;
    case "Menuiserie": return <Hammer className={className} />;
    default: return <Wrench className={className} />;
  }
};
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
    if (r.error) { setLoadError(r.error.message); setItems([]); setDortoirs(d.data ?? []); setLoading(false); return; }
    const reclamations = r.data ?? [];
    const creatorIds = Array.from(new Set(reclamations.map((x: any) => x.created_by).filter(Boolean)));
    let nameById: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", creatorIds);
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
    if (form.dortoir_id === OTHER_LIEU && !form.lieu.trim()) { toast.error("Précisez l'emplacement."); return; }
    const isOther = form.dortoir_id === OTHER_LIEU;
    const payload = {
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      lieu: isOther ? form.lieu.trim() : null,
      dortoir_id: isOther || form.dortoir_id === NO_DORTOIR ? null : form.dortoir_id,
      priority: form.priority,
      type: form.type,
    };
    setSaving(true);
    try {
      if (editingId) {
        const { data, error } = await supabase.from("reclamations").update(payload).eq("id", editingId).select("id");
        if (error) { toast.error(error.message); return; }
        if (!data || data.length === 0) { toast.error("Modification refusée : droits insuffisants."); return; }
        toast.success("Réclamation mise à jour");
        await supabase.from("activity_logs").insert({ user_id: user.id, action: "Modifié réclamation", entity: "reclamations", entity_id: editingId });
      } else {
        const { data, error } = await supabase.from("reclamations").insert({ ...payload, created_by: user.id }).select("id").single();
        if (error) { toast.error(error.message); return; }
        if (form.priority === "HAUTE") {
          await supabase.from("notifications").insert([
            { role: "ADMIN", title: "🚨 Réclamation Urgente", message: `${form.type} - ${payload.titre}`, link: "/reclamations" },
            { role: "TECHNICIEN", title: "🚨 Réclamation Urgente", message: `${form.type} - ${payload.titre}`, link: "/reclamations" },
          ]);
        }
        toast.success("Réclamation créée");
        await supabase.from("activity_logs").insert({ user_id: user.id, action: "Créé réclamation", entity: "reclamations", entity_id: data?.id ?? null });
      }
      setOpenCreate(false); setEditingId(null); setForm(emptyForm); load();
    } finally { setSaving(false); }
  };

  const openNew = () => { setEditingId(null); setForm(emptyForm); setOpenCreate(true); };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({ titre: r.titre ?? "", description: r.description || "", lieu: r.lieu || "", dortoir_id: r.dortoir_id ? r.dortoir_id : (r.lieu ? OTHER_LIEU : NO_DORTOIR), priority: (r.priority ?? "NORMALE") as ReclamationPriority, type: r.type || "Autre" });
    setOpenCreate(true);
  };

  const updateStatus = async (r: any, status: ReclamationStatus) => {
    if (r.status === status) return;
    const payload: any = { status, resolved_at: status === "TERMINEE" ? new Date().toISOString() : null };
    const { data, error } = await supabase.from("reclamations").update(payload).eq("id", r.id).select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("Changement refusé : droits insuffisants."); return; }
    toast.success(`Statut → ${STATUS_LABELS[status]}`);
    if (r.created_by && r.created_by !== user?.id) {
      await supabase.from("notifications").insert({ user_id: r.created_by, title: "Réclamation mise à jour", message: `${r.titre} → ${STATUS_LABELS[status]}`, link: "/reclamations" });
    }
    await supabase.from("activity_logs").insert({ user_id: user?.id ?? null, action: `Statut → ${STATUS_LABELS[status]}`, entity: "reclamations", entity_id: r.id });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette réclamation ?")) return;
    const { data, error } = await supabase.from("reclamations").delete().eq("id", id).select("id");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("Suppression refusée : droits insuffisants."); return; }
    toast.success("Supprimée"); load();
  };

  const matchesSearch = (r: any) => {
    if (!search.trim()) return true;
    const haystack = [r.titre, r.description, r.lieu, r.type, r.dortoirs?.code, r.creator?.full_name].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  };

  const visible = items.filter((r) => { if (typeFilter !== "ALL" && (r.type || "Autre") !== typeFilter) return false; return matchesSearch(r); });
  const filtered = visible.filter((r) => tab === "ALL" || r.status === tab);
  const countFor = (s: ReclamationStatus | "ALL") => s === "ALL" ? visible.length : visible.filter((r) => r.status === s).length;

  const exportTodayPdf = () => {
    if (exportTypes.size === 0) { toast.error("Sélectionnez au moins un type."); return; }
    const today = localDay(new Date());
    const selected = items.filter((r) => exportTypes.has(r.type || "Autre"));
    const todayItems = selected.filter((r) => localDay(r.created_at) === today);
    const todayIds = new Set(todayItems.map((r) => r.id));
    const pendingItems = selected.filter((r) => r.status !== "TERMINEE" && !todayIds.has(r.id));
    if (todayItems.length === 0 && pendingItems.length === 0) { toast.error("Aucune réclamation à exporter."); return; }
    const buildRows = (rows: any[]) => rows.map((r) => [r.type || "Autre", r.titre, r.description || "—", r.dortoirs?.code ? r.dortoirs.code : (r.lieu || "—"), PRIORITY_LABELS[r.priority as ReclamationPriority] ?? "—", STATUS_LABELS[r.status as ReclamationStatus] ?? "—", r.status === "TERMINEE" ? "—" : ageLabel(r.created_at), r.creator?.full_name ?? "—"]);
    generateTablePdf({ orientation: "landscape", title: "Réclamations", subtitle: `Filtres: ${Array.from(exportTypes).join(", ")} | ${format(new Date(), "d MMMM yyyy", { locale: fr })}`, filename: `reclamations_${today}.pdf`, head: ["Type", "Réclamation", "Description", "Dortoir", "Priorité", "Statut", "Ancienneté", "Auteur"], rows: [...(todayItems.length ? [["— DU JOUR —", "", "", "", "", "", "", ""]] : []), ...buildRows(todayItems), ...(pendingItems.length ? [["— NON TERMINÉES —", "", "", "", "", "", "", ""]] : []), ...buildRows(pendingItems)] });
    toast.success("PDF généré"); setOpenExport(false);
  };

  const toggleExportType = (t: string) => { const n = new Set(exportTypes); if (n.has(t)) n.delete(t); else n.add(t); setExportTypes(n); };

  // Tab config
  const tabs: { value: ReclamationStatus | "ALL"; label: string }[] = [
    { value: "ALL", label: "Toutes" },
    { value: "EN_ATTENTE", label: "En attente" },
    { value: "EN_COURS", label: "En cours" },
    { value: "TERMINEE", label: "Terminées" },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Réclamations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Suivi et résolution des incidents</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEditStatus && (
            <Dialog open={openExport} onOpenChange={setOpenExport}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><FileDown className="h-4 w-4 mr-1.5" />PDF</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Exporter en PDF</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <Label className="text-sm text-muted-foreground">Filtrer par type</Label>
                  <div className="space-y-2">
                    {RECLAMATION_TYPES.map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <Checkbox id={`exp-${t}`} checked={exportTypes.has(t)} onCheckedChange={() => toggleExportType(t)} />
                        <Label htmlFor={`exp-${t}`} className="cursor-pointer font-normal">{t}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenExport(false)}>Annuler</Button>
                  <Button onClick={exportTodayPdf}>Générer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={openCreate} onOpenChange={(val) => { setOpenCreate(val); if (!val) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Nouvelle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Modifier" : "Nouvelle réclamation"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Réclamation *</Label>
                  <Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex : Robinet cassé" />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RECLAMATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground font-normal">(optionnelle)</span></Label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Détails supplémentaires…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Dortoir</Label>
                    <Select value={form.dortoir_id} onValueChange={(v) => setForm({ ...form, dortoir_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DORTOIR}>Aucun</SelectItem>
                        {dortoirs.map((d) => <SelectItem key={d.id} value={d.id}>{d.code}</SelectItem>)}
                        <SelectItem value={OTHER_LIEU}>Autre lieu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priorité</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as ReclamationPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(PRIORITY_LABELS) as ReclamationPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {form.dortoir_id === OTHER_LIEU && (
                  <div className="space-y-1.5">
                    <Label>Emplacement *</Label>
                    <Input value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} placeholder="Ex : Couloir bloc B" />
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-[170px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem>
            {RECLAMATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
              tab === t.value
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.value ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {countFor(t.value)}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <AlertTriangle className="h-6 w-6 mx-auto text-destructive" />
          <p className="font-medium text-sm">Impossible de charger les réclamations.</p>
          <p className="text-xs text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>Réessayer</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Aucune réclamation.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm ${r.priority === "HAUTE" && r.status !== "TERMINEE" ? "border-destructive/30" : "border-border/60"}`}
            >
              {/* Top row: title + badges */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-0.5 shrink-0 bg-muted/50 p-2 rounded-md">
                    <TypeIcon type={r.type} className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm leading-tight">{r.titre}</div>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={r.status} />
                  <span className="text-muted-foreground/40 text-[10px]">•</span>
                  <PriorityBadge priority={r.priority} />
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                {(r.dortoirs?.code || r.lieu) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {r.dortoirs?.code ? `Dortoir ${r.dortoirs.code}` : r.lieu}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 shrink-0" />
                  {r.creator?.full_name ?? "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                </span>
                {r.status !== "TERMINEE" && (
                  <ReclamationAge createdAt={r.created_at} status={r.status} resolvedAt={r.resolved_at} />
                )}
              </div>

              {/* Actions row */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-border/40">
                <Badge variant="outline" className="text-[11px] text-muted-foreground border-border">
                  <Wrench className="h-3 w-3 mr-1" />{r.type || "Autre"}
                </Badge>
                <div className="flex items-center gap-1">
                  {canEditStatus && (
                    <Select value={r.status} onValueChange={(v) => updateStatus(r, v as ReclamationStatus)}>
                      <SelectTrigger className="h-7 w-[130px] text-xs border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as ReclamationStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {(isAdmin || r.created_by === user?.id) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  {(isAdmin || r.created_by === user?.id) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
