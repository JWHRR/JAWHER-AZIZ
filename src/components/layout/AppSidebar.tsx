import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  Utensils,
  Wrench,
  Building2,
  Activity,
  BedDouble,
  DoorOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { AppRole } from "@/lib/types";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: AppRole[];
}

const items: NavItem[] = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard, roles: ["ADMIN", "SURVEILLANT", "TECHNICIEN"] },
  { title: "Calendrier", url: "/calendrier", icon: Calendar, roles: ["ADMIN", "SURVEILLANT"] },
  { title: "Permanences", url: "/permanences", icon: ClipboardList, roles: ["ADMIN", "SURVEILLANT"] },
  { title: "Absences", url: "/absences", icon: ClipboardList, roles: ["ADMIN", "SURVEILLANT"] },
  { title: "Inspections", url: "/inspections", icon: DoorOpen, roles: ["ADMIN", "SURVEILLANT"] },
  { title: "Restaurant", url: "/restaurant", icon: Utensils, roles: ["ADMIN", "SURVEILLANT"] },
  { title: "Réclamations", url: "/reclamations", icon: Wrench, roles: ["ADMIN", "SURVEILLANT", "TECHNICIEN"] },
  { title: "Dortoirs", url: "/dortoirs", icon: BedDouble, roles: ["ADMIN", "SURVEILLANT"] },
  { title: "Liste des Étudiants", url: "/etudiants", icon: Users, roles: ["ADMIN", "SURVEILLANT"] },
  { title: "Utilisateurs", url: "/utilisateurs", icon: Users, roles: ["ADMIN"] },
  { title: "Activité", url: "/activite", icon: Activity, roles: ["ADMIN"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { primaryRole } = useAuth();
  const location = useLocation();

  const visible = items.filter((i) => primaryRole && i.roles.includes(primaryRole));

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-3 px-2 py-2">
          <img src="/ipest-logo.png" alt="IPEST Logo" className="h-10 w-auto object-contain flex-shrink-0 drop-shadow-sm" />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm leading-tight">Internat IPEST</span>
              <span className="text-xs text-sidebar-foreground/70 leading-tight">Gestion de l'internat</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <NavLink to={item.url} end={item.url === "/"}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
