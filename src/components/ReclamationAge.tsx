import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { daysSince, ageLabel } from "@/lib/time";
import { ReclamationStatus } from "@/lib/types";

interface Props {
  createdAt: string;
  status: ReclamationStatus | string;
  resolvedAt?: string | null;
}

/**
 * Couleur du badge selon l'ancienneté, en jours :
 *   0 – 1  vert
 *      2   jaune
 *      3   orange
 *   4 et + rouge
 */
export const ageTone = (days: number): string => {
  if (days >= 4) return "bg-red-500 text-white hover:bg-red-600";
  if (days === 3) return "bg-orange-500 text-white hover:bg-orange-600";
  if (days === 2) return "bg-yellow-500 text-white hover:bg-yellow-600";
  return "bg-green-500 text-white hover:bg-green-600";
};

/**
 * Ancienneté d'une réclamation, en jours depuis sa déclaration.
 *
 * Tant qu'elle n'est pas terminée, la couleur s'assombrit avec l'attente :
 * une réclamation qui traîne depuis deux semaines ne doit pas se lire comme
 * une réclamation d'hier. Une fois terminée, on affiche le délai de
 * résolution, en gris : ce n'est plus une alerte.
 */
export function ReclamationAge({ createdAt, status, resolvedAt }: Props) {
  if (status === "TERMINEE") {
    const days = resolvedAt ? daysSince(createdAt, new Date(resolvedAt)) : null;
    return (
      <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
        <Clock className="h-3 w-3" />
        {days === null
          ? "terminée"
          : days === 0
          ? "résolue le jour même"
          : `résolue en ${days === 1 ? "1 jour" : `${days} jours`}`}
      </Badge>
    );
  }

  const days = daysSince(createdAt);
  const tone = ageTone(days);

  return (
    <Badge className={`gap-1 font-normal ${tone}`} title={`Déclarée il y a ${ageLabel(createdAt)}`}>
      <Clock className="h-3 w-3" />
      {ageLabel(createdAt)}
    </Badge>
  );
}
