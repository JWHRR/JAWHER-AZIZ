import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, FileDown, Edit, Trash2, ArrowLeft, Check, Car, Search } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

export default function Etudiants() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [etudiants, setEtudiants] = useState<any[]>([]);
  
  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState({ 
    id: "", 
    nom_complet: "", 
    telephone: "",
    autorisation_absence: false,
    autorisation_voiture: false,
    matricule_voiture: ""
  });
  const [selectedDortoir, setSelectedDortoir] = useState<string | null>(null);
  const [assignedDortoirs, setAssignedDortoirs] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);

    if (!isAdmin) {
      const { data } = await supabase
        .from("dortoir_assignments")
        .select("dortoirs(code)")
        .eq("surveillant_id", user.id);
      setAssignedDortoirs((data || []).map((d: any) => d.dortoirs?.code).filter(Boolean));
    }
    
    // We need to fetch etudiants with chambre number and dortoir code
    let query = supabase
      .from("etudiants")
      .select(`
        *,
        chambres (
          numero,
          dortoirs (
            id,
            code
          )
        )
      `)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
    } else {
      // Map data to a flat structure for the table
      const formattedData = (data || []).map((e: any) => ({
        ...e,
        chambre_numero: e.chambres?.numero || "?",
        dortoir_code: e.chambres?.dortoirs?.code || "?",
      }));
      // Sort by dortoir code, then chambre numero
      formattedData.sort((a, b) => {
        if (a.dortoir_code !== b.dortoir_code) return a.dortoir_code.localeCompare(b.dortoir_code);
        return a.chambre_numero.localeCompare(b.chambre_numero);
      });
      setEtudiants(formattedData);
    }
    
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEditDialog = (etudiant: any) => {
    setEditForm({
      id: etudiant.id,
      nom_complet: etudiant.nom_complet,
      telephone: etudiant.telephone || "",
      autorisation_absence: etudiant.autorisation_absence || false,
      autorisation_voiture: etudiant.autorisation_voiture || false,
      matricule_voiture: etudiant.matricule_voiture || "",
    });
    setOpenEdit(true);
  };

  const updateEtudiant = async () => {
    if (!editForm.nom_complet.trim()) { toast.error("Le nom complet est requis"); return; }
    
    const { error } = await supabase.from("etudiants").update({
      nom_complet: editForm.nom_complet.trim(),
      telephone: editForm.telephone.trim() || null,
      autorisation_absence: editForm.autorisation_absence,
      autorisation_voiture: editForm.autorisation_voiture,
      matricule_voiture: editForm.autorisation_voiture ? editForm.matricule_voiture.trim() : "",
    }).eq("id", editForm.id);

    if (error) { toast.error(error.message); return; }
    
    toast.success("Informations mises à jour");
    setOpenEdit(false);
    load();
  };

  const deleteEtudiant = async (id: string, nom: string) => {
    if (!confirm(`Supprimer l'étudiant ${nom} ?`)) return;
    
    const { error } = await supabase.from("etudiants").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    
    toast.success("Étudiant supprimé");
    load();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const dateStr = format(new Date(), "dd/MM/yyyy", { locale: fr });
    
    doc.setFontSize(16);
    doc.text("Liste des Étudiants", 14, 15);
    doc.setFontSize(10);
    doc.text(`Généré le: ${dateStr}`, 14, 22);

    const tableColumn = ["Dortoir", "Chambre", "Nom Complet", "Téléphone"];
    const tableRows = etudiants.map(e => [
      `Dortoir ${e.dortoir_code}`,
      `Chambre ${e.chambre_numero}`,
      e.nom_complet,
      e.telephone || "-"
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Liste_Etudiants_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const searchedStudents = etudiants.filter((e) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      e.nom_complet.toLowerCase().includes(query) ||
      e.chambre_numero.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Liste des Étudiants
          </h1>
          <p className="text-muted-foreground mt-1">Gérez les étudiants et exportez la liste</p>
        </div>
        <div>
          <Button onClick={exportPDF} disabled={loading || etudiants.length === 0}>
            <FileDown className="h-4 w-4 mr-2" /> Exporter en PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            className="pl-9" 
            placeholder="Rechercher un étudiant par nom ou numéro de chambre..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : etudiants.length === 0 ? (
        <Card>
          <CardContent className="text-center p-12 text-muted-foreground italic">
            Aucun étudiant trouvé. Ajoutez-les via la gestion des chambres.
          </CardContent>
        </Card>
      ) : search.trim() !== "" ? (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg">Résultats de recherche</CardTitle>
            <CardDescription>{searchedStudents.length} étudiant(s) trouvé(s)</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Dortoir</TableHead>
                    <TableHead className="w-[100px]">Chambre</TableHead>
                    <TableHead>Nom Complet</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchedStudents.map((e) => {
                    const canEdit = isAdmin || assignedDortoirs.includes(e.dortoir_code);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-semibold py-2">Dortoir {e.dortoir_code}</TableCell>
                        <TableCell className="font-medium py-2">{e.chambre_numero}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{e.nom_complet}</span>
                            {(e.autorisation_absence || e.autorisation_voiture) && (
                              <div className="flex gap-1.5 flex-wrap">
                                {e.autorisation_absence && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50">
                                    <Check className="h-2.5 w-2.5" /> Abs. Autorisée
                                  </span>
                                )}
                                {e.autorisation_voiture && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200/50">
                                    <Car className="h-2.5 w-2.5 flex-shrink-0" /> Voiture: {e.matricule_voiture || "—"}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">{e.telephone || <span className="text-muted-foreground italic">-</span>}</TableCell>
                        <TableCell className="text-right py-2">
                          {canEdit ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(e)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteEtudiant(e.id, e.nom_complet)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic mr-2">Lecture seule</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {searchedStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Aucun étudiant ne correspond à votre recherche.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : selectedDortoir ? (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setSelectedDortoir(null)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux dortoirs
          </Button>
          
          {(() => {
            const dortoirCode = selectedDortoir;
            const studentsInDortoir = etudiants.filter(e => e.dortoir_code === dortoirCode);
            const canEdit = isAdmin || assignedDortoirs.includes(dortoirCode);

            return (
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg">Dortoir {dortoirCode}</CardTitle>
                  <CardDescription>{studentsInDortoir.length} étudiant(s)</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-4">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[100px]">Chambre</TableHead>
                          <TableHead>Nom Complet</TableHead>
                          <TableHead>Téléphone</TableHead>
                          {canEdit && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsInDortoir.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium py-2">{e.chambre_numero}</TableCell>
                            <TableCell className="py-2">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">{e.nom_complet}</span>
                                {(e.autorisation_absence || e.autorisation_voiture) && (
                                  <div className="flex gap-1.5 flex-wrap">
                                    {e.autorisation_absence && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50">
                                        <Check className="h-2.5 w-2.5" /> Abs. Autorisée
                                      </span>
                                    )}
                                    {e.autorisation_voiture && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200/50">
                                        <Car className="h-2.5 w-2.5 flex-shrink-0" /> Voiture: {e.matricule_voiture || "—"}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">{e.telephone || <span className="text-muted-foreground italic">-</span>}</TableCell>
                            {canEdit && (
                              <TableCell className="text-right py-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(e)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteEtudiant(e.id, e.nom_complet)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {studentsInDortoir.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={canEdit ? 4 : 3} className="h-24 text-center text-muted-foreground">
                              Aucun étudiant dans ce dortoir.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from(new Set(etudiants.map(e => e.dortoir_code))).sort().map((dortoirCode) => {
            const count = etudiants.filter(e => e.dortoir_code === dortoirCode).length;
            return (
              <Card key={dortoirCode} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedDortoir(dortoirCode)}>
                <CardHeader>
                  <CardTitle className="text-xl">Dortoir {dortoirCode}</CardTitle>
                  <CardDescription>{count} étudiant(s)</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'étudiant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom Complet</Label>
              <Input 
                value={editForm.nom_complet} 
                onChange={(e) => setEditForm({ ...editForm, nom_complet: e.target.value })} 
                placeholder="Ex: Ahmed Ben Ali" 
              />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input 
                value={editForm.telephone} 
                onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })} 
                placeholder="Ex: 55 123 456" 
              />
            </div>
            
            <div className="flex flex-col gap-3 mt-4 border-t pt-4 bg-muted/10 p-3 rounded-md border">
              <Label className="text-sm font-semibold">Autorisations & Véhicule</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="absence_checkbox" 
                  checked={editForm.autorisation_absence} 
                  onCheckedChange={(checked) => setEditForm({ ...editForm, autorisation_absence: !!checked })}
                />
                <label htmlFor="absence_checkbox" className="text-sm font-medium cursor-pointer">
                  Autorisation d'absence
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="voiture_checkbox" 
                  checked={editForm.autorisation_voiture} 
                  onCheckedChange={(checked) => {
                    const active = !!checked;
                    setEditForm({ 
                      ...editForm, 
                      autorisation_voiture: active,
                      matricule_voiture: active ? editForm.matricule_voiture : ""
                    });
                  }}
                />
                <label htmlFor="voiture_checkbox" className="text-sm font-medium cursor-pointer">
                  Autorisation voiture
                </label>
              </div>

              {editForm.autorisation_voiture && (
                <div className="space-y-1.5 mt-1 pl-6">
                  <Label>Matricule de voiture</Label>
                  <Input 
                    value={editForm.matricule_voiture || ""} 
                    onChange={(e) => setEditForm({ ...editForm, matricule_voiture: e.target.value })} 
                    placeholder="Ex: 123 TUN 456" 
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Annuler</Button>
            <Button onClick={updateEtudiant}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
