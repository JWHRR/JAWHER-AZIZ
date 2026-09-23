import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, BedDouble, Users } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate, parseLocalDate } from "@/lib/time";

export default function AdminAbsencesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || format(subDays(getBusinessDate(), 1), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [absences, setAbsences] = useState<any[]>([]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: absData } = await supabase
        .from("absences")
        .select("*, dortoirs(code)")
        .eq("date", date)
        .order("created_at", { ascending: false });

      setAbsences(absData || []);
      setLoading(false);
    };
    load();
  }, [date]);

  const totalAbsents = absences.reduce((acc, curr) => acc + (curr.nombre_absents || 0), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="outline" size="icon" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Liste des Absences</h1>
          <p className="text-muted-foreground mt-1 text-sm">Vue détaillée pour l'administration</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="date" className="text-sm shrink-0">Date :</Label>
        <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Absences du {format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full text-xs">
              <Users className="h-3.5 w-3.5" />
              {totalAbsents} absent(s) au total
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : absences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune absence enregistrée pour cette date.</p>
          ) : (
            <div className="space-y-3">
              {absences.map((a) => (
                <div key={a.id} className="rounded-xl border bg-muted/30 p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-info shrink-0" />
                      <span className="font-semibold text-sm">Dortoir {a.dortoirs?.code}</span>
                    </div>
                    <span className="inline-flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      {a.nombre_absents} absent{a.nombre_absents > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Names */}
                  {a.noms_absents && (
                    <div className="text-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Noms des absents</div>
                      <div className="whitespace-pre-wrap leading-relaxed text-foreground bg-background rounded-lg px-3 py-2 border text-xs">
                        {a.noms_absents}
                      </div>
                    </div>
                  )}

                  {/* Observations */}
                  {a.observations && (
                    <div className="text-xs text-muted-foreground bg-background rounded-lg px-3 py-2 border">
                      <span className="font-semibold text-foreground">Obs. : </span>{a.observations}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
