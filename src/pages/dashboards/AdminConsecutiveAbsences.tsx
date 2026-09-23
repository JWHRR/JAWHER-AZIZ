import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, AlertTriangle, CalendarDays, Search } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminConsecutiveAbsences() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const getPreviousBusinessDay = (d: Date): Date => {
    let prev = subDays(d, 1);
    while (prev.getDay() === 0 || prev.getDay() === 6) {
      prev = subDays(prev, 1);
    }
    return prev;
  };

  const findStreaks = (dates: string[]) => {
    if (dates.length === 0) return [];
    const weekdayDates = dates.filter(d => {
      const day = new Date(d).getDay();
      return day !== 0 && day !== 6;
    });
    if (weekdayDates.length === 0) return [];
    
    const sorted = [...new Set(weekdayDates)].sort((a, b) => b.localeCompare(a));
    const streaks: { count: number; start: string; end: string }[] = [];
    let currentStreak: string[] = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const currentDateStr = sorted[i];
      if (currentStreak.length === 0) {
        currentStreak.push(currentDateStr);
      } else {
        const lastDate = new Date(currentStreak[currentStreak.length - 1]);
        const expectedPrevDate = format(getPreviousBusinessDay(lastDate), "yyyy-MM-dd");
        
        if (currentDateStr === expectedPrevDate) {
          currentStreak.push(currentDateStr);
        } else {
          if (currentStreak.length >= 3) {
            streaks.push({
              count: currentStreak.length,
              start: currentStreak[currentStreak.length - 1],
              end: currentStreak[0]
            });
          }
          currentStreak = [currentDateStr];
        }
      }
    }
    
    if (currentStreak.length >= 3) {
      streaks.push({
        count: currentStreak.length,
        start: currentStreak[currentStreak.length - 1],
        end: currentStreak[0]
      });
    }
    return streaks;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: students } = await supabase
          .from("etudiants")
          .select(
            id, nom_complet, telephone, chambre_id, autorisation_absence,
            chambres!inner (numero, dortoir_id, dortoirs!inner (id, code))
          );
        if (!students) return;

        const { data: pastAbs } = await supabase
          .from("absences")
          .select("dortoir_id, date, noms_absents")
          .order("date", { ascending: false });
        if (!pastAbs) return;

        const latestChecklistDateByDortoir: Record<string, string> = {};
        pastAbs.forEach(a => {
          if (!latestChecklistDateByDortoir[a.dortoir_id] || a.date > latestChecklistDateByDortoir[a.dortoir_id]) {
            latestChecklistDateByDortoir[a.dortoir_id] = a.date;
          }
        });

        const results: any[] = [];
        students.forEach((stu: any) => {
          if (stu.autorisation_absence) return;
          const dortoirId = stu.chambres?.dortoirs?.id;
          const dortoirCode = stu.chambres?.dortoirs?.code;
          const chambreNum = stu.chambres?.numero;
          if (!dortoirId) return;

          const latestChecklistDate = latestChecklistDateByDortoir[dortoirId];
          if (!latestChecklistDate) return;

          const studentAbsenceDates = pastAbs
            .filter(a => a.dortoir_id === dortoirId)
            .filter(a => {
              const namesList = (a.noms_absents || "").split("\n").map((n: string) => n.trim().toLowerCase());
              return namesList.includes(stu.nom_complet.trim().toLowerCase());
            })
            .map(a => a.date);

          const streaks = findStreaks(studentAbsenceDates);
          streaks.forEach(streak => {
            if (streak.end !== latestChecklistDate) return;
            results.push({
              studentId: stu.id, nom_complet: stu.nom_complet, telephone: stu.telephone,
              dortoirId, dortoirCode, chambreNumero: chambreNum,
              count: streak.count, start: streak.start, end: streak.end
            });
          });
        });

        results.sort((a, b) => b.end.localeCompare(a.end));
        setList(results);
      } catch (err: any) {
        toast.error("Erreur de chargement: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = list.filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (item.nom_complet || "").toLowerCase().includes(query) || (item.chambreNumero || "").toLowerCase().includes(query);
  });

  const grouped: Record<string, any[]> = {};
  filtered.forEach(item => {
    const code = item.dortoirCode || "Inconnu";
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push(item);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="outline" size="icon" asChild>
          <Link to="/admin/absences"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Absences Consécutives (Administration)</h1>
          <p className="text-muted-foreground mt-1 text-sm">Alerte des étudiants absents 3 nuits ou plus</p>
        </div>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher un étudiant par nom ou numéro de chambre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground italic">
            Aucune absence consécutive détectée.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, groupList]) => (
            <Card key={code} className="border-l-4 border-l-amber-500 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" /> Dortoir {code}
                </CardTitle>
                <CardDescription>{groupList.length} alerte(s) active(s)</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Étudiant</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Chambre</TableHead>
                        <TableHead>Nuits</TableHead>
                        <TableHead>Période</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupList.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-accent/40">
                          <TableCell className="font-semibold py-3">{item.nom_complet}</TableCell>
                          <TableCell className="py-3">{item.telephone || <span className="text-muted-foreground italic">-</span>}</TableCell>
                          <TableCell className="py-3">Chambre {item.chambreNumero}</TableCell>
                          <TableCell className="py-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200/50">
                              <AlertTriangle className="h-3 w-3 animate-bounce" /> {item.count} nuits
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs py-3 text-muted-foreground">
                            Du {format(new Date(item.start), "dd-MM-yyyy")} au {format(new Date(item.end), "dd-MM-yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))
      )}
    </div>
  );
}
