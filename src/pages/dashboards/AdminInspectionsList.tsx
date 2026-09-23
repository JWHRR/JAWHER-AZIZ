import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate, parseLocalDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";

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
        .select(`
          *,
          chambres(
            numero,
            dortoirs(code)
          )
        `)
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

      // Sort by dortoir, then chambre
      enriched.sort((a, b) => {
        if (a.dortoir_code !== b.dortoir_code) return a.dortoir_code.localeCompare(b.dortoir_code);
        return a.chambre_numero.localeCompare(b.chambre_numero);
      });

      setInspections(enriched);
      setLoading(false);
    };
    load();
  }, [date]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="outline" size="icon" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Liste des Inspections</h1>
          <p className="text-muted-foreground mt-1">Vue détaillée pour l'administration</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="date" className="text-sm">Date :</Label>
        <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inspections du {format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })}</CardTitle>
          <CardDescription>{inspections.length} inspection(s) réalisée(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune inspection enregistrée pour cette date.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Dortoir / Chambre</TableHead>
                    <TableHead>Surveillant</TableHead>
                    <TableHead>Propreté</TableHead>
                    <TableHead>Ordre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Observations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        D. {i.dortoir_code} / Ch. {i.chambre_numero}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{i.surveillant_name}</TableCell>
                      <TableCell>{i.proprete} / 5</TableCell>
                      <TableCell>{i.ordre} / 5</TableCell>
                      <TableCell>
                        {i.degats ? (
                          <Badge variant="destructive" className="flex w-fit items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Dégâts
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-success border-success/30 bg-success/10">RAS</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px]">
                        {i.observations || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
