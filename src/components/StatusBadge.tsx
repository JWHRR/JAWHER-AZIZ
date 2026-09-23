import { Badge } from "@/components/ui/badge";
import { ReclamationStatus, ReclamationPriority, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ReclamationStatus }) {
  const styles: Record<ReclamationStatus, string> = {
    EN_ATTENTE: "text-warning",
    EN_COURS: "text-primary",
    TERMINEE: "text-success",
  };
  return (
    <span className={cn("text-xs font-semibold uppercase tracking-wide", styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: ReclamationPriority }) {
  const styles: Record<ReclamationPriority, string> = {
    BASSE: "text-muted-foreground",
    NORMALE: "text-primary",
    HAUTE: "text-destructive",
  };
  return (
    <span className={cn("text-xs font-semibold uppercase tracking-wide", styles[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function DoneBadge({ done }: { done: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        done
          ? "bg-success-soft text-success border-success/30"
          : "bg-warning-soft text-warning border-warning/30"
      )}
    >
      {done ? "Fait" : "À faire"}
    </Badge>
  );
}
