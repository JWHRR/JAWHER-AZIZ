import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  UserX,
  UserCheck,
  UserPlus,
  Pencil,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { AppRole, ROLE_LABELS } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  roles: AppRole[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const ROLES: AppRole[] = ["ADMIN", "SURVEILLANT", "TECHNICIEN"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Utilisateurs() {
  const { user: currentUser } = useAuth();

  // List state
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role: "SURVEILLANT" as AppRole,
  });

  // Edit dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
  });

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const merged: UserRow[] = (profiles ?? []).map((p: any) => ({
      ...p,
      roles: ((roles ?? []) as any[])
        .filter((r) => r.user_id === p.user_id)
        .map((r) => r.role) as AppRole[],
    }));
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // ── Change role ───────────────────────────────────────────────────────────

  const setRole = async (userId: string, currentRoles: AppRole[], newRole: AppRole) => {
    if (currentRoles.length) {
      await supabase.from("user_roles").delete().eq("user_id", userId);
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rôle mis à jour");
    load();
  };

  // ── Toggle active ─────────────────────────────────────────────────────────

  const setActive = async (userId: string, active: boolean) => {
    if (userId === currentUser?.id) {
      toast.error("Vous ne pouvez pas vous désactiver vous-même.");
      return;
    }
    const verb = active ? "réactiver" : "désactiver";
    if (!confirm(`Voulez-vous vraiment ${verb} cet utilisateur ?`)) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: active })
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(active ? "Utilisateur réactivé" : "Utilisateur désactivé");
    await supabase.from("activity_logs").insert({
      user_id: currentUser?.id ?? null,
      action: active ? "Réactivé utilisateur" : "Désactivé utilisateur",
      entity: "profiles",
      entity_id: userId,
    });
    load();
  };

  // ── Create account ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const { full_name, email, password, phone, role } = createForm;
    if (!full_name.trim() || !email.trim() || !password) {
      toast.error("Nom, email et mot de passe sont obligatoires.");
      return;
    }
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-user", {
        body: {
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || null,
          role,
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (res.error) {
        toast.error(res.error.message ?? "Erreur lors de la création.");
        return;
      }

      // The edge function may return a JSON body with an error field
      if (res.data?.error) {
        toast.error(res.data.error);
        return;
      }

      toast.success(`Compte créé pour ${email}`);
      setShowCreate(false);
      setCreateForm({ full_name: "", email: "", password: "", phone: "", role: "SURVEILLANT" });
      setShowPassword(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erreur inconnue");
    } finally {
      setCreating(false);
    }
  };

  // ── Edit profile ──────────────────────────────────────────────────────────

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name, phone: u.phone ?? "" });
  };

  const handleEdit = async () => {
    if (!editUser) return;
    if (!editForm.full_name.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
      })
      .eq("user_id", editUser.user_id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil mis à jour");
    setEditUser(null);
    load();
  };

  // ── Derived lists ─────────────────────────────────────────────────────────

  const filtered = users
    .filter((u) => (tab === "active" ? u.is_active !== false : u.is_active === false))
    .filter(
      (u) =>
        !search ||
        `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    );

  const activeCount = users.filter((u) => u.is_active !== false).length;
  const inactiveCount = users.length - activeCount;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            Gestion des comptes, rôles et désactivations
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Créer un compte
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Actifs ({activeCount})</TabsTrigger>
          <TabsTrigger value="inactive">Désactivés ({inactiveCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* User list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Aucun utilisateur.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((u) => {
                const isInactive = u.is_active === false;
                const isSelf = u.user_id === currentUser?.id;
                return (
                  <li
                    key={u.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    {/* Info */}
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        {u.full_name || "(sans nom)"}
                        {isSelf && (
                          <Badge variant="outline" className="text-xs">
                            Vous
                          </Badge>
                        )}
                        {isInactive && (
                          <Badge variant="destructive">Désactivé</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {u.email}
                      </div>
                      {u.phone && (
                        <div className="text-xs text-muted-foreground">{u.phone}</div>
                      )}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {u.roles.map((r: AppRole) => (
                          <Badge key={r} variant="secondary">
                            {ROLE_LABELS[r]}
                          </Badge>
                        ))}
                        {u.roles.length === 0 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Aucun rôle
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Edit profile */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(u)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Modifier
                      </Button>

                      {/* Role selector (only active users) */}
                      {!isInactive && (
                        <>
                          <Label className="text-xs">Rôle :</Label>
                          <Select
                            value={u.roles[0] ?? ""}
                            onValueChange={(v) =>
                              setRole(u.user_id, u.roles, v as AppRole)
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}

                      {/* Activate / deactivate */}
                      {isInactive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActive(u.user_id, true)}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />
                          Réactiver
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={isSelf}
                          onClick={() => setActive(u.user_id, false)}
                        >
                          <UserX className="h-3.5 w-3.5 mr-1" />
                          Désactiver
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
        💡 La désactivation est réversible. Les utilisateurs désactivés ne peuvent plus
        se connecter, mais leur historique reste consultable.
      </p>

      {/* ── Create dialog ───────────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un nouveau compte</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Full name */}
            <div className="space-y-1">
              <Label>Nom complet *</Label>
              <Input
                placeholder="Ex : Mohamed Ben Ali"
                value={createForm.full_name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="exemple@ipest.tn"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label>Mot de passe *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 6 caractères"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <Label>Téléphone (optionnel)</Label>
              <Input
                placeholder="+216 XX XXX XXX"
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>

            {/* Role */}
            <div className="space-y-1">
              <Label>Rôle</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, role: v as AppRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer le compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nom complet *</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Téléphone (optionnel)</Label>
              <Input
                placeholder="+216 XX XXX XXX"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              L'adresse email ne peut pas être modifiée ici.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
