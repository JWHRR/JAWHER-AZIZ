import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sun, FileDown, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate, weekendAnchor, weekendPeriodEnd } from "@/lib/time";
import { generateTablePdf } from "@/lib/pdf";
import { toast } from "sonner";

interface Row {
  code: string;
  nombre: number;
  saisiPar?: string;
}

/**
 * Effectif weekend : nombre d'élèves restant à l'internat, par dortoir.
 *
 * Le relevé est enregistré sous le jeudi de sa semaine (`semaine_du`) et
 * vaut jusqu'au jeudi suivant — la carte reste donc affichée toute la
 * semaine, et ne se vide pas le lundi.
 */
export function WeekendEffectifCard({ showPdf = true }: { showPdf?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [anchor] = useState<Date>(() => weekendAnchor(getBusinessDate()));
  const periodEnd = weekendPeriodEnd(anchor);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Jointures côté client : une jointure imbriquée PostgREST dépend des
        // clés étrangères et des droits sur la table liée.
        const [weRes, dortRes] = await Promise.all([
          supabase
            .from("weekend_effectifs")
            .select("dortoir_id, nombre_presents, surveillant_id")
            .eq("semaine_du", format(anchor, "yyyy-MM-dd")),
          supabase.from("dortoirs").select("id, code").order("code"),
        ]);

        // Un refus RLS renvoie une liste vide sans erreur : on affiche le
        // message plutôt que de laisser croire qu'aucun effectif n'est saisi.
        const firstError = weRes.error ?? dortRes.error;
        if (firstError) {
          console.error("Effectif weekend:", firstError);
          setError(firstError.message);
        }

        const codeById: Record<string, string> = Object.fromEntries(
          (dortRes.data ?? []).map((d: any) => [d.id, d.code])
        );

        const ids = Array.from(
          new Set((weRes.data ?? []).map((w: any) => w.surveillant_id).filter(Boolean))
        );
        let nameById: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", ids as string[]);
          nameById = Object.fromEntries(
            (profs ?? []).map((p: any) => [p.user_id, p.full_name || "—"])
          );
        }

        setRows(
          (weRes.data ?? [])
            .map((w: any) => ({
              code: codeById[w.dortoir_id] ?? "—",
              nombre: w.nombre_presents ?? 0,
              saisiPar: nameById[w.surveillant_id],
            }))
            .sort((a, b) => a.code.localeCompare(b.code))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [anchor]);

  const total = rows.reduce((s, r) => s + r.nombre, 0);

  const periodLabel =
    `du ${format(anchor, "EEEE d MMMM", { locale: fr })}` +
    ` au ${format(periodEnd, "EEEE d MMMM yyyy", { locale: fr })}`;

  const exportPdf = () => {
    generateTablePdf({
      title: "Effectif Weekend",
      subtitle: `Élèves restant à l'internat — ${periodLabel}`,
      filename: `effectif_weekend_${format(anchor, "yyyy-MM-dd")}.pdf`,
      head: ["Dortoir", "Présents", "Saisi par"],
      rows: rows.map((r) => [r.code, String(r.nombre), r.saisiPar ?? "—"]),
      foot: [["TOTAL", String(total), ""]],
    });
    toast.success("PDF généré");
  };

  return (
    <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" /> Effectif weekend
            </CardTitle>
            <CardDescription className="first-letter:uppercase">{periodLabel}</CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!loading && rows.length > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 text-sm px-2.5 py-1">
                <Users className="h-3.5 w-3.5" />
                {total}
              </Badge>
            )}
            {showPdf && !loading && rows.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportPdf}>
                <FileDown className="h-4 w-4 mr-1" /> PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : error ? (
          <p className="text-sm text-destructive">Lecture impossible : {error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aucun effectif weekend saisi pour cette période. Les surveillants le
            renseignent depuis la page Absences, à partir du jeudi.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {rows.map((r, i) => (
              <div
                key={`${r.code}-${i}`}
                className="rounded-lg border bg-muted/30 px-3 py-2 flex flex-col"
                title={r.saisiPar ? `Saisi par ${r.saisiPar}` : undefined}
              >
                <span className="text-xs text-muted-foreground">Dortoir {r.code}</span>
                <span className="text-2xl font-bold leading-tight">{r.nombre}</span>
                <span className="text-[10px] text-muted-foreground">élèves</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
