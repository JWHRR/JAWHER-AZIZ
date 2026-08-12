-- =============================================================
-- ABSENCE REQUESTS SYSTEM
-- =============================================================

-- absence_requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.absence_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillant_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason          TEXT        NOT NULL,
  description     TEXT,
  start_date      DATE        NOT NULL,
  end_date        DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  replacement_id  UUID        REFERENCES auth.users(id),
  admin_note      TEXT,
  attachment_url  TEXT,
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ar_valid_dates CHECK (end_date >= start_date)
);

-- delegated_tasks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delegated_tasks (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_request_id          UUID        NOT NULL REFERENCES public.absence_requests(id) ON DELETE CASCADE,
  original_surveillant_id     UUID        NOT NULL REFERENCES auth.users(id),
  replacement_surveillant_id  UUID        NOT NULL REFERENCES auth.users(id),
  title                       TEXT        NOT NULL,
  description                 TEXT,
  task_date                   DATE        NOT NULL,
  priority                    TEXT        NOT NULL DEFAULT 'NORMAL'
                                          CHECK (priority IN ('LOW','NORMAL','HIGH')),
  status                      TEXT        NOT NULL DEFAULT 'PENDING'
                                          CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
  completed_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- request_status_history ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.request_status_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID        NOT NULL REFERENCES public.absence_requests(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT        NOT NULL,
  changed_by  UUID        NOT NULL REFERENCES auth.users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure notifications.link column exists (added by earlier app code)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.absence_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegated_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;

-- absence_requests
CREATE POLICY "ar_select" ON public.absence_requests FOR SELECT
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR surveillant_id  = auth.uid()
    OR replacement_id  = auth.uid()
  );

CREATE POLICY "ar_insert" ON public.absence_requests FOR INSERT
  WITH CHECK (surveillant_id = auth.uid());

CREATE POLICY "ar_update_own" ON public.absence_requests FOR UPDATE
  USING (surveillant_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "ar_update_admin" ON public.absence_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "ar_delete" ON public.absence_requests FOR DELETE
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR (surveillant_id = auth.uid() AND status = 'PENDING')
  );

-- delegated_tasks
CREATE POLICY "dt_select" ON public.delegated_tasks FOR SELECT
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR original_surveillant_id    = auth.uid()
    OR replacement_surveillant_id = auth.uid()
  );

CREATE POLICY "dt_insert" ON public.delegated_tasks FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'ADMIN')
    OR original_surveillant_id = auth.uid()
  );

CREATE POLICY "dt_update" ON public.delegated_tasks FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR replacement_surveillant_id = auth.uid()
  );

CREATE POLICY "dt_delete" ON public.delegated_tasks FOR DELETE
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR original_surveillant_id = auth.uid()
  );

-- request_status_history
CREATE POLICY "rsh_select" ON public.request_status_history FOR SELECT
  USING (
    public.has_role(auth.uid(), 'ADMIN')
    OR EXISTS (
      SELECT 1 FROM public.absence_requests ar
      WHERE ar.id = request_id
        AND (ar.surveillant_id = auth.uid() OR ar.replacement_id = auth.uid())
    )
  );

CREATE POLICY "rsh_insert" ON public.request_status_history FOR INSERT
  WITH CHECK (changed_by = auth.uid());

-- ── updated_at trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER absence_requests_updated_at
  BEFORE UPDATE ON public.absence_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER delegated_tasks_updated_at
  BEFORE UPDATE ON public.delegated_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
