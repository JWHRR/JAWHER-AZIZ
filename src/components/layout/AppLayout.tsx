import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isMessagerie = location.pathname.startsWith("/messagerie");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-transparent">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main
            className={
              isMessagerie
                ? "flex-1 p-0 overflow-hidden h-[calc(100dvh-4rem)]"
                : "flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in"
            }
          >
            {children}
          </main>
          {!isMessagerie && (
            <footer className="py-4 text-center text-sm text-muted-foreground border-t">
              © 2026 Gestionnaire Direction Internat — Créé et développé par Jawher Salhi & Aziz Mahfoudhi.
            </footer>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
