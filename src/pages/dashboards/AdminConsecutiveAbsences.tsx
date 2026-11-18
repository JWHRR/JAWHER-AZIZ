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
  Users,
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
  // Default filter is 'active' (En cours) as requested
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
    doc.text(`Filtre : ${statusFilter === "active" ? "En cours" : statusFilter === "completed" ? "Historique" : "Tous"}`, 14, 27);
    doc.text(`Total enregistrements : ${filtered.length}`, 14, 32);

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
      startY: 37,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 158, 11] },
    });

    doc.save(`Absences_Consecutives_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("PDF exporté avec succès.");
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" asChild>
            <Link to="/admin/absences"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              Absences Consécutives
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Suivi et alertes des absences de 3 nuits consécutives et plus
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportPDF}
          disabled={loading || filtered.length === 0}
          className="gap-2 w-full sm:w-auto h-9 self-stretch sm:self-auto shrink-0"
        >
          <FileDown className="h-4 w-4" /> Exporter PDF
        </Button>
      </div>

      {/* KPI Stats Cards - Mobile optimized 3-grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card
          className={`cursor-pointer transition-all ${
            statusFilter === "active"
              ? "ring-2 ring-amber-500 border-amber-500 bg-amber-500/5 shadow-xs"
              : "hover:border-amber-500/50"
          }`}
          onClick={() => setStatusFilter("active")}
        >
          <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-1">
            <div>
              <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 uppercase font-semibold leading-tight">
                En cours
              </p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5 text-amber-600 dark:text-amber-400">
                {activeCount}
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 sm:h-7 sm:w-7 text-amber-500 shrink-0" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            statusFilter === "completed"
              ? "ring-2 ring-muted-foreground border-muted-foreground bg-muted/30 shadow-xs"
              : "hover:border-border"
          }`}
          onClick={() => setStatusFilter("completed")}
        >
          <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-1">
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold leading-tight">
                Historique
              </p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5 text-muted-foreground">
                {completedCount}
              </p>
            </div>
            <History className="h-5 w-5 sm:h-7 sm:w-7 text-muted-foreground/70 shrink-0" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            statusFilter === "all"
              ? "ring-2 ring-primary border-primary bg-primary/5 shadow-xs"
              : "hover:border-primary/50"
          }`}
          onClick={() => setStatusFilter("all")}
        >
          <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-1">
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold leading-tight">
                Total
              </p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5">
                {totalCount}
              </p>
            </div>
            <Users className="h-5 w-5 sm:h-7 sm:w-7 text-primary/70 shrink-0" />
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9 sm:h-10 text-sm"
            placeholder="Rechercher par étudiant, chambre, dortoir..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-muted p-1 rounded-lg w-full sm:w-auto shrink-0">
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "ghost"}
            className="text-xs h-8 px-2 sm:px-3 font-medium"
            onClick={() => setStatusFilter("active")}
          >
            En cours ({activeCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "completed" ? "default" : "ghost"}
            className="text-xs h-8 px-2 sm:px-3 font-medium"
            onClick={() => setStatusFilter("completed")}
          >
            Historique ({completedCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "ghost"}
            className="text-xs h-8 px-2 sm:px-3 font-medium"
            onClick={() => setStatusFilter("all")}
          >
            Tous ({totalCount})
          </Button>
        </div>
      </div>

      {/* List / Groups */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 px-4 text-center text-muted-foreground text-sm">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="font-semibold text-foreground">
              {statusFilter === "active" ? "Aucune alerte en cours" : "Aucun enregistrement trouvé"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {statusFilter === "active"
                ? "Il n'y a actuellement aucun étudiant absent depuis 3 nuits consécutives ou plus."
                : "Aucune absence consécutive ne correspond à vos critères de recherche."}
            </p>
            {statusFilter === "active" && totalCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={() => setStatusFilter("all")}
              >
                Voir tous les enregistrements ({totalCount})
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, groupList]) => (
            <Card key={code} className="border-l-4 border-l-amber-500 shadow-xs">
              <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3 border-b">
                <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> Dortoir {code}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {groupList.length} enregistrement(s)
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {groupList.filter((g) => g.isActive).length} alerte(s) active(s) · {groupList.filter((g) => !g.isActive).length} historique(s)
                </CardDescription>
              </CardHeader>

              <CardContent className="p-3 sm:p-4">
                {/* Mobile View: Clean, high-density cards */}
                <div className="space-y-2.5 md:hidden">
                  {groupList.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs space-y-2 ${
                        item.isActive
                          ? "bg-amber-500/5 border-amber-500/30"
                          : "bg-muted/20 border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{item.nom_complet}</p>
                          <p className="text-muted-foreground text-[11px] mt-0.5">
                            Chambre {item.chambreNumero} · Dortoir {item.dortoirCode}
                          </p>
                        </div>
                        {item.isActive ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 text-[11px] shrink-0">
                            <AlertTriangle className="h-3 w-3" /> En cours
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px] shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> Archivée
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-[11px]">
                        <span
                          className={`font-semibold inline-flex items-center gap-1 ${
                            item.isActive ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                          }`}
                        >
                          {item.isActive && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          {item.count} nuits consécutives
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {format(new Date(item.start), "dd/MM")} → {format(new Date(item.end), "dd/MM/yyyy")}
                        </span>
                      </div>

                      {item.telephone && (
                        <div className="pt-0.5">
                          <a
                            href={`tel:${item.telephone}`}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline text-[11px] font-medium"
                          >
                            <Phone className="h-3 w-3" />
                            {item.telephone}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop View: Full Table */}
                <div className="hidden md:block rounded-md border overflow-x-auto">
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
                            {item.telephone ? (
                              <a href={`tel:${item.telephone}`} className="text-primary hover:underline">
                                {item.telephone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">-</span>
                            )}
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
