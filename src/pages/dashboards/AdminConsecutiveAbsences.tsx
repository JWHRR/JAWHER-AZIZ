import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Search,
  CheckCircle2,
  FileDown,
  History,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calculateConsecutiveAbsences,
  persistConsecutiveRecords,
  ConsecutiveAbsenceRecord,
} from "@/lib/consecutiveAbsences";

export default function AdminConsecutiveAbsences() {
  const [list, setList] = useState<ConsecutiveAbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: students, error: stuError } = await supabase
        .from("etudiants")
        .select(`
          id, nom_complet, telephone, chambre_id, autorisation_absence,
          chambres!inner (numero, dortoir_id, dortoirs!inner (id, code))
        `);
      if (stuError) throw stuError;
      if (!students) return;

      const { data: pastAbs, error: absError } = await supabase
        .from("absences")
        .select("dortoir_id, date, noms_absents")
        .order("date", { ascending: false });
      if (absError) throw absError;
      if (!pastAbs) return;

      const records = calculateConsecutiveAbsences(students, pastAbs);
      setList(records);

      // Background persist to keep records permanently in DB table if available
      persistConsecutiveRecords(records);
    } catch (err: any) {
      toast.error("Erreur de chargement: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCount = list.length;
  const activeCount = list.filter((item) => item.isActive).length;
  const completedCount = list.filter((item) => !item.isActive).length;

  const filtered = list.filter((item) => {
    const matchesFilter =
      statusFilter === "all" ||
      (statusFilter === "active" && item.isActive) ||
      (statusFilter === "completed" && !item.isActive);
    if (!matchesFilter) return false;

    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      (item.nom_complet || "").toLowerCase().includes(query) ||
      (item.chambreNumero || "").toLowerCase().includes(query) ||
      (item.dortoirCode || "").toLowerCase().includes(query)
    );
  });

  const grouped: Record<string, ConsecutiveAbsenceRecord[]> = {};
  filtered.forEach((item) => {
    const code = item.dortoirCode || "Inconnu";
    if (!grouped[code]) grouped[code] = [];
    grouped[code].push(item);
  });

  const exportPDF = () => {
    if (filtered.length === 0) {
      toast.error("Aucune donnée à exporter.");
      return;
    }
    const doc = new jsPDF();
    const title = "Registre des Absences Consecutives (3+ Nuits)";
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Genere le : ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);
    doc.text(`Total enregistrements : ${filtered.length}`, 14, 27);

    const tableRows = filtered.map((item) => [
      item.nom_complet,
      item.telephone || "-",
      `Dortoir ${item.dortoirCode} - Ch. ${item.chambreNumero}`,
      `${item.count} nuits`,
      `Du ${format(new Date(item.start), "dd/MM/yyyy")} au ${format(new Date(item.end), "dd/MM/yyyy")}`,
      item.isActive ? "En cours" : "Terminee",
    ]);

    autoTable(doc, {
      head: [["Etudiant", "Telephone", "Affectation", "Duree", "Periode", "Statut"]],
      body: tableRows,
      startY: 32,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 158, 11] },
    });

    doc.save(`Absences_Consecutives_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("PDF exporté avec succès.");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/admin/absences"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Absences Consécutives (Administration)</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Registre permanent de chaque absence de 3 jours consécutifs et plus
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPDF} disabled={loading || filtered.length === 0} className="gap-2">
            <FileDown className="h-4 w-4" /> Exporter PDF
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "all" ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"}`}
          onClick={() => setStatusFilter("all")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Enregistrements</p>
              <p className="text-2xl font-bold mt-1">{totalCount}</p>
            </div>
            <Users className="h-7 w-7 text-primary/70" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === "active" ? "ring-2 ring-amber-500 border-amber-500" : "hover:border-amber-500/50"}`}
          onClick={() => setStatusFilter("active")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400 uppercase font-medium">En Cours (Actives)</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{activeCount}</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === "completed" ? "ring-2 ring-muted-foreground border-muted-foreground" : "hover:border-border"}`}
          onClick={() => setStatusFilter("completed")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Historique (Terminées)</p>
              <p className="text-2xl font-bold mt-1 text-muted-foreground">{completedCount}</p>
            </div>
            <History className="h-7 w-7 text-muted-foreground/70" />
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher par étudiant, numéro de chambre ou dortoir..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted p-1 rounded-lg">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "ghost"}
            className="text-xs h-8"
            onClick={() => setStatusFilter("all")}
          >
            Tous ({totalCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "ghost"}
            className="text-xs h-8"
            onClick={() => setStatusFilter("active")}
          >
            En cours ({activeCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "completed" ? "default" : "ghost"}
            className="text-xs h-8"
            onClick={() => setStatusFilter("completed")}
          >
            Historique ({completedCount})
          </Button>
        </div>
      </div>

      {/* List / Groups */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground italic">
            Aucun enregistrement d'absence consécutive correspondant.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, groupList]) => (
            <Card key={code} className="border-l-4 border-l-amber-500 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" /> Dortoir {code}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {groupList.length} enregistrement(s)
                  </span>
                </CardTitle>
                <CardDescription>
                  {groupList.filter((g) => g.isActive).length} alerte(s) active(s) · {groupList.filter((g) => !g.isActive).length} historique(s)
                </CardDescription>
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
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupList.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-accent/40">
                          <TableCell className="font-semibold py-3">{item.nom_complet}</TableCell>
                          <TableCell className="py-3">
                            {item.telephone || <span className="text-muted-foreground italic">-</span>}
                          </TableCell>
                          <TableCell className="py-3">Chambre {item.chambreNumero}</TableCell>
                          <TableCell className="py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                item.isActive
                                  ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {item.isActive && <AlertTriangle className="h-3 w-3 animate-bounce" />}
                              {item.count} nuits
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs py-3 text-muted-foreground">
                            Du {format(new Date(item.start), "dd-MM-yyyy")} au {format(new Date(item.end), "dd-MM-yyyy")}
                          </TableCell>
                          <TableCell className="py-3">
                            {item.isActive ? (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 text-xs">
                                <AlertTriangle className="h-3 w-3" /> En cours
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" /> Archivée
                              </Badge>
                            )}
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
