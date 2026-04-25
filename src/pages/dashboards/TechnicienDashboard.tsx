import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Wrench } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function TechnicienDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, progress: 0, done: 0 });

  useEffect(() => {
    (async () => {
      const [p, pr, d] = await Promise.all([
        supabase.from("reclamations").select("*", { count: "exact", head: true }).eq("status", "EN_ATTENTE"),
        supabase.from("reclamations").select("*", { count: "exact", head: true }).eq("status", "EN_COURS"),
        supabase.from("reclamations").select("*", { count: "exact", head: true }).eq("status", "TERMINEE"),
      ]);
      setCounts({ pending: p.count ?? 0, progress: pr.count ?? 0, done: d.count ?? 0 });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Bonjour {profile?.full_name?.split(" ")[0] || ""} 👋</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-xs uppercase font-medium text-warning">En attente</div>
          <div className="text-4xl font-bold mt-2">{counts.pending}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase font-medium text-primary">En cours</div>
          <div className="text-4xl font-bold mt-2">{counts.progress}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase font-medium text-success">Terminées</div>
          <div className="text-4xl font-bold mt-2">{counts.done}</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Réclamations à traiter
          </CardTitle>
          <CardDescription>Consultez et mettez à jour le statut des réclamations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/reclamations">Voir toutes les réclamations</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
