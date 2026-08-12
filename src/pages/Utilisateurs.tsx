import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { AppRole, ROLE_LABELS } from "@/lib/types";

export default function Utilisateurs() {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*").order("full_name");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const merged = (profiles ?? []).map((p: any) => ({
      ...p,
      roles: ((roles ?? []) as any[]).filter((r) => r.user_id === p.user_id).map((r) => r.role) as AppRole[],
    }));
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, currentRoles: AppRole[], newRole: AppRole) => {
    if (currentRoles.length) {
      await supabase.from("user_roles").delete().eq("user_id", userId);
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) { toast.error(error.message); return; }
    toast.success("Rôle mis à jour");
    load();
  };

  const setActive = async (userId: string, active: boolean) => {
    if (userId === currentUser?.id) {
      toast.error("Vous ne pouvez pas vous désactiver vous-même.");
      return;
    }
    const action = active ? "réactiver" : "désactiver";
    if (!confirm(`Voulez-vous vraiment ${action} cet utilisateur ?`)) return;
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(active ? "Utilisateur réactivé" : "Utilisateur désactivé");
    await supabase.from("activity_logs").insert({
      user_id: currentUser?.id ?? null,
      action: active ? "Réactivé utilisateur" : "Désactivé utilisateur",
      entity: "profiles",
      entity_id: userId,
    });
    load();
  };

  const filtered = users
    .filter((u) => (tab === "active" ? u.is_active !== false : u.is_active === false))
    .filter((u) => !search || `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const activeCount = users.filter((u) => u.is_active !== false).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground mt-1">Gestion des comptes, rôles et désactivations</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Actifs ({activeCount})</TabsTrigger>
          <TabsTrigger value="inactive">Désactivés ({inactiveCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher par nom ou email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Aucun utilisateur.</div>
          ) : (
            <ul className="divide-y">
              {filtered.map((u) => {
                const isInactive = u.is_active === false;
                return (
                  <li key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        {u.full_name || "(sans nom)"}
                        {isInactive && <Badge variant="destructive">Désactivé</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{u.email}</div>
                      <div className="flex gap-1 mt-1">
                        {u.roles.map((r: AppRole) => (
                          <Badge key={r} variant="secondary">{ROLE_LABELS[r]}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isInactive && (
                        <>
                          <Label className="text-xs">Rôle :</Label>
                          <Select value={u.roles[0] ?? ""} onValueChange={(v) => setRole(u.user_id, u.roles, v as AppRole)}>
                            <SelectTrigger className="w-[170px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {(["ADMIN", "SURVEILLANT", "TECHNICIEN"] as AppRole[]).map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                      {isInactive ? (
                        <Button size="sm" variant="outline" onClick={() => setActive(u.user_id, true)}>
                          <UserCheck className="h-3.5 w-3.5 mr-1" /> Réactiver
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setActive(u.user_id, false)}>
                          <UserX className="h-3.5 w-3.5 mr-1" /> Désactiver
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        💡 La désactivation est réversible. Les utilisateurs désactivés ne peuvent plus se connecter, mais leur historique reste consultable.
      </p>
    </div>
  );
}
