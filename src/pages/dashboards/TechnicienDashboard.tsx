import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Wrench, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getBusinessDate } from "@/lib/time";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

export default function TechnicienDashboard() {
  const { profile, session } = useAuth();
  const { unreadMap } = useUnreadCounts(session?.user?.id ?? profile?.user_id ?? null);
  const totalUnreadMessages = Object.values(unreadMap).reduce((acc, count) => acc + count, 0);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, progress: 0, done: 0 });

  useEffect(() => {
    (async () => {
      const [allRecs] = await Promise.all([
        supabase.from("reclamations").select("id, status, tech_done"),
      ]);
      const list = (allRecs.data ?? []) as { id: string; status: string; tech_done?: boolean }[];
      const done = list.filter((r) => r.tech_done || r.status === "TERMINEE").length;
      const progress = list.filter((r) => !r.tech_done && r.status === "EN_COURS").length;
      const pending = list.filter((r) => !r.tech_done && r.status === "EN_ATTENTE").length;
      setCounts({ pending, progress, done });
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

  const cards = [
    {
      label: "Réclamations",
      icon: Wrench,
      color: "text-destructive",
      bg: "bg-destructive/10",
      link: "/reclamations",
      desc: counts.pending > 0 ? `${counts.pending} ticket(s) en attente` : "Suivi des interventions",
      badge: counts.pending > 0 ? counts.pending : undefined,
    },
    {
      label: "Messagerie",
      icon: MessageSquare,
      color: "text-primary",
      bg: "bg-primary-soft",
      link: "/messagerie",
      desc: totalUnreadMessages > 0 ? `${totalUnreadMessages} message(s) non lu(s)` : "Échanges & alertes",
      badge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined,
      isUnread: totalUnreadMessages > 0,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="mb-2">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Bonjour <span className="bg-clip-text text-transparent bg-gradient-primary drop-shadow-sm">{profile?.full_name?.split(" ")[0] || ""}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          {format(getBusinessDate(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.link}
            className={`group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md ${
              c.isUnread ? "border-destructive/80 ring-2 ring-destructive/40 shadow-sm" : ""
            }`}
          >
            {c.isUnread && c.badge != null && c.badge > 0 && (
              <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-sm">
                  {c.badge}
                </span>
              </span>
            )}
            {!c.isUnread && c.badge != null && c.badge > 0 && (
              <span className="absolute top-2 right-2 h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                {c.badge}
              </span>
            )}
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div
                className={`h-12 w-12 rounded-full ${c.bg} flex items-center justify-center transition-transform group-hover:scale-110 relative ${
                  c.isUnread ? "animate-bounce ring-2 ring-destructive ring-offset-2" : ""
                }`}
              >
                <c.icon className={`h-6 w-6 ${c.color}`} />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground flex items-center justify-center gap-1.5">
                  {c.label}
                  {c.isUnread && (
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-ping" />
                  )}
                </div>
                <div className={`text-xs mt-0.5 ${c.isUnread ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  {c.desc}
                </div>
              </div>
            </div>
          </Link>
        ))}
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

      <Card className="relative overflow-hidden backdrop-blur-xl bg-card/90 border-border/50 shadow-sm transition-all hover:shadow-md">
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
