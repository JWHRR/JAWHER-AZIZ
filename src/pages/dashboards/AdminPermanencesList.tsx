import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Clock, User, Calendar as CalIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getBusinessDate, parseLocalDate } from "@/lib/time";
import { SLOT_LABELS, PermanenceSlot, dateToWeekday } from "@/lib/types";

export default function AdminPermanencesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || format(getBusinessDate(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSearchParams({ date: newDate }, { replace: true });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const wd = dateToWeekday(parseLocalDate(date));

      // Fetch assignments, logs, and templates
      const [assignRes, logsRes, tplRes, profsRes] = await Promise.all([
        supabase.from("permanences").select("*").eq("date", date),
        supabase.from("permanence_logs").select("*").eq("date", date),
        supabase.from("permanence_template").select("*").eq("weekday", wd),
        supabase.from("profiles").select("user_id, full_name")
      ]);

      const nameById = Object.fromEntries((profsRes.data || []).map((p: any) => [p.user_id, p.full_name]));

      // Build a unified view of what's expected vs what's logged
      // 1. Gather all expected slots from templates + overrides
      const expected = new Map<string, any>(); // key: surveillant_id + slot

      (tplRes.data || []).forEach(t => {
        expected.set(`${t.surveillant_id}_${t.slot}`, {
          surveillant_id: t.surveillant_id,
          slot: t.slot,
          source: "TEMPLATE",
          notes: t.notes
        });
      });

      (assignRes.data || []).forEach(a => {
        expected.set(`${a.surveillant_id}_${a.slot}`, {
          surveillant_id: a.surveillant_id,
          slot: a.slot,
          source: "EXCEPTION",
          notes: a.notes
        });
      });

      // 2. Attach logs (pointages)
      const logsBySurvSlot = new Map<string, any>();
      (logsRes.data || []).forEach(l => {
        // Logs might just have start_time/end_time. If they have slot, map it.
        // Assuming logs have slot column based on standard. If not, just attach to surveillant.
        if (l.slot) {
          logsBySurvSlot.set(`${l.surveillant_id}_${l.slot}`, l);
        } else {
           // fallback if logs don't have slot (just match surveillant)
           logsBySurvSlot.set(`${l.surveillant_id}_MATIN`, l);
        }
      });

      const enriched = Array.from(expected.values()).map(e => {
        const log = logsBySurvSlot.get(`${e.surveillant_id}_${e.slot}`);
        return {
          ...e,
          surveillant_name: nameById[e.surveillant_id] || "—",
          log: log || null
        };
      });

      // Add any unexpected logs (surveillant checked in but wasn't scheduled)
      (logsRes.data || []).forEach(l => {
        const slot = l.slot || 'MATIN';
        if (!expected.has(`${l.surveillant_id}_${slot}`)) {
          enriched.push({
            surveillant_id: l.surveillant_id,
            slot: slot,
            source: "IMPREVU",
            notes: null,
            surveillant_name: nameById[l.surveillant_id] || "—",
            log: l
          });
        }
      });

      // Sort by slot then name
      const slotOrder = { MATIN: 1, APRES_MIDI: 2, NUIT: 3 };
      enriched.sort((a, b) => {
        if (a.slot !== b.slot) return (slotOrder[a.slot as keyof typeof slotOrder] || 9) - (slotOrder[b.slot as keyof typeof slotOrder] || 9);
        return a.surveillant_name.localeCompare(b.surveillant_name);
      });

      setData(enriched);
      setLoading(false);
    };
    load();
  }, [date]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="outline" size="icon" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Supervision Permanences</h1>
          <p className="text-muted-foreground mt-1 text-sm">Contrôle des présences et pointages</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="date" className="text-sm shrink-0">Date :</Label>
        <Input id="date" type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            État des permanences du {format(parseLocalDate(date), "EEEE d MMMM yyyy", { locale: fr })}
          </CardTitle>
          <CardDescription>
            Suivi des surveillants affectés et de leur pointage réel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune permanence planifiée ou pointée pour cette date.</p>
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
                        <Clock className={`h-4 w-4 ${iconColor} shrink-0`} />
                        <span className="font-semibold text-sm">{SLOT_LABELS[item.slot as PermanenceSlot] || item.slot}</span>
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
                      <div className="text-sm bg-background rounded-lg px-3 py-2 border grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Heure d'arrivée</div>
                          <div className="font-medium">{item.log.start_time ? item.log.start_time.substring(0, 5) : "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Heure de départ</div>
                          <div className="font-medium">{item.log.end_time ? item.log.end_time.substring(0, 5) : "—"}</div>
                        </div>
                        {item.log.observation && (
                          <div className="col-span-2 mt-1">
                            <div className="text-xs text-muted-foreground">Observation</div>
                            <div className="text-xs mt-0.5">{item.log.observation}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes from planning */}
                    {!hasPointage && item.notes && (
                      <div className="text-xs text-muted-foreground bg-background rounded-lg px-3 py-2 border">
                        <span className="font-semibold">Note (Planning) : </span>{item.notes}
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
