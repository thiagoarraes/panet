-- ─── Auto-close past presencial events ──────────────────────────────────────
-- Called as fire-and-forget RPC from usePresencial and useAdminPresencial
-- before each fetch so that events with data_presencial < TODAY automatically
-- transition from 'aberto' to 'encerrado'.

CREATE OR REPLACE FUNCTION public.auto_close_past_presencial_agendas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE presencial_agendas
  SET    status = 'encerrado'
  WHERE  status = 'aberto'
    AND  data_presencial < CURRENT_DATE;
END;
$$;

-- Allow any authenticated user to trigger the auto-close.
-- The function itself uses SECURITY DEFINER so it runs with elevated
-- privileges regardless of the caller's RLS context.
GRANT EXECUTE ON FUNCTION public.auto_close_past_presencial_agendas() TO authenticated;
