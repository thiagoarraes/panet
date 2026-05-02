-- Corrige auto_close para usar o horário de Brasília em vez de UTC.
-- Sem essa correção, eventos criados para "hoje" são fechados imediatamente
-- após as 21h no Brasil, porque o servidor UTC já considera que é amanhã.
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
    AND  data_presencial < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_close_past_presencial_agendas() TO authenticated;
