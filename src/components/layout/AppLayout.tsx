import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</main>
          <footer className="py-4 text-center text-sm text-muted-foreground border-t">
            © {new Date().getFullYear()} Gestionnaire Foyer. Projet développé par Jawher Salhi et Mahfoudhi Aziz.
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
