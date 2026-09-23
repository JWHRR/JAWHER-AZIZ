import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft } from "lucide-react";
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
      
      const survIds = Array.from(new Set((absData || []).map((x: any) => x.surveillant_id)));
      let nameById: Record<string, string> = {};
      if (survIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", survIds);
        nameById = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }

      const enriched = (absData || []).map(a => ({
        ...a,
        surveillant_name: nameById[a.surveillant_id] || "—"
      }));

      setAbsences(enriched);
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
          <h1 className="text-3xl font-bold">Liste des Absences</h1>
          <p className="text-muted-foreground mt-1">Vue détaillée pour l'administration</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="date" className="text-sm">Date :</Label>
        <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Absences du {format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })}</CardTitle>
          <CardDescription>{absences.reduce((acc, curr) => acc + (curr.nombre_absents || 0), 0)} absent(s) au total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : absences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune absence enregistrée pour cette date.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Dortoir</TableHead>
                    <TableHead>Surveillant</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Noms des absents</TableHead>
                    <TableHead>Observations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium whitespace-nowrap">Dortoir {a.dortoirs?.code}</TableCell>
                      <TableCell className="whitespace-nowrap">{a.surveillant_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center bg-warning/20 text-warning-foreground px-2.5 py-0.5 rounded-full text-xs font-bold">
                          {a.nombre_absents}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm max-w-[200px] leading-relaxed">
                        {a.noms_absents || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.observations || "—"}
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
