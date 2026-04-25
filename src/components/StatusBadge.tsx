import { Badge } from "@/components/ui/badge";
import { ReclamationStatus, ReclamationPriority, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ReclamationStatus }) {
  const styles: Record<ReclamationStatus, string> = {
    EN_ATTENTE: "bg-warning-soft text-warning border-warning/30",
    EN_COURS: "bg-primary-soft text-primary border-primary/30",
    TERMINEE: "bg-success-soft text-success border-success/30",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", styles[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: ReclamationPriority }) {
  const styles: Record<ReclamationPriority, string> = {
    BASSE: "bg-muted text-muted-foreground border-border",
    NORMALE: "bg-primary-soft text-primary border-primary/30",
    HAUTE: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", styles[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
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
