import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateTablePdf } from "@/lib/pdf";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

export function WeeklyAbsenceHistory() {
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      // Get previous week's Monday and Sunday
      const now = new Date();
      const lastWeekDate = subDays(now, 7);
      const startDate = startOfWeek(lastWeekDate, { weekStartsOn: 1 }); // Monday
      const endDate = endOfWeek(lastWeekDate, { weekStartsOn: 1 }); // Sunday

      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Fetch all absences in that range
      const { data: absences } = await supabase
        .from("absences")
        .select("dortoir_id, date, nombre_absents, dortoirs(code)")
        .gte("date", startStr)
        .lte("date", endStr);

      if (!absences || absences.length === 0) {
        toast.info("Aucune absence enregistrée la semaine dernière.");
        setLoading(false);
        return;
      }

      // Aggregate absences per dortoir
      const aggregated: Record<string, { code: string; totalAbsences: number }> = {};
      
      absences.forEach((a: any) => {
        if (!aggregated[a.dortoir_id]) {
          aggregated[a.dortoir_id] = {
            code: a.dortoirs?.code || "Inconnu",
            totalAbsences: 0
          };
        }
        aggregated[a.dortoir_id].totalAbsences += a.nombre_absents;
      });

      const rows = Object.values(aggregated)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((a) => [`D. ${a.code}`, String(a.totalAbsences)]);

      generateTablePdf({
        title: "Bilan Hebdomadaire des Absences",
        subtitle: `Du ${format(startDate, "d MMMM", { locale: fr })} au ${format(endDate, "d MMMM yyyy", { locale: fr })}`,
        filename: `bilan_absences_${startStr}_${endStr}.pdf`,
        head: ["Dortoir", "Total Absences (jours cumulés)"],
        rows,
      });

      toast.success("Bilan hebdomadaire généré avec succès");
    } catch (error: any) {
      toast.error("Erreur lors de la génération du bilan");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generateReport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
      Bilan hebdomadaire (PDF)
    </Button>
  );
}
