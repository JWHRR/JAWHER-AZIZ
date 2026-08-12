import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "./dashboards/AdminDashboard";
import SurveillantDashboard from "./dashboards/SurveillantDashboard";
import TechnicienDashboard from "./dashboards/TechnicienDashboard";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { primaryRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (primaryRole === "ADMIN") return <AdminDashboard />;
  if (primaryRole === "TECHNICIEN") return <TechnicienDashboard />;
  return <SurveillantDashboard />;
};

export default Index;
