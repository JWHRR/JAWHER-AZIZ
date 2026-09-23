import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Utensils, User, Users } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate, parseLocalDate } from "@/lib/time";
import { REPAS_LABELS, RepasType, dateToWeekday } from "@/lib/types";

import { toast } from "sonner";

export default function AdminRestaurantList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || format(getBusinessDate(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nombre_eleves: 0, observations: "" });
  const [saving, setSaving] = useState(false);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    const wd = dateToWeekday(parseLocalDate(date));

    // Fetch assignments, logs, and templates
    const [assignRes, logsRes, tplRes, profsRes] = await Promise.all([
      supabase.from("restaurant_assignments").select("*").eq("date", date),
      supabase.from("restaurant_logs").select("*").eq("date", date),
      supabase.from("restaurant_template").select("*").eq("weekday", wd),
      supabase.from("profiles").select("user_id, full_name")
    ]);

    const nameById = Object.fromEntries((profsRes.data || []).map((p: any) => [p.user_id, p.full_name]));

    // Build a unified view
    const expected = new Map<string, any>(); 

    (tplRes.data || []).forEach(t => {
      expected.set(`${t.surveillant_id}_${t.repas}`, {
        surveillant_id: t.surveillant_id,
        repas: t.repas,
        source: "TEMPLATE"
      });
    });

    (assignRes.data || []).forEach(a => {
      expected.set(`${a.surveillant_id}_${a.repas}`, {
        surveillant_id: a.surveillant_id,
        repas: a.repas,
        source: "EXCEPTION"
      });
    });

    // Attach logs
    const logsBySurvRepas = new Map<string, any>();
    (logsRes.data || []).forEach(l => {
      logsBySurvRepas.set(`${l.surveillant_id}_${l.repas}`, l);
    });

    const enriched = Array.from(expected.values()).map(e => {
      const log = logsBySurvRepas.get(`${e.surveillant_id}_${e.repas}`);
      return {
        ...e,
        surveillant_name: nameById[e.surveillant_id] || "—",
        log: log || null
      };
    });

    // Add any unexpected logs
    (logsRes.data || []).forEach(l => {
      if (!expected.has(`${l.surveillant_id}_${l.repas}`)) {
        enriched.push({
          surveillant_id: l.surveillant_id,
          repas: l.repas,
          source: "IMPREVU",
          surveillant_name: nameById[l.surveillant_id] || "—",
          log: l
        });
      }
    });

    // Sort by repas then name
    const repasOrder = { PETIT_DEJEUNER: 1, DEJEUNER: 2, DINER: 3 };
    enriched.sort((a, b) => {
      if (a.repas !== b.repas) return (repasOrder[a.repas as keyof typeof repasOrder] || 9) - (repasOrder[b.repas as keyof typeof repasOrder] || 9);
      return a.surveillant_name.localeCompare(b.surveillant_name);
    });

    setData(enriched);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [date]);

  const startEdit = (item: any) => {
    setEditingId(item.log.id);
    setEditForm({
      nombre_eleves: item.log.nombre_eleves ?? 0,
      observations: item.log.observations ?? ""
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase
      .from("restaurant_logs")
      .update({
        nombre_eleves: editForm.nombre_eleves,
        observations: editForm.observations || null
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde : " + error.message);
      return;
    }
    toast.success("Effectif mis à jour");
    setEditingId(null);
    load();
  };

  const totalEleves = data.reduce((acc, curr) => acc + (curr.log?.nombre_eleves || 0), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="outline" size="icon" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Supervision Restaurant</h1>
          <p className="text-muted-foreground mt-1 text-sm">Contrôle des présences et de l'effectif servi</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="date" className="text-sm shrink-0">Date :</Label>
        <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            État du restaurant le {format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full text-xs">
              <Users className="h-3.5 w-3.5" />
              {totalEleves} élève(s) pointé(s) au total
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun repas planifié ou pointé pour cette date.</p>
          ) : (
            <div className="space-y-3">
              {data.map((item, idx) => {
                const hasPointage = !!item.log;
                const isToday = date === format(getBusinessDate(), "yyyy-MM-dd");
                const isWarning = !hasPointage && isToday;
                
                const cardBg = hasPointage ? 'bg-success/5 border-success/20' : isWarning ? 'bg-warning/5 border-warning/30' : 'bg-destructive/5 border-destructive/20';
                const iconColor = hasPointage ? 'text-success' : isWarning ? 'text-warning' : 'text-destructive';
                const badgeColor = hasPointage ? 'bg-success text-success-foreground' : isWarning ? 'bg-warning text-warning-foreground' : 'bg-destructive text-destructive-foreground';

                return (
                  <div key={idx} className={`rounded-xl border p-4 space-y-3 ${cardBg}`}>
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Utensils className={`h-4 w-4 ${iconColor} shrink-0`} />
                        <span className="font-semibold text-sm">{REPAS_LABELS[item.repas as RepasType] || item.repas}</span>
                      </div>
                      <span className={`inline-flex items-center justify-center text-xs font-bold px-3 py-1 rounded-full ${badgeColor}`}>
                        {hasPointage ? 'Pointé' : isWarning ? 'En attente' : 'Non pointé'}
                      </span>
                    </div>

                    {/* Surveillant */}
                    <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{item.surveillant_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded">
                        {item.source === "TEMPLATE" ? "Régulier" : item.source === "EXCEPTION" ? "Exceptionnel" : "Imprévu"}
                      </span>
                    </div>

                    {/* Pointage Info */}
                    {hasPointage && (
                      <div className="text-sm bg-background rounded-lg px-3 py-2 border space-y-2">
                        {editingId === item.log.id ? (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Effectif (nombre d'élèves)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={editForm.nombre_eleves}
                                onChange={(e) => setEditForm(f => ({ ...f, nombre_eleves: parseInt(e.target.value) || 0 }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Observations</Label>
                              <Input
                                type="text"
                                value={editForm.observations}
                                onChange={(e) => setEditForm(f => ({ ...f, observations: e.target.value }))}
                                placeholder="Observations (optionnel)"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" onClick={saveEdit} disabled={saving} className="h-7 text-xs">
                                {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Enregistrer
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving} className="h-7 text-xs">
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Effectif pointé</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base">{item.log.nombre_eleves}</span>
                                <Button size="sm" variant="outline" onClick={() => startEdit(item)} className="h-6 text-xs px-2">
                                  Modifier
                                </Button>
                              </div>
                            </div>
                            {item.log.observations && (
                              <div className="pt-2 border-t">
                                <div className="text-xs text-muted-foreground mb-1">Observations</div>
                                <div className="text-xs">{item.log.observations}</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
