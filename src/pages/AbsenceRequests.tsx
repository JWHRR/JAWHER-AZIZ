import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAbsenceRequests } from "@/hooks/useAbsenceRequests";
import {
  AbsenceRequest, DelegatedTask,
  AbsenceStatus, TaskPriority, TaskStatus,
  ABSENCE_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS,
} from "@/lib/types";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge }    from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Plus, Trash2, CheckCircle2, Clock, XCircle,
  CalendarDays, User, RefreshCw, ChevronDown, ClipboardList,
  AlertTriangle, ArrowRight, Briefcase, Circle,
} from "lucide-react";

// ── Status / Priority badges ─────────────────────────────────────────────────

function AbsenceStatusBadge({ status }: { status: AbsenceStatus }) {
  const cfg: Record<AbsenceStatus, { cls: string; icon: React.ReactNode }> = {
    PENDING:  { cls: "bg-amber-100 text-amber-700 border-amber-200",   icon: <Clock className="h-3 w-3" /> },
    APPROVED: { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    REJECTED: { cls: "bg-red-100 text-red-700 border-red-200",         icon: <XCircle className="h-3 w-3" /> },
  };
  const { cls, icon } = cfg[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", cls)}>
      {icon}{ABSENCE_STATUS_LABELS[status]}
    </span>
  );
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const cfg: Record<TaskStatus, string> = {
    PENDING:     "bg-slate-100 text-slate-600 border-slate-200",
    IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
    COMPLETED:   "bg-emerald-100 text-emerald-700 border-emerald-200",
    CANCELLED:   "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", cfg[status])}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg: Record<TaskPriority, string> = {
    LOW:    "bg-slate-100 text-slate-500",
    NORMAL: "bg-blue-100 text-blue-600",
    HIGH:   "bg-rose-100 text-rose-600",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg[priority])}>
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string;
}) {
  return (
    <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-black mt-1">{value}</p>
          </div>
          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", color)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Duration helper ──────────────────────────────────────────────────────────
function duration(start: string, end: string) {
  const d = differenceInDays(parseISO(end), parseISO(start)) + 1;
  return `${d} jour${d > 1 ? "s" : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SURVEILLANT VIEW
// ─────────────────────────────────────────────────────────────────────────────

function SurveillantView() {
  const {
    myRequests, myDelegatedTasks, surveillants, loading,
    createRequest, deleteRequest, completeTask, startTask,
  } = useAbsenceRequests();

  const [openCreate, setOpenCreate] = useState(false);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const emptyForm = { reason: "", description: "", start_date: "", end_date: "", replacement_id: "" };
  const [form, setForm] = useState(emptyForm);

  const handleCreate = async () => {
    if (!form.reason.trim() || !form.start_date || !form.end_date || !form.replacement_id) {
      toast.error("Remplissez tous les champs obligatoires (y compris le remplaçant)");
      return;
    }
    if (form.end_date < form.start_date) { toast.error("La date de fin doit être après la date de début"); return; }
    setSubmitting(true);
    const ok = await createRequest(form);
    setSubmitting(false);
    if (ok) { setOpenCreate(false); setForm(emptyForm); }
  };

  const pending  = myRequests.filter(r => r.status === "PENDING");
  const approved = myRequests.filter(r => r.status === "APPROVED");
  const rejected = myRequests.filter(r => r.status === "REJECTED");
  const activeTasks = myDelegatedTasks.filter(t => t.status !== "COMPLETED" && t.status !== "CANCELLED");

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demandes d'Absence</h1>
          <p className="text-muted-foreground mt-1">Gérez vos absences et délégations de tâches</p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Nouvelle demande
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={myRequests.length} icon={<ClipboardList className="h-5 w-5 text-white" />} color="bg-primary/80" />
        <StatCard label="En attente" value={pending.length} icon={<Clock className="h-5 w-5 text-white" />} color="bg-amber-400/90" />
        <StatCard label="Approuvées" value={approved.length} icon={<CheckCircle2 className="h-5 w-5 text-white" />} color="bg-emerald-500/80" />
        <StatCard label="Refusées" value={rejected.length} icon={<XCircle className="h-5 w-5 text-white" />} color="bg-rose-500/80" />
      </div>

      {/* Active delegated tasks alert */}
      {activeTasks.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-blue-500 shrink-0" />
            <span className="text-sm font-medium">
              Vous avez <strong>{activeTasks.length}</strong> tâche{activeTasks.length > 1 ? "s" : ""} déléguée{activeTasks.length > 1 ? "s" : ""} à accomplir.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="requests">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList className="h-3.5 w-3.5" /> Mes demandes
            {pending.length > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-amber-400 text-[10px] text-white font-bold flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <Briefcase className="h-3.5 w-3.5" /> Tâches assignées
            {activeTasks.length > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-blue-500 text-[10px] text-white font-bold flex items-center justify-center">
                {activeTasks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── my requests ── */}
        <TabsContent value="requests" className="mt-4">
          {myRequests.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-3">
                <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Aucune demande pour l'instant.</p>
                <Button variant="outline" onClick={() => setOpenCreate(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Créer une demande
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Motif</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Remplaçant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Note admin</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequests.map(r => (
                    <TableRow key={r.id} className="transition-colors hover:bg-muted/20">
                      <TableCell>
                        <div className="font-medium">{r.reason}</div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(parseISO(r.start_date), "dd MMM", { locale: fr })}
                        <ArrowRight className="inline h-3 w-3 mx-1" />
                        {format(parseISO(r.end_date), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{duration(r.start_date, r.end_date)}</TableCell>
                      <TableCell className="text-sm">
                        {r.replacement_name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><AbsenceStatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                        {r.admin_note ? (
                          <span className="italic line-clamp-2">{r.admin_note}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "PENDING" && (
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── delegated tasks ── */}
        <TabsContent value="tasks" className="mt-4">
          {myDelegatedTasks.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-2">
                <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Aucune tâche déléguée pour l'instant.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myDelegatedTasks.map(t => (
                <Card
                  key={t.id}
                  className={cn(
                    "transition-all hover:shadow-md border-l-4",
                    t.status === "COMPLETED" ? "border-l-emerald-400 opacity-70" :
                    t.priority === "HIGH"    ? "border-l-rose-400" :
                    t.priority === "NORMAL"  ? "border-l-blue-400" : "border-l-slate-300"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{t.title}</span>
                          <PriorityBadge priority={t.priority} />
                          <TaskStatusBadge status={t.status} />
                        </div>
                        {t.description && (
                          <p className="text-sm text-muted-foreground">{t.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {format(parseISO(t.task_date), "dd MMM yyyy", { locale: fr })}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Délégué par {t.original_name}
                          </span>
                          {t.absence_reason && (
                            <span className="italic">Absence : {t.absence_reason}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {t.status === "PENDING" && (
                          <Button size="sm" variant="outline" onClick={() => startTask(t.id)}>
                            Commencer
                          </Button>
                        )}
                        {(t.status === "PENDING" || t.status === "IN_PROGRESS") && (
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
                            onClick={() => completeTask(t.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Terminer
                          </Button>
                        )}
                        {t.status === "COMPLETED" && (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Fait
                          </span>
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

      {/* ── Create request dialog ── */}
      <Dialog open={openCreate} onOpenChange={v => { setOpenCreate(v); if (!v) setForm(emptyForm); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> Nouvelle demande d'absence
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Reason */}
            <div className="space-y-1.5">
              <Label>Motif <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex : Urgence familiale, Rendez-vous médical…"
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description détaillée</Label>
              <Textarea
                rows={3}
                placeholder="Précisez le contexte de votre absence…"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date de début <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>

            {/* Replacement — obligatoire */}
            <div className="space-y-1.5">
              <Label>Surveillant remplaçant <span className="text-destructive">*</span></Label>
              <Select value={form.replacement_id} onValueChange={v => setForm({ ...form, replacement_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un remplaçant" />
                </SelectTrigger>
                <SelectContent>
                  {surveillants.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info: tasks are transferred automatically on approval */}
            {form.replacement_id && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3 flex items-start gap-2 text-sm">
                <RefreshCw className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span className="text-blue-700 dark:text-blue-300">
                  Toutes vos permanences et responsabilités restaurant seront transférées automatiquement au remplaçant une fois la demande approuvée.
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenCreate(false); setForm(emptyForm); }}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La demande et ses tâches seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={async () => { if (deleteId) { await deleteRequest(deleteId); setDeleteId(null); } }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN VIEW
// ─────────────────────────────────────────────────────────────────────────────

function AdminView() {
  const { requests, loading, approveRequest, rejectRequest } = useAbsenceRequests();

  const [tab,        setTab]        = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [search,     setSearch]     = useState("");
  const [reviewId,   setReviewId]   = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject">("approve");
  const [adminNote,  setAdminNote]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending  = requests.filter(r => r.status === "PENDING");
  const approved = requests.filter(r => r.status === "APPROVED");
  const rejected = requests.filter(r => r.status === "REJECTED");

  const filtered = requests.filter(r => {
    if (tab !== "ALL" && r.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.reason.toLowerCase().includes(q) &&
        !(r.surveillant_name ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const handleReview = async () => {
    if (!reviewId) return;
    setSubmitting(true);
    if (reviewMode === "approve") await approveRequest(reviewId, adminNote);
    else                          await rejectRequest(reviewId, adminNote);
    setSubmitting(false);
    setReviewId(null);
    setAdminNote("");
  };

  const openReview = (id: string, mode: "approve" | "reject") => {
    setReviewId(id);
    setReviewMode(mode);
    setAdminNote("");
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  const reviewReq = requests.find(r => r.id === reviewId);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Demandes d'Absence</h1>
        <p className="text-muted-foreground mt-1">Gérez les absences des surveillants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="En attente" value={pending.length}  icon={<AlertTriangle className="h-5 w-5 text-white" />} color="bg-amber-400/90" />
        <StatCard label="Total"      value={requests.length} icon={<ClipboardList className="h-5 w-5 text-white" />} color="bg-primary/80"   />
        <StatCard label="Approuvées" value={approved.length} icon={<CheckCircle2  className="h-5 w-5 text-white" />} color="bg-emerald-500/80" />
        <StatCard label="Refusées"   value={rejected.length} icon={<XCircle       className="h-5 w-5 text-white" />} color="bg-rose-500/80"  />
      </div>

      {/* Pending highlight panel */}
      {pending.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {pending.length} demande{pending.length > 1 ? "s" : ""} en attente d'approbation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {pending.map(r => (
              <div
                key={r.id}
                className="rounded-lg border border-amber-200 bg-white dark:bg-card p-4 transition-all hover:shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.reason}</span>
                      <AbsenceStatusBadge status={r.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>{r.surveillant_name}</strong> •{" "}
                      {format(parseISO(r.start_date), "dd MMM", { locale: fr })} →{" "}
                      {format(parseISO(r.end_date), "dd MMM yyyy", { locale: fr })} •{" "}
                      <span className="font-medium">{duration(r.start_date, r.end_date)}</span>
                    </p>
                    {r.replacement_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Remplaçant : {r.replacement_name}
                        {r.delegated_tasks && r.delegated_tasks.length > 0 && (
                          <span className="ml-1">• {r.delegated_tasks.length} tâche{r.delegated_tasks.length > 1 ? "s" : ""} déléguée{r.delegated_tasks.length > 1 ? "s" : ""}</span>
                        )}
                      </p>
                    )}
                    {r.description && (
                      <p className="text-sm italic text-muted-foreground line-clamp-2">{r.description}</p>
                    )}

                    {/* Expand tasks */}
                    {r.delegated_tasks && r.delegated_tasks.length > 0 && (
                      <button
                        className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        <ChevronDown className={cn("h-3 w-3 transition-transform", expandedId === r.id && "rotate-180")} />
                        {expandedId === r.id ? "Masquer" : "Voir"} les tâches déléguées
                      </button>
                    )}
                    {expandedId === r.id && r.delegated_tasks && (
                      <div className="mt-2 space-y-1 pl-3 border-l-2 border-primary/20">
                        {r.delegated_tasks.map((t: DelegatedTask) => (
                          <div key={t.id} className="flex items-center gap-2 text-sm">
                            <Circle className="h-2 w-2 text-primary/60 shrink-0" />
                            <span className="font-medium">{t.title}</span>
                            <PriorityBadge priority={t.priority} />
                            <span className="text-muted-foreground">
                              {format(parseISO(t.task_date), "dd MMM", { locale: fr })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm" variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                      onClick={() => openReview(r.id, "reject")}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Refuser
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"
                      onClick={() => openReview(r.id, "approve")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All requests table */}
      <Card className="backdrop-blur-xl bg-card/90 border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">Toutes les demandes</CardTitle>
            <Input
              placeholder="Rechercher par motif ou surveillant…"
              className="h-8 sm:w-64 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b px-4">
            <Tabs value={tab} onValueChange={v => setTab(v as any)}>
              <TabsList className="bg-transparent border-0 h-9 rounded-none gap-1">
                {([
                  ["PENDING",  "En attente", pending.length],
                  ["APPROVED", "Approuvées", approved.length],
                  ["REJECTED", "Refusées",   rejected.length],
                  ["ALL",      "Toutes",     requests.length],
                ] as const).map(([v, label, count]) => (
                  <TabsTrigger
                    key={v} value={v}
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-9 gap-1.5 text-sm"
                  >
                    {label}
                    <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded-full font-medium">{count}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Aucune demande.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Surveillant</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Remplaçant</TableHead>
                    <TableHead>Tâches</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Soumis le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-medium">{r.surveillant_name}</TableCell>
                      <TableCell>
                        <div className="font-medium max-w-[180px] truncate">{r.reason}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(parseISO(r.start_date), "dd/MM/yy")} → {format(parseISO(r.end_date), "dd/MM/yy")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{duration(r.start_date, r.end_date)}</TableCell>
                      <TableCell className="text-sm">{r.replacement_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-center">
                        {r.delegated_tasks?.length
                          ? <span className="font-medium text-primary">{r.delegated_tasks.length}</span>
                          : "—"}
                      </TableCell>
                      <TableCell><AbsenceStatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.created_at), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => openReview(r.id, "reject")}
                            >
                              Refuser
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                              onClick={() => openReview(r.id, "approve")}
                            >
                              Approuver
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review modal */}
      <Dialog open={!!reviewId} onOpenChange={v => !v && setReviewId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", reviewMode === "approve" ? "text-emerald-600" : "text-rose-600")}>
              {reviewMode === "approve"
                ? <><CheckCircle2 className="h-5 w-5" /> Approuver la demande</>
                : <><XCircle className="h-5 w-5" /> Refuser la demande</>}
            </DialogTitle>
          </DialogHeader>

          {reviewReq && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                <div className="font-semibold">{reviewReq.reason}</div>
                <div className="text-muted-foreground">
                  {reviewReq.surveillant_name} •{" "}
                  {format(parseISO(reviewReq.start_date), "dd MMM", { locale: fr })} →{" "}
                  {format(parseISO(reviewReq.end_date), "dd MMM yyyy", { locale: fr })}
                  {" "}({duration(reviewReq.start_date, reviewReq.end_date)})
                </div>
                {reviewReq.replacement_name && (
                  <div className="text-muted-foreground">Remplaçant : {reviewReq.replacement_name}</div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  {reviewMode === "approve" ? "Note (optionnelle)" : "Motif du refus"}
                </Label>
                <Textarea
                  rows={3}
                  placeholder={reviewMode === "approve" ? "Instructions particulières…" : "Expliquez le motif du refus…"}
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewId(null)}>Annuler</Button>
            <Button
              onClick={handleReview}
              disabled={submitting || (reviewMode === "reject" && !adminNote.trim())}
              className={cn("gap-2", reviewMode === "approve" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600", "text-white")}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {reviewMode === "approve" ? "Confirmer l'approbation" : "Confirmer le refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT: role-aware entry point
// ─────────────────────────────────────────────────────────────────────────────

export default function AbsenceRequests() {
  const { primaryRole } = useAuth();
  return primaryRole === "ADMIN" ? <AdminView /> : <SurveillantView />;
}
