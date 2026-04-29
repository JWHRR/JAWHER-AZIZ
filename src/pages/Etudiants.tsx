import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, FileDown, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Etudiants() {
  const { user, primaryRole } = useAuth();
  const isAdmin = primaryRole === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [etudiants, setEtudiants] = useState<any[]>([]);
  
  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", nom_complet: "", telephone: "" });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    
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

    if (!isAdmin) {
      // Get dortoirs assigned to surveillant
      const { data: myAssigns } = await supabase.from("dortoir_assignments").select("dortoir_id").eq("surveillant_id", user.id);
      const myDortoirIds = (myAssigns ?? []).map(a => a.dortoir_id);
      
      if (myDortoirIds.length > 0) {
        // Unfortunately, deep filtering (in chambres.dortoir_id) isn't directly supported by PostgREST select filtering
        // We have to filter client-side or use a database view.
        // For simplicity, we fetch all and filter client side, or fetch chambres first.
        const { data: myChambres } = await supabase.from("chambres").select("id").in("dortoir_id", myDortoirIds);
        const myChambreIds = (myChambres ?? []).map(c => c.id);
        if (myChambreIds.length > 0) {
          query = query.in("chambre_id", myChambreIds);
        } else {
          setEtudiants([]); setLoading(false); return;
        }
      } else {
        setEtudiants([]); setLoading(false); return;
      }
    }

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
    });
    setOpenEdit(true);
  };

  const updateEtudiant = async () => {
    if (!editForm.nom_complet.trim()) { toast.error("Le nom complet est requis"); return; }
    
    const { error } = await supabase.from("etudiants").update({
      nom_complet: editForm.nom_complet.trim(),
      telephone: editForm.telephone.trim() || null,
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Annuaire ({etudiants.length} étudiants)</CardTitle>
          <CardDescription>
            {isAdmin ? "Tous les étudiants de tous les dortoirs" : "Étudiants de vos dortoirs assignés"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : etudiants.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground italic">Aucun étudiant trouvé. Ajoutez-les via la gestion des chambres.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dortoir</TableHead>
                    <TableHead>Chambre</TableHead>
                    <TableHead>Nom Complet</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {etudiants.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">Dortoir {e.dortoir_code}</TableCell>
                      <TableCell>Chambre {e.chambre_numero}</TableCell>
                      <TableCell>{e.nom_complet}</TableCell>
                      <TableCell>{e.telephone || <span className="text-muted-foreground italic">-</span>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(e)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEtudiant(e.id, e.nom_complet)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
