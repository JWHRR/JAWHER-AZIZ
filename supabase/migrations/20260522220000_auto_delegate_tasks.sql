-- =============================================================
-- AUTO DELEGATE TASKS on absence approval
--
-- When called with a request_id, this function:
--   1. Loops every date in [start_date, end_date]
--   2. Looks up the absent surveillant's permanence_template
--      and restaurant_template for that weekday
--   3. Inserts permanences + restaurant_assignments for the
--      replacement (ON CONFLICT DO NOTHING = no double-booking)
--   4. Records each item in delegated_tasks for display
-- Returns the number of tasks created.
-- =============================================================

CREATE OR REPLACE FUNCTION public.auto_delegate_tasks(p_request_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req   RECORD;
  v_date  DATE;
  v_wd    public.weekday;
  v_perm  RECORD;
  v_resto RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_req FROM public.absence_requests WHERE id = p_request_id;
  IF NOT FOUND            THEN RAISE EXCEPTION 'absence_request % not found', p_request_id; END IF;
  IF v_req.replacement_id IS NULL THEN RETURN 0; END IF;

  v_date := v_req.start_date;

  WHILE v_date <= v_req.end_date LOOP

    -- Map Postgres DOW (0=Sunday) → our weekday enum
    v_wd := CASE EXTRACT(DOW FROM v_date)
      WHEN 1 THEN 'LUN'::public.weekday
      WHEN 2 THEN 'MAR'::public.weekday
      WHEN 3 THEN 'MER'::public.weekday
      WHEN 4 THEN 'JEU'::public.weekday
      WHEN 5 THEN 'VEN'::public.weekday
      WHEN 6 THEN 'SAM'::public.weekday
      ELSE        'DIM'::public.weekday
    END;

    -- ── Permanences ──────────────────────────────────────────────
    FOR v_perm IN
      SELECT slot FROM public.permanence_template
      WHERE  surveillant_id = v_req.surveillant_id AND weekday = v_wd
    LOOP
      -- Create the real permanence for the replacement
      INSERT INTO public.permanences (surveillant_id, date, slot, created_by)
      VALUES (v_req.replacement_id, v_date, v_perm.slot, v_req.surveillant_id)
      ON CONFLICT (surveillant_id, date, slot) DO NOTHING;

      -- Record for display in the delegated_tasks tab
      INSERT INTO public.delegated_tasks (
        absence_request_id, original_surveillant_id, replacement_surveillant_id,
        title, task_date, priority
      ) VALUES (
        p_request_id,
        v_req.surveillant_id,
        v_req.replacement_id,
        CASE v_perm.slot::text
          WHEN 'MATIN'      THEN 'Permanence Matin (08h–13h)'
          WHEN 'APRES_MIDI' THEN 'Permanence Après-midi (14h–19h)'
          WHEN 'NUIT'       THEN 'Permanence Nuit (20h–23h)'
          ELSE 'Permanence ' || v_perm.slot::text
        END,
        v_date,
        'NORMAL'
      );

      v_count := v_count + 1;
    END LOOP;

    -- ── Restaurant assignments ────────────────────────────────────
    FOR v_resto IN
      SELECT repas FROM public.restaurant_template
      WHERE  surveillant_id = v_req.surveillant_id AND weekday = v_wd
    LOOP
      -- Create the real restaurant assignment for the replacement
      INSERT INTO public.restaurant_assignments (surveillant_id, date, repas, created_by)
      VALUES (v_req.replacement_id, v_date, v_resto.repas, v_req.surveillant_id)
      ON CONFLICT (date, repas, surveillant_id) DO NOTHING;

      -- Record for display
      INSERT INTO public.delegated_tasks (
        absence_request_id, original_surveillant_id, replacement_surveillant_id,
        title, task_date, priority
      ) VALUES (
        p_request_id,
        v_req.surveillant_id,
        v_req.replacement_id,
        CASE v_resto.repas::text
          WHEN 'PETIT_DEJEUNER' THEN 'Restaurant – Petit-déjeuner'
          WHEN 'DEJEUNER'       THEN 'Restaurant – Déjeuner'
          WHEN 'DINER'          THEN 'Restaurant – Dîner'
          ELSE 'Restaurant ' || v_resto.repas::text
        END,
        v_date,
        'NORMAL'
      );

      v_count := v_count + 1;
    END LOOP;

    v_date := v_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_count;
END;
$$;
