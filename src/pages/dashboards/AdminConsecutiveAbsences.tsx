import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  BedDouble,
  Search,
  CheckCircle2,
  FileDown,
  Phone,
  Calendar,
  ChevronDown,
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
  // Default filter is 'active' (En cours)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("active");
  // Expandable items state for mobile space saving
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
    <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild>
            <Link to="/admin/absences"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Absences Consécutives
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Étudiants absents 3 jours consécutifs ou plus
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportPDF}
          disabled={loading || filtered.length === 0}
          className="h-9 text-xs sm:text-sm gap-2 self-start sm:self-auto shrink-0 font-medium"
        >
          <FileDown className="h-4 w-4" /> Exporter PDF
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10 h-10 text-sm"
            placeholder="Rechercher par étudiant, chambre, dortoir..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 sm:flex items-center gap-1.5 bg-muted/80 p-1 rounded-lg border shrink-0">
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "ghost"}
            className={`text-xs sm:text-sm h-8 px-3 font-medium transition-all ${
              statusFilter === "active" ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs" : ""
            }`}
            onClick={() => setStatusFilter("active")}
          >
            En cours ({activeCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "completed" ? "default" : "ghost"}
            className="text-xs sm:text-sm h-8 px-3 font-medium"
            onClick={() => setStatusFilter("completed")}
          >
            Historique ({completedCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "ghost"}
            className="text-xs sm:text-sm h-8 px-3 font-medium"
            onClick={() => setStatusFilter("all")}
          >
            Tous ({totalCount})
          </Button>
        </div>
      </div>

      {/* List / Groups */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border rounded-xl bg-card text-muted-foreground">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-foreground text-base">
            {statusFilter === "active" ? "Aucune alerte en cours" : "Aucun enregistrement trouvé"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {statusFilter === "active"
              ? "Aucun étudiant n'est actuellement en situation d'absence de 3 nuits consécutives ou plus."
              : "Aucune absence ne correspond à vos critères de recherche."}
          </p>
          {statusFilter === "active" && totalCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs font-medium"
              onClick={() => setStatusFilter("all")}
            >
              Consulter l'historique ({totalCount})
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([code, groupList]) => {
              const activeInGroup = groupList.filter((g) => g.isActive).length;

              return (
                <Card key={code} className="border shadow-sm overflow-hidden">
                  {/* Big, Clear Dortoir Header */}
                  <CardHeader className="py-4 px-4 sm:px-6 bg-muted/40 border-b flex flex-row items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <BedDouble className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                          Dortoir {code}
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          {groupList.length} enregistrement{groupList.length > 1 ? "s" : ""}
                          {activeInGroup > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1.5">
                              · {activeInGroup} alerte{activeInGroup > 1 ? "s" : ""} en cours
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {activeInGroup > 0 && (
                      <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1.5 text-xs py-1 px-2.5 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        {activeInGroup} en cours
                      </Badge>
                    )}
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* Mobile View: Space-saving click-to-expand list */}
                    <div className="divide-y divide-border md:hidden">
                      {groupList.map((item, idx) => {
                        const itemKey = `${item.studentId}-${item.start}-${item.end}`;
                        const isExpanded = expandedIds.has(itemKey);

                        return (
                          <div
                            key={idx}
                            className={`transition-colors ${
                              item.isActive ? "bg-amber-500/5" : ""
                            }`}
                          >
                            {/* Clickable compact row */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(itemKey)}
                              className="w-full text-left p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors focus:outline-hidden"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-foreground">
                                    {item.nom_complet}
                                  </span>
                                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                    Ch. {item.chambreNumero}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {isExpanded ? "Masquer les détails" : "Toucher pour voir les dates & téléphone"}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                    item.isActive
                                      ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {item.isActive && <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                                  {item.count} nuits
                                </span>

                                <ChevronDown
                                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                                    isExpanded ? "rotate-180 text-foreground" : ""
                                  }`}
                                />
                              </div>
                            </button>

                            {/* Expanded Details: Dates & Phone */}
                            {isExpanded && (
                              <div className="px-3.5 pb-3.5 pt-1 border-t border-dashed border-border/80 bg-muted/20 space-y-2 text-xs">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                                  <span className="font-medium text-foreground">Période d'absence :</span>
                                  <span className="font-mono text-foreground font-semibold">
                                    Du {format(new Date(item.start), "dd/MM/yyyy")} au {format(new Date(item.end), "dd/MM/yyyy")}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-primary shrink-0" />
                                  <span className="font-medium text-foreground">Téléphone :</span>
                                  {item.telephone ? (
                                    <a
                                      href={`tel:${item.telephone}`}
                                      className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-md text-xs"
                                    >
                                      Appeler {item.telephone}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">Aucun numéro enregistré</span>
                                  )}
                                </div>

                                <div className="pt-0.5">
                                  {item.isActive ? (
                                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 text-[11px]">
                                      <AlertTriangle className="h-2.5 w-2.5" /> Alerte active : absent jusqu'au dernier pointage
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
                                      <CheckCircle2 className="h-2.5 w-2.5" /> Absence archivée
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop View: Clean, spacious table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-bold text-xs uppercase tracking-wider py-3.5 px-4">Étudiant</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider py-3.5 px-4">Chambre</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider py-3.5 px-4">Téléphone</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider py-3.5 px-4">Nuits</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider py-3.5 px-4">Période d'absence</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider py-3.5 px-4">Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupList.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/40 transition-colors">
                              <TableCell className="font-semibold text-sm py-3.5 px-4 text-foreground">
                                {item.nom_complet}
                              </TableCell>
                              <TableCell className="py-3.5 px-4 font-medium text-sm">
                                <span className="px-2 py-0.5 bg-muted rounded font-mono text-xs">
                                  Ch. {item.chambreNumero}
                                </span>
                              </TableCell>
                              <TableCell className="py-3.5 px-4 text-sm">
                                {item.telephone ? (
                                  <a href={`tel:${item.telephone}`} className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium">
                                    <Phone className="h-3 w-3" />
                                    {item.telephone}
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground italic text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                    item.isActive
                                      ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                      : "bg-muted text-muted-foreground border-border"
                                  }`}
                                >
                                  {item.isActive && <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                                  {item.count} nuits
                                </span>
                              </TableCell>
                              <TableCell className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                                Du {format(new Date(item.start), "dd-MM-yyyy")} au {format(new Date(item.end), "dd-MM-yyyy")}
                              </TableCell>
                              <TableCell className="py-3.5 px-4">
                                {item.isActive ? (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1.5 text-xs py-1 px-2.5 font-semibold">
                                    <AlertTriangle className="h-3 w-3" /> En cours
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground gap-1.5 text-xs py-1 px-2.5">
                                    <CheckCircle2 className="h-3 w-3" /> Terminée
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
              );
            })}
        </div>
      )}
    </div>
  );
}
