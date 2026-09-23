import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, AlertTriangle, Star, User, DoorOpen, CheckCircle2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate, parseLocalDate } from "@/lib/time";

const Stars = ({ n }: { n: number }) => (
  <span className="inline-flex">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`h-3 w-3 ${i <= n ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
    ))}
  </span>
);

export default function AdminInspectionsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || format(subDays(getBusinessDate(), 1), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<any[]>([]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: insData } = await supabase
        .from("chambre_inspections")
        .select(`*, chambres(numero, dortoirs(code))`)
        .eq("date", date)
        .order("created_at", { ascending: false });

      const survIds = Array.from(new Set((insData || []).map((x: any) => x.surveillant_id)));
      let nameById: Record<string, string> = {};
      if (survIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", survIds);
        nameById = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }

      const enriched = (insData || []).map(i => ({
        ...i,
        surveillant_name: nameById[i.surveillant_id] || "—",
        dortoir_code: i.chambres?.dortoirs?.code || "?",
        chambre_numero: i.chambres?.numero || "?",
      }));

      enriched.sort((a, b) => {
        if (a.dortoir_code !== b.dortoir_code) return a.dortoir_code.localeCompare(b.dortoir_code);
        return a.chambre_numero.localeCompare(b.chambre_numero);
      });

      setInspections(enriched);
      setLoading(false);
    };
    load();
  }, [date]);

  const withDegats = inspections.filter(i => i.degats).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="outline" size="icon" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Liste des Inspections</h1>
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
            Inspections du {format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full text-xs">
              <DoorOpen className="h-3.5 w-3.5" />
              {inspections.length} inspection(s)
            </span>
            {withDegats > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive font-semibold px-2.5 py-1 rounded-full text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                {withDegats} avec dégâts
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune inspection enregistrée pour cette date.</p>
          ) : (
            <div className="space-y-3">
              {inspections.map((i) => (
                <div
                  key={i.id}
                  className={`rounded-xl border p-4 space-y-3 ${i.degats ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"}`}
                >
                  {/* Header: chambre + status badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4 text-info shrink-0" />
                      <span className="font-semibold text-sm">Dortoir {i.dortoir_code} · Chambre {i.chambre_numero}</span>
                    </div>
                    {i.degats ? (
                      <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
                        <AlertTriangle className="h-3 w-3" /> Dégâts
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-success border-success/40 bg-success/10 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> RAS
                      </Badge>
                    )}
                  </div>

                  {/* Surveillant */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{i.surveillant_name}</span>
                  </div>

                  {/* Scores */}
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium w-16">Propreté</span>
                      <Stars n={i.proprete} />
                      <span className="text-muted-foreground">({i.proprete}/5)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium w-16">Ordre</span>
                      <Stars n={i.ordre} />
                      <span className="text-muted-foreground">({i.ordre}/5)</span>
                    </div>
                  </div>

                  {/* Observations */}
                  {i.observations && i.observations !== "RAS" && (
                    <div className="text-xs text-muted-foreground bg-background rounded-lg px-3 py-2 border">
                      <span className="font-semibold text-foreground">Obs. : </span>{i.observations}
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
