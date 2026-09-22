import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, RECLAMATION_REMINDER_TITLE } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Bell, Check, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function AppHeader() {
  const { profile, primaryRole, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setNotifications((prev) => {
        if (prev.length > 0) {
          const newNotifs = data.filter((n) => !prev.find((old) => old.id === n.id));
          newNotifs.forEach((n) => {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(n.title, { body: n.message, icon: "/ipest-logo.png" });
            }
          });
        }
        return data;
      });
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleNotificationClick = async (n: any) => {
    await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Utilisateur";
  const initials = displayName
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-16 border-b border-border/40 bg-background/60 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30 transition-all duration-300">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex items-center gap-3">
        {primaryRole && (
          <Badge variant="secondary" className="hidden sm:inline-flex shadow-sm">
            {ROLE_LABELS[primaryRole]}
          </Badge>
        )}



        {/* Notification bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 flex h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-[80vh] overflow-y-auto">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Aucune nouvelle notification</div>
            ) : (
              notifications.map((n) => {
                // Le rappel « réclamations à vérifier » est une alerte : tout
                // l'encart passe en rouge pour qu'il ne se noie pas dans les
                // notifications courantes.
                const isAlert = n.title === RECLAMATION_REMINDER_TITLE;
                return (
                <div
                  key={n.id}
                  className={`p-3 border-b last:border-0 transition-colors flex justify-between items-start gap-2 ${
                    isAlert
                      ? "bg-destructive/10 border-l-4 border-l-destructive hover:bg-destructive/20"
                      : "hover:bg-muted/50"
                  } ${n.link ? "cursor-pointer" : ""}`}
                  onClick={() => { if (n.link) handleNotificationClick(n); }}
                >
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm leading-none flex items-center gap-1.5 ${
                      isAlert ? "font-bold text-destructive" : "font-medium"
                    }`}>
                      {isAlert && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                      {n.title}
                    </p>
                    {/* whitespace-pre-line : le rappel liste les réclamations
                        une par ligne, sinon tout s'affiche en un seul bloc. */}
                    <p className={`text-xs whitespace-pre-line ${
                      isAlert ? "text-destructive/90" : "text-muted-foreground line-clamp-2"
                    }`}>{n.message}</p>
                    <p className={`text-[10px] ${isAlert ? "text-destructive/70" : "text-muted-foreground"}`}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 shrink-0 ${
                      isAlert
                        ? "text-destructive hover:text-destructive hover:bg-destructive/20"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                    onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2 py-1.5 h-auto hover:bg-primary/5 transition-colors rounded-full">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-2 ring-offset-background transition-all hover:ring-primary/40 shadow-sm">
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm font-semibold tracking-tight pr-2">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
