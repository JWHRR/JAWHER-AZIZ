import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Phone,
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("active");

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
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Genere le : ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 21);
    doc.text(`Filtre : ${statusFilter === "active" ? "En cours" : statusFilter === "completed" ? "Historique" : "Tous"} (${filtered.length} enregistrements)`, 14, 26);

    const tableRows = filtered.map((item) => [
      item.nom_complet,
      item.telephone || "-",
      `D. ${item.dortoirCode} - Ch. ${item.chambreNumero}`,
      `${item.count} nuits`,
      `Du ${format(new Date(item.start), "dd/MM/yyyy")} au ${format(new Date(item.end), "dd/MM/yyyy")}`,
      item.isActive ? "En cours" : "Terminee",
    ]);

    autoTable(doc, {
      head: [["Etudiant", "Telephone", "Affectation", "Duree", "Periode", "Statut"]],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [217, 119, 6] },
    });

    doc.save(`Absences_Consecutives_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("PDF exporté avec succès.");
  };

  return (
    <div className="space-y-3.5 max-w-4xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link to="/admin/absences"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Absences Consécutives
            </h1>
            <p className="text-muted-foreground text-xs">
              Étudiants absents 3 jours consécutifs ou plus
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportPDF}
          disabled={loading || filtered.length === 0}
          className="h-8 text-xs gap-1.5 self-start sm:self-auto shrink-0"
        >
          <FileDown className="h-3.5 w-3.5" /> Exporter PDF
        </Button>
      </div>

      {/* Compact Search & Segmented Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8.5 h-8 text-xs"
            placeholder="Rechercher étudiant, chambre, dortoir..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-muted/60 p-0.5 rounded-md shrink-0 border">
          <button
            type="button"
            className={`px-2.5 py-1 text-xs rounded transition-all font-medium flex items-center justify-center gap-1.5 ${
              statusFilter === "active"
                ? "bg-background text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setStatusFilter("active")}
          >
            <span>En cours</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                statusFilter === "active"
                  ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            className={`px-2.5 py-1 text-xs rounded transition-all font-medium flex items-center justify-center gap-1.5 ${
              statusFilter === "completed"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setStatusFilter("completed")}
          >
            <span>Historique</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-bold">
              {completedCount}
            </span>
          </button>

          <button
            type="button"
            className={`px-2.5 py-1 text-xs rounded transition-all font-medium flex items-center justify-center gap-1.5 ${
              statusFilter === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setStatusFilter("all")}
          >
            <span>Tous</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-bold">
              {totalCount}
            </span>
          </button>
        </div>
      </div>

      {/* List / Groups */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center border rounded-lg bg-card text-muted-foreground text-xs">
          <AlertTriangle className="h-6 w-6 text-muted-foreground/40 mb-1.5" />
          <p className="font-semibold text-foreground text-sm">
            {statusFilter === "active" ? "Aucune alerte en cours" : "Aucun enregistrement trouvé"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
            {statusFilter === "active"
              ? "Aucun étudiant n'est actuellement absent depuis 3 nuits consécutives ou plus."
              : "Aucune absence ne correspond à vos critères."}
          </p>
          {statusFilter === "active" && totalCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2.5 text-xs h-7"
              onClick={() => setStatusFilter("all")}
            >
              Voir l'historique ({totalCount})
            </Button>
          )}
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, groupList]) => (
            <Card key={code} className="border shadow-2xs overflow-hidden">
              <CardHeader className="py-2 px-3 sm:px-4 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" /> Dortoir {code}
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">
                  {groupList.length} cas
                </span>
              </CardHeader>

              <CardContent className="p-0">
                {/* Mobile View: Clean compact list rows */}
                <div className="divide-y md:hidden">
                  {groupList.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground text-sm truncate">{item.nom_complet}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">Ch. {item.chambreNumero}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                          <span>Du {format(new Date(item.start), "dd/MM")} au {format(new Date(item.end), "dd/MM")}</span>
                          {item.telephone && (
                            <>
                              <span>·</span>
                              <a href={`tel:${item.telephone}`} className="text-primary hover:underline inline-flex items-center gap-0.5">
                                <Phone className="h-2.5 w-2.5" /> {item.telephone}
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            item.isActive
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.isActive && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
                          {item.count} nuits
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.isActive ? "En cours" : "Archivée"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View: Compact Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40 text-xs">
                      <TableRow>
                        <TableHead className="py-2">Étudiant</TableHead>
                        <TableHead className="py-2">Téléphone</TableHead>
                        <TableHead className="py-2">Chambre</TableHead>
                        <TableHead className="py-2">Nuits</TableHead>
                        <TableHead className="py-2">Période</TableHead>
                        <TableHead className="py-2">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {groupList.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-semibold py-2">{item.nom_complet}</TableCell>
                          <TableCell className="py-2">
                            {item.telephone ? (
                              <a href={`tel:${item.telephone}`} className="text-primary hover:underline">
                                {item.telephone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2">Ch. {item.chambreNumero}</TableCell>
                          <TableCell className="py-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                                item.isActive
                                  ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {item.isActive && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                              {item.count} nuits
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs py-2 text-muted-foreground">
                            Du {format(new Date(item.start), "dd-MM-yyyy")} au {format(new Date(item.end), "dd-MM-yyyy")}
                          </TableCell>
                          <TableCell className="py-2">
                            {item.isActive ? (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 text-[11px] py-0">
                                <AlertTriangle className="h-2.5 w-2.5" /> En cours
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px] py-0">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Archivée
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
