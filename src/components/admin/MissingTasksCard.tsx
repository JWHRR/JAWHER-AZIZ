import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  UserX,
  Utensils,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { MissingTask } from "./MissingTasksDialog";

interface MissingTasksCardProps {
  tasks: MissingTask[];
  yesterdayDate: Date;
  onClick: () => void;
}

export function MissingTasksCard({
  tasks,
  yesterdayDate,
  onClick,
}: MissingTasksCardProps) {
  const hasMissing = tasks.length > 0;
  const formattedDate = format(yesterdayDate, "d MMMM", { locale: fr });
  const uniqueSurveillants = new Set(tasks.map((t) => t.surveillant_id)).size;

  const absenceCount = tasks.filter((t) => t.type === "ABSENCE").length;
  const restaurantCount = tasks.filter((t) => t.type === "RESTAURANT").length;
  const inspectionCount = tasks.filter((t) => t.type === "INSPECTION").length;

  if (!hasMissing) {
    return (
      <Card
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="group relative overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent hover:border-emerald-500/60 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      >
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm sm:text-base text-foreground">
                  Tâches d'hier : Toutes complétées
                </span>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px]"
                >
                  {formattedDate}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Aucune omission de saisie constatée. Absences, effectifs et inspections à jour.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground self-end sm:self-auto shrink-0 transition-colors">
            <span>Détails</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative overflow-hidden border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent hover:border-amber-500/70 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-amber-500" />
      <CardContent className="p-4 sm:p-5 pl-5 sm:pl-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Main Info */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="h-11 w-11 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center transition-transform group-hover:scale-105">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-foreground">
                Tâches non effectuées — hier ({formattedDate})
              </span>
              <Badge
                variant="destructive"
                className="bg-amber-600 hover:bg-amber-600 text-white font-bold text-xs px-2 py-0.5 shadow-sm"
              >
                {tasks.length} manquante{tasks.length > 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                {uniqueSurveillants} surveillant{uniqueSurveillants > 1 ? "s" : ""} concerné{uniqueSurveillants > 1 ? "s" : ""}
              </span>
              <span>•</span>
              <span className="text-muted-foreground">
                Cliquez pour afficher le détail et relancer par messagerie
              </span>
            </div>
          </div>
        </div>

        {/* Badges breakdown & CTA */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {absenceCount > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-medium"
              >
                <UserX className="h-3 w-3" />
                {absenceCount} absence{absenceCount > 1 ? "s" : ""}
              </Badge>
            )}
            {restaurantCount > 0 && (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-medium"
              >
                <Utensils className="h-3 w-3" />
                {restaurantCount} resto
              </Badge>
            )}
            {inspectionCount > 0 && (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 text-[11px] font-medium"
              >
                <ClipboardCheck className="h-3 w-3" />
                {inspectionCount} insp.
              </Badge>
            )}
          </div>

          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 group-hover:bg-amber-500 group-hover:text-white text-amber-800 dark:text-amber-300 font-semibold text-xs transition-colors shrink-0">
            <span>Détails</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
