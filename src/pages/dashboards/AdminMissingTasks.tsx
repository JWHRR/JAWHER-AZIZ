import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { format, subDays, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate, parseLocalDate } from "@/lib/time";
import {
  fetchMissingTasksForDate,
  type MissingTask,
} from "@/lib/missingTasks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  UserX,
  Utensils,
  ClipboardCheck,
  Search,
  MessageSquare,
  Users,
  CheckCircle2,
  ExternalLink,
  Layers,
  List,
  Loader2,
  RefreshCw,
  Filter,
} from "lucide-react";

export default function AdminMissingTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const businessDate = getBusinessDate();
  const defaultDate = format(subDays(businessDate, 1), "yyyy-MM-dd");
  const selectedDateStr = searchParams.get("date") || defaultDate;

  const [date, setDate] = useState(selectedDateStr);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<MissingTask[]>(() => {
    try {
      const cached = localStorage.getItem(`admin_missing_tasks_${selectedDateStr}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grouped" | "detailed">("grouped");

  const currentDateObj = parseLocalDate(date);
  const dateFormatted = format(currentDateObj, "EEEE d MMMM yyyy", { locale: fr });
  const isYesterday = date === format(subDays(businessDate, 1), "yyyy-MM-dd");
  const isToday = date === format(businessDate, "yyyy-MM-dd");

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
  };

  const handlePrevDay = () => {
    const prev = format(subDays(parseLocalDate(date), 1), "yyyy-MM-dd");
    handleDateChange(prev);
  };

  const handleNextDay = () => {
    const next = format(addDays(parseLocalDate(date), 1), "yyyy-MM-dd");
    handleDateChange(next);
  };

  const loadData = async (targetDate: string) => {
    setLoading(true);
    try {
      const result = await fetchMissingTasksForDate(targetDate);
      setTasks(result);
      try {
        localStorage.setItem(`admin_missing_tasks_${targetDate}`, JSON.stringify(result));
      } catch {}
    } catch (err) {
      console.error("Error loading missing tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(date);
  }, [date]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: tasks.length,
      absence: tasks.filter((t) => t.type === "ABSENCE").length,
      restaurant: tasks.filter((t) => t.type === "RESTAURANT").length,
      inspection: tasks.filter((t) => t.type === "INSPECTION").length,
      surveillants: new Set(tasks.map((t) => t.surveillant_id)).size,
    };
  }, [tasks]);

  // Filtered
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

  const handleContactSurveillant = (surveillantId: string, surveillantName: string) => {
    const survTasks = tasks.filter((m) => m.surveillant_id === surveillantId);
    const dateLabel = format(parseLocalDate(date), "d MMMM yyyy", { locale: fr });
    const lines = survTasks.map((t) => `• ${t.detail}`).join("\n");
    const draft = `Bonjour ${surveillantName},\n\nNous avons constaté que les tâches suivantes ne sont pas été effectuées pour le ${dateLabel} :\n${lines}\n\nMerci de m'en parler.\n\nCordialement`;
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
        return { to: `/admin/absences?date=${date}`, label: "Voir dans Absences" };
      case "RESTAURANT":
        return { to: `/admin/restaurant?date=${date}`, label: "Voir dans Restaurant" };
      case "INSPECTION":
        return { to: `/admin/inspections?date=${date}`, label: "Voir dans Inspections" };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-10">
      {/* Top Mobile-First Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight truncate">
                  Tâches non effectuées
                </h1>
                {counts.total > 0 && (
                  <Badge variant="destructive" className="font-bold text-xs">
                    {counts.total}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate capitalize">
                {dateFormatted}
                {isYesterday && " (hier)"}
                {isToday && " (aujourd'hui)"}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => loadData(date)}
            disabled={loading}
            className="h-9 w-9 shrink-0 rounded-xl"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>

        {/* Date Selector bar with quick prev/next buttons */}
        <Card className="border-border/60 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevDay}
              className="h-8 px-2 sm:px-3 text-xs gap-1 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Jour préc.</span>
            </Button>

            <div className="flex items-center gap-2 justify-center flex-1 max-w-xs">
              <CalIcon className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              <Input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-8 text-xs sm:text-sm font-medium text-center w-full bg-background"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextDay}
              className="h-8 px-2 sm:px-3 text-xs gap-1 shrink-0"
            >
              <span className="hidden sm:inline">Jour suiv.</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Bar: Horizontal scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/70 shrink-0 font-medium">
          <span className="text-muted-foreground">Total :</span>
          <span className={`font-bold ${counts.total > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
            {counts.total} tâche{counts.total > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/70 text-muted-foreground shrink-0">
          <Users className="h-3.5 w-3.5" />
          <span>
            {counts.surveillants} surveillant{counts.surveillants > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0 font-medium">
          <UserX className="h-3.5 w-3.5" />
          <span>{counts.absence} absence{counts.absence > 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0 font-medium">
          <Utensils className="h-3.5 w-3.5" />
          <span>{counts.restaurant} restaurant</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shrink-0 font-medium">
          <ClipboardCheck className="h-3.5 w-3.5" />
          <span>{counts.inspection} inspection{counts.inspection > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par surveillant ou détail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-xs sm:text-sm bg-card"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl shrink-0 self-start sm:self-auto w-full sm:w-auto justify-center">
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
            >
              <Layers className="h-3.5 w-3.5" />
              Par surveillant
            </Button>
            <Button
              variant={viewMode === "detailed" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("detailed")}
              className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
            >
              <List className="h-3.5 w-3.5" />
              Liste détaillée
            </Button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <Button
            variant={selectedType === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("ALL")}
            className="h-7 text-xs px-3 rounded-full shrink-0"
          >
            Toutes ({counts.total})
          </Button>
          <Button
            variant={selectedType === "ABSENCE" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("ABSENCE")}
            className="h-7 text-xs px-3 rounded-full shrink-0"
          >
            Absences ({counts.absence})
          </Button>
          <Button
            variant={selectedType === "RESTAURANT" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("RESTAURANT")}
            className="h-7 text-xs px-3 rounded-full shrink-0"
          >
            Restaurant ({counts.restaurant})
          </Button>
          <Button
            variant={selectedType === "INSPECTION" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("INSPECTION")}
            className="h-7 text-xs px-3 rounded-full shrink-0"
          >
            Inspections ({counts.inspection})
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && tasks.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Chargement des données...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-border/60 bg-card/60 shadow-sm">
          <CardContent className="py-14 flex flex-col items-center justify-center text-center px-4">
            {tasks.length === 0 ? (
              <>
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3.5 shadow-sm">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-base sm:text-lg text-foreground">
                  Toutes les tâches sont complétées !
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md">
                  Aucun retard de saisie ni omission n'a été constaté pour le {dateFormatted}.
                </p>
              </>
            ) : (
              <>
                <Filter className="h-10 w-10 text-muted-foreground/60 mb-2.5" />
                <h3 className="font-medium text-sm sm:text-base text-foreground">
                  Aucun résultat pour cette recherche
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Essayez de changer les filtres ou d'effacer le terme recherché.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedType("ALL");
                  }}
                  className="mt-4 text-xs h-8"
                >
                  Réinitialiser les filtres
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grouped" ? (
        /* Grouped by Surveillant */
        <div className="space-y-3.5">
          {groupedTasks.map((group) => (
            <Card
              key={group.surveillantId}
              className="border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <CardHeader className="p-3.5 sm:p-4 pb-3 bg-muted/20 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center uppercase shrink-0">
                      {group.surveillantName.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-sm sm:text-base text-foreground">
                        {group.surveillantName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {group.tasks.length} tâche{group.tasks.length > 1 ? "s" : ""} non effectuée{group.tasks.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="text-xs h-9 gap-1.5 w-full sm:w-auto font-semibold shadow-sm"
                    onClick={() =>
                      handleContactSurveillant(group.surveillantId, group.surveillantName)
                    }
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Contacter sur la messagerie
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-3 sm:p-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.tasks.map((task, i) => {
                    const moduleLink = getModuleLink(task.type);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs gap-2"
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Detailed List View */
        <div className="space-y-2.5">
          {filteredTasks.map((task, i) => {
            const moduleLink = getModuleLink(task.type);
            return (
              <Card
                key={i}
                className="border-border/80 bg-card hover:bg-accent/30 transition-colors shadow-sm overflow-hidden"
              >
                <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="pt-0.5 sm:pt-0 shrink-0">
                      {getTypeBadge(task.type)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-sm text-foreground">
                        {task.detail}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>Surveillant :</span>
                        <span className="font-bold text-foreground">
                          {task.surveillantName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    {moduleLink && (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground hover:text-primary gap-1"
                      >
                        <Link to={moduleLink.to}>
                          <ExternalLink className="h-3 w-3" />
                          <span className="hidden sm:inline">Module</span>
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs gap-1.5 font-medium flex-1 sm:flex-initial"
                      onClick={() =>
                        handleContactSurveillant(task.surveillant_id, task.surveillantName)
                      }
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Contacter
                    </Button>
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
