import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  UserX,
  Utensils,
  ClipboardCheck,
  Clock,
  Search,
  MessageSquare,
  Users,
  CheckCircle2,
  ExternalLink,
  Filter,
  Layers,
  List,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { MissingTask } from "@/lib/missingTasks";

interface MissingTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: MissingTask[];
  yesterdayFormatted: string;
  onContactSurveillant: (surveillantId: string, surveillantName: string) => void;
}

export function MissingTasksDialog({
  open,
  onOpenChange,
  tasks,
  yesterdayFormatted,
  onContactSurveillant,
}: MissingTasksDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grouped" | "detailed">("grouped");

  // Summary counts
  const counts = useMemo(() => {
    return {
      total: tasks.length,
      absence: tasks.filter((t) => t.type === "ABSENCE").length,
      restaurant: tasks.filter((t) => t.type === "RESTAURANT").length,
      inspection: tasks.filter((t) => t.type === "INSPECTION").length,
      surveillants: new Set(tasks.map((t) => t.surveillant_id)).size,
    };
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchType = selectedType === "ALL" || task.type === selectedType;
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        task.surveillantName.toLowerCase().includes(term) ||
        task.detail.toLowerCase().includes(term);
      return matchType && matchSearch;
    });
  }, [tasks, selectedType, searchTerm]);

  // Grouped by surveillant
  const groupedTasks = useMemo(() => {
    const groups: Record<
      string,
      { surveillantId: string; surveillantName: string; tasks: MissingTask[] }
    > = {};

    filteredTasks.forEach((task) => {
      if (!groups[task.surveillant_id]) {
        groups[task.surveillant_id] = {
          surveillantId: task.surveillant_id,
          surveillantName: task.surveillantName,
          tasks: [],
        };
      }
      groups[task.surveillant_id].tasks.push(task);
    });

    return Object.values(groups);
  }, [filteredTasks]);

  const getTypeBadge = (type: MissingTask["type"]) => {
    switch (type) {
      case "ABSENCE":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-xs font-medium"
          >
            <UserX className="h-3 w-3" />
            Absence
          </Badge>
        );
      case "RESTAURANT":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs font-medium"
          >
            <Utensils className="h-3 w-3" />
            Restaurant
          </Badge>
        );
      case "INSPECTION":
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 text-xs font-medium"
          >
            <ClipboardCheck className="h-3 w-3" />
            Inspection
          </Badge>
        );
      case "PERMANENCE":
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 gap-1 text-xs font-medium"
          >
            <Clock className="h-3 w-3" />
            Permanence
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getModuleLink = (type: MissingTask["type"]) => {
    switch (type) {
      case "ABSENCE":
        return { to: "/admin/absences", label: "Module Absences" };
      case "RESTAURANT":
        return { to: "/admin/restaurant", label: "Module Restaurant" };
      case "INSPECTION":
        return { to: "/admin/inspections", label: "Module Inspections" };
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-xl">
        {/* Header */}
        <div className="p-6 border-b bg-card">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Tâches non effectuées
                  <Badge variant="secondary" className="font-semibold text-xs">
                    {yesterdayFormatted}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Relevé détaillé des saisies attendues hier et non renseignées.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick stats badges */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/50 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted font-medium text-foreground">
              <span>Total :</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {counts.total} tâche{counts.total > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>
                {counts.surveillants} surveillant{counts.surveillants > 1 ? "s" : ""}
              </span>
            </div>
            {counts.absence > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                <UserX className="h-3 w-3" />
                <span>{counts.absence} absence{counts.absence > 1 ? "s" : ""}</span>
              </div>
            )}
            {counts.restaurant > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
                <Utensils className="h-3 w-3" />
                <span>{counts.restaurant} restaurant</span>
              </div>
            )}
            {counts.inspection > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium">
                <ClipboardCheck className="h-3 w-3" />
                <span>{counts.inspection} inspection{counts.inspection > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Search bar & view switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom de surveillant ou détail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm bg-background"
              />
            </div>
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg shrink-0 self-end sm:self-auto">
              <Button
                variant={viewMode === "grouped" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grouped")}
                className="h-8 text-xs gap-1.5 px-2.5"
              >
                <Layers className="h-3.5 w-3.5" />
                Par surveillant
              </Button>
              <Button
                variant={viewMode === "detailed" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("detailed")}
                className="h-8 text-xs gap-1.5 px-2.5"
              >
                <List className="h-3.5 w-3.5" />
                Détaillé
              </Button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 text-xs">
            <Button
              variant={selectedType === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("ALL")}
              className="h-7 text-xs px-2.5 rounded-full"
            >
              Toutes ({counts.total})
            </Button>
            <Button
              variant={selectedType === "ABSENCE" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("ABSENCE")}
              className="h-7 text-xs px-2.5 rounded-full"
            >
              Absences ({counts.absence})
            </Button>
            <Button
              variant={selectedType === "RESTAURANT" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("RESTAURANT")}
              className="h-7 text-xs px-2.5 rounded-full"
            >
              Restaurant ({counts.restaurant})
            </Button>
            <Button
              variant={selectedType === "INSPECTION" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("INSPECTION")}
              className="h-7 text-xs px-2.5 rounded-full"
            >
              Inspections ({counts.inspection})
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/20">
          {filteredTasks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
              {tasks.length === 0 ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="font-semibold text-base text-foreground">
                    Toutes les tâches d'hier sont complétées !
                  </p>
                  <p className="text-xs sm:text-sm mt-1 max-w-sm">
                    Aucun retard ni omission de saisie n'a été détecté pour cette journée.
                  </p>
                </>
              ) : (
                <>
                  <Filter className="h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="font-medium text-sm">Aucune tâche ne correspond à vos filtres</p>
                  <p className="text-xs mt-1">Essayez de modifier votre recherche ou de réinitialiser le filtre.</p>
                </>
              )}
            </div>
          ) : viewMode === "grouped" ? (
            /* Grouped by Surveillant */
            <div className="space-y-3">
              {groupedTasks.map((group) => (
                <div
                  key={group.surveillantId}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-sm hover:shadow transition-shadow space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center uppercase">
                        {group.surveillantName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {group.surveillantName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.tasks.length} tâche{group.tasks.length > 1 ? "s" : ""} non effectuée{group.tasks.length > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 gap-1.5 self-start sm:self-auto hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() =>
                        onContactSurveillant(group.surveillantId, group.surveillantName)
                      }
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Contacter sur la messagerie
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {group.tasks.map((task, i) => {
                      const moduleLink = getModuleLink(task.type);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getTypeBadge(task.type)}
                            <span className="font-medium text-foreground truncate">
                              {task.detail}
                            </span>
                          </div>
                          {moduleLink && (
                            <Link
                              to={moduleLink.to}
                              className="text-muted-foreground hover:text-primary shrink-0 ml-2 p-1 rounded hover:bg-background"
                              title={moduleLink.label}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Detailed List View */
            <div className="space-y-2">
              {filteredTasks.map((task, i) => {
                const moduleLink = getModuleLink(task.type);
                return (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-accent/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="pt-0.5 sm:pt-0 shrink-0">
                        {getTypeBadge(task.type)}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-medium text-sm text-foreground">
                          {task.detail}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span>Surveillant :</span>
                          <span className="font-semibold text-foreground/90">
                            {task.surveillantName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {moduleLink && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-primary gap-1"
                        >
                          <Link to={moduleLink.to}>
                            <ExternalLink className="h-3 w-3" />
                            Voir module
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs gap-1.5"
                        onClick={() =>
                          onContactSurveillant(task.surveillant_id, task.surveillantName)
                        }
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Contacter
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-card flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filteredTasks.length} tâche{filteredTasks.length > 1 ? "s" : ""} affichée{filteredTasks.length > 1 ? "s" : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
