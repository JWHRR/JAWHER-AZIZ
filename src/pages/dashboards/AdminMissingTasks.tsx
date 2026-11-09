import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate } from "@/lib/time";
import {
  fetchMissingTasksForDate,
  type MissingTask,
} from "@/lib/missingTasks";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  AlertTriangle,
  UserX,
  Utensils,
  ClipboardCheck,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

export default function AdminMissingTasks() {
  const navigate = useNavigate();

  const businessDate = getBusinessDate();
  const yesterdayDate = subDays(businessDate, 1);
  const yesterdayStr = format(yesterdayDate, "yyyy-MM-dd");
  const yesterdayFormatted = format(yesterdayDate, "EEEE d MMMM yyyy", { locale: fr });

  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<MissingTask[]>(() => {
    try {
      const cached = localStorage.getItem(`admin_missing_tasks_${yesterdayStr}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchMissingTasksForDate(yesterdayStr);
      setTasks(result);
      try {
        localStorage.setItem(`admin_missing_tasks_${yesterdayStr}`, JSON.stringify(result));
      } catch {}
    } catch (err) {
      console.error("Error loading missing tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group tasks by surveillant
  const groups = (() => {
    const map: Record<
      string,
      { surveillantId: string; surveillantName: string; tasks: MissingTask[] }
    > = {};

    tasks.forEach((task) => {
      if (!map[task.surveillant_id]) {
        map[task.surveillant_id] = {
          surveillantId: task.surveillant_id,
          surveillantName: task.surveillantName,
          tasks: [],
        };
      }
      map[task.surveillant_id].tasks.push(task);
    });

    return Object.values(map);
  })();

  const handleContactSurveillant = (surveillantId: string, surveillantName: string) => {
    const survTasks = tasks.filter((m) => m.surveillant_id === surveillantId);
    const dateLabel = format(yesterdayDate, "d MMMM yyyy", { locale: fr });
    const lines = survTasks.map((t) => `• ${t.detail}`).join("\n");
    const draft = `Bonjour ${surveillantName},\n\nNous avons constaté que les tâches suivantes n'ont pas été effectuées hier (${dateLabel}) :\n${lines}\n\nMerci de m'en parler.\n\nCordialement`;
    navigate("/messagerie", { state: { openWithUserId: surveillantId, draftMessage: draft } });
  };

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
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getModuleLink = (type: MissingTask["type"]) => {
    switch (type) {
      case "ABSENCE":
        return { to: `/admin/absences?date=${yesterdayStr}`, label: "Voir dans Absences" };
      case "RESTAURANT":
        return { to: `/admin/restaurant?date=${yesterdayStr}`, label: "Voir dans Restaurant" };
      case "INSPECTION":
        return { to: `/admin/inspections?date=${yesterdayStr}`, label: "Voir dans Inspections" };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl shadow-sm hover:bg-accent"
          >
            <Link to="/" aria-label="Retour au tableau de bord">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
              Tâches manquantes d'hier
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground capitalize">
              {yesterdayFormatted}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={loadData}
          disabled={loading}
          className="h-9 w-9 shrink-0 rounded-xl"
          title="Actualiser"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
        </Button>
      </div>

      {/* Summary Banner */}
      {tasks.length > 0 ? (
        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-300">
              {tasks.length} tâche{tasks.length > 1 ? "s" : ""} non effectuée{tasks.length > 1 ? "s" : ""} hier ({groups.length} surveillant{groups.length > 1 ? "s" : ""})
            </span>
          </div>
          <Badge className="bg-amber-600 text-white font-bold text-xs shrink-0">
            {tasks.length}
          </Badge>
        </div>
      ) : null}

      {/* Tasks List */}
      {loading && tasks.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Chargement des tâches...</p>
        </div>
      ) : tasks.length === 0 ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="py-14 flex flex-col items-center justify-center text-center px-4">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3.5 shadow-sm">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-foreground">
              Toutes les tâches d'hier sont complétées !
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
              Aucune tâche manquante n'a été constatée pour la journée d'hier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card
              key={group.surveillantId}
              className="border-border/80 bg-card shadow-sm overflow-hidden"
            >
              <CardHeader className="p-3.5 sm:p-4 pb-3 bg-muted/20 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center uppercase shrink-0">
                      {group.surveillantName.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">
                        {group.surveillantName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {group.tasks.length} tâche{group.tasks.length > 1 ? "s" : ""} non effectuée{group.tasks.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="text-xs h-8 sm:h-9 gap-1.5 w-full sm:w-auto font-medium"
                    onClick={() =>
                      handleContactSurveillant(group.surveillantId, group.surveillantName)
                    }
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Contacter sur la messagerie
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-3 sm:p-4 pt-3 space-y-2">
                {group.tasks.map((task, i) => {
                  const moduleLink = getModuleLink(task.type);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs gap-2"
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
                          className="text-muted-foreground hover:text-primary shrink-0 p-1 rounded hover:bg-background transition-colors"
                          title={moduleLink.label}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
