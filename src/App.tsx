import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/Auth.tsx";
import Calendrier from "./pages/Calendrier.tsx";
import Absences from "./pages/Absences.tsx";
import Restaurant from "./pages/Restaurant.tsx";
import Reclamations from "./pages/Reclamations.tsx";
import Dortoirs from "./pages/Dortoirs.tsx";
import Utilisateurs from "./pages/Utilisateurs.tsx";
import Activite from "./pages/Activite.tsx";
import Inspections from "./pages/Inspections.tsx";
import Permanences from "./pages/Permanences.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout><Index /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendrier"
              element={
                <ProtectedRoute roles={["ADMIN", "SURVEILLANT"]}>
                  <AppLayout><Calendrier /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/permanences"
              element={
                <ProtectedRoute roles={["ADMIN", "SURVEILLANT"]}>
                  <AppLayout><Permanences /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/absences"
              element={
                <ProtectedRoute roles={["ADMIN", "SURVEILLANT"]}>
                  <AppLayout><Absences /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant"
              element={
                <ProtectedRoute roles={["ADMIN", "SURVEILLANT"]}>
                  <AppLayout><Restaurant /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inspections"
              element={
                <ProtectedRoute roles={["ADMIN", "SURVEILLANT"]}>
                  <AppLayout><Inspections /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reclamations"
              element={
                <ProtectedRoute>
                  <AppLayout><Reclamations /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dortoirs"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AppLayout><Dortoirs /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilisateurs"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AppLayout><Utilisateurs /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activite"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AppLayout><Activite /></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
