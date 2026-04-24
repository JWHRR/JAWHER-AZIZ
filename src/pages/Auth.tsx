import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!authLoading && user) navigate("/", { replace: true });
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Identifiants invalides" : error.message);
      return;
    }
    toast.success("Connexion réussie");
    navigate("/", { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Cet email est déjà utilisé");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Compte créé. Vous pouvez vous connecter.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6 flex justify-center">
            <img src="/ipest-logo.png" alt="IPEST Logo" className="h-24 w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300" />
          </div>
          <h1 className="text-3xl font-bold">Foyer Manager</h1>
          <p className="text-muted-foreground mt-1">Gestion complète du foyer</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Bienvenue</CardTitle>
            <CardDescription>Connectez-vous à votre compte</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="email-in">Email</Label>
                <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@foyer.fr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-in">Mot de passe</Label>
                <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Se connecter
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
