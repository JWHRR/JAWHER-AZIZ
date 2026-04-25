import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Activite() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*, profiles!activity_logs_user_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Journal d'activité</h1>
        <p className="text-muted-foreground mt-1">200 dernières actions</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Aucune activité.</div>
          ) : (
            <ul className="divide-y">
              {logs.map((l) => (
                <li key={l.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{l.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.profiles?.full_name ?? "Système"} {l.entity ? `· ${l.entity}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{format(new Date(l.created_at), "dd/MM/yyyy HH:mm")}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
