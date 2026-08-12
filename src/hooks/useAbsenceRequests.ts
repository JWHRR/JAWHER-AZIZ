import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AbsenceRequest,
  DelegatedTask,
  CreateAbsenceRequestInput,
} from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

// ── helper: resolve profile names for a list of user IDs ─────────────────────
async function resolveNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', unique);
  return Object.fromEntries((data ?? []).map((p: any) => [p.user_id, p.full_name ?? '—']));
}

// ── helper: all surveillants via SECURITY DEFINER RPC (bypasses RLS) ────────
export async function fetchSurveillants(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.rpc('get_surveillants');
  if (error || !data) return [];
  return (data as { user_id: string; full_name: string }[]).map(r => ({
    id:   r.user_id,
    name: r.full_name ?? '—',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────

export const useAbsenceRequests = () => {
  const { user, primaryRole } = useAuth();

  const [requests,         setRequests]         = useState<AbsenceRequest[]>([]);
  const [myDelegatedTasks, setMyDelegatedTasks] = useState<DelegatedTask[]>([]);
  const [surveillants,     setSurveilants]      = useState<{ id: string; name: string }[]>([]);
  const [loading,          setLoading]          = useState(true);

  // ── fetch all absence requests (with profile enrichment) ─────────────────
  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: raw, error } = await supabase
      .from('absence_requests')
      .select('*, delegated_tasks(*)')
      .order('created_at', { ascending: false });

    if (error || !raw) { setLoading(false); return; }

    const allIds = raw.flatMap((r: any) => [r.surveillant_id, r.replacement_id, r.reviewed_by].filter(Boolean));
    const names  = await resolveNames(allIds);

    setRequests(
      raw.map((r: any) => ({
        ...r,
        surveillant_name: names[r.surveillant_id] ?? '—',
        replacement_name: r.replacement_id ? (names[r.replacement_id] ?? '—') : null,
        reviewer_name:    r.reviewed_by    ? (names[r.reviewed_by]    ?? '—') : null,
      }))
    );
    setLoading(false);
  }, [user]);

  // ── fetch delegated tasks assigned to me ────────────────────────────────
  const fetchMyDelegatedTasks = useCallback(async () => {
    if (!user) return;

    const { data: raw, error } = await supabase
      .from('delegated_tasks')
      .select('*, absence_requests(reason, start_date, end_date)')
      .eq('replacement_surveillant_id', user.id)
      .order('task_date', { ascending: true });

    if (error || !raw) return;

    const origIds = raw.map((t: any) => t.original_surveillant_id).filter(Boolean);
    const names   = await resolveNames(origIds);

    setMyDelegatedTasks(
      raw.map((t: any) => ({
        ...t,
        original_name:  names[t.original_surveillant_id] ?? '—',
        absence_reason: t.absence_requests?.reason     ?? null,
        absence_start:  t.absence_requests?.start_date ?? null,
        absence_end:    t.absence_requests?.end_date   ?? null,
      }))
    );
  }, [user]);

  // ── fetch available surveillants for replacement picker ──────────────────
  const loadSurveillants = useCallback(async () => {
    const list = await fetchSurveillants();
    setSurveilants(list.filter(s => s.id !== user?.id));
  }, [user]);

  // ── initial load + realtime ───────────────────────────────────────────────
  useEffect(() => {
    fetchRequests();
    fetchMyDelegatedTasks();
    loadSurveillants();

    const ch = supabase
      .channel('absence_system')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absence_requests' }, () => {
        fetchRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delegated_tasks' }, () => {
        fetchMyDelegatedTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [fetchRequests, fetchMyDelegatedTasks, loadSurveillants]);

  // ── create request (tasks are auto-delegated on approval) ───────────────
  const createRequest = async (data: CreateAbsenceRequestInput): Promise<boolean> => {
    if (!user) return false;

    const { data: inserted, error } = await supabase
      .from('absence_requests')
      .insert({
        surveillant_id: user.id,
        reason:         data.reason,
        description:    data.description || null,
        start_date:     data.start_date,
        end_date:       data.end_date,
        replacement_id: data.replacement_id || null,
      })
      .select()
      .single();

    if (error || !inserted) { toast.error(error?.message ?? 'Erreur'); return false; }

    // audit trail
    await supabase.from('request_status_history').insert({
      request_id: inserted.id,
      old_status: null,
      new_status: 'PENDING',
      changed_by: user.id,
      note: 'Demande créée',
    });

    // notify all admins
    await supabase.from('notifications').insert({
      role:    'ADMIN',
      title:   '📋 Nouvelle demande d\'absence',
      message: `${data.reason} — du ${data.start_date} au ${data.end_date}`,
      link:    '/demandes-absence',
    });

    toast.success('Demande soumise avec succès');
    fetchRequests();
    return true;
  };

  // ── admin: approve ────────────────────────────────────────────────────────
  const approveRequest = async (requestId: string, adminNote?: string) => {
    if (!user) return;
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const { error } = await supabase
      .from('absence_requests')
      .update({
        status:      'APPROVED',
        admin_note:  adminNote || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', requestId);

    if (error) { toast.error(error.message); return; }

    await supabase.from('request_status_history').insert({
      request_id: requestId, old_status: 'PENDING', new_status: 'APPROVED',
      changed_by: user.id,   note: adminNote || null,
    });

    // notify requester
    await supabase.from('notifications').insert({
      user_id: req.surveillant_id,
      title:   '✅ Demande approuvée',
      message: `Votre demande "${req.reason}" a été approuvée.`,
      link:    '/demandes-absence',
    });

    // notify replacement if any
    if (req.replacement_id) {
      await supabase.from('notifications').insert({
        user_id: req.replacement_id,
        title:   '📋 Tâches déléguées',
        message: `Des tâches vous sont assignées du ${req.start_date} au ${req.end_date}.`,
        link:    '/demandes-absence',
      });
    }

    // auto-delegate: copies permanences + restaurant_assignments to replacement
    await supabase.rpc('auto_delegate_tasks', { p_request_id: requestId });

    toast.success('Demande approuvée — tâches transférées automatiquement');
    fetchRequests();
    fetchMyDelegatedTasks();
  };

  // ── admin: reject ─────────────────────────────────────────────────────────
  const rejectRequest = async (requestId: string, adminNote?: string) => {
    if (!user) return;
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const { error } = await supabase
      .from('absence_requests')
      .update({
        status:      'REJECTED',
        admin_note:  adminNote || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', requestId);

    if (error) { toast.error(error.message); return; }

    await supabase.from('request_status_history').insert({
      request_id: requestId, old_status: 'PENDING', new_status: 'REJECTED',
      changed_by: user.id,   note: adminNote || null,
    });

    await supabase.from('notifications').insert({
      user_id: req.surveillant_id,
      title:   '❌ Demande refusée',
      message: `Votre demande "${req.reason}" a été refusée.${adminNote ? ' Motif : ' + adminNote : ''}`,
      link:    '/demandes-absence',
    });

    toast.success('Demande refusée');
    fetchRequests();
  };

  // ── surveillant: delete pending request ───────────────────────────────────
  const deleteRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('absence_requests')
      .delete()
      .eq('id', requestId);
    if (error) { toast.error(error.message); return; }
    toast.success('Demande supprimée');
    fetchRequests();
  };

  // ── replacement: mark task done ────────────────────────────────────────────
  const completeTask = async (taskId: string) => {
    const { error } = await supabase
      .from('delegated_tasks')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) { toast.error(error.message); return; }
    toast.success('Tâche marquée comme terminée');
    fetchMyDelegatedTasks();
  };

  // ── start task ─────────────────────────────────────────────────────────────
  const startTask = async (taskId: string) => {
    const { error } = await supabase
      .from('delegated_tasks')
      .update({ status: 'IN_PROGRESS' })
      .eq('id', taskId);
    if (error) { toast.error(error.message); return; }
    fetchMyDelegatedTasks();
  };

  // ── derived counts ────────────────────────────────────────────────────────
  const myRequests = requests.filter(r => r.surveillant_id === user?.id);
  const pendingCount  = requests.filter(r => r.status === 'PENDING').length;
  const pendingTaskCount = myDelegatedTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;

  return {
    requests,
    myRequests,
    myDelegatedTasks,
    surveillants,
    loading,
    pendingCount,
    pendingTaskCount,
    createRequest,
    approveRequest,
    rejectRequest,
    deleteRequest,
    completeTask,
    startTask,
    refresh: fetchRequests,
  };
};
