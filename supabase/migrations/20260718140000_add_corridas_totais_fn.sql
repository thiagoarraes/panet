-- Totais de corridas para o painel admin (agregados PostgREST desabilitados no projeto).
-- security invoker: RLS da tabela corridas continua valendo para quem chama.
CREATE OR REPLACE FUNCTION public.corridas_totais(
  p_status text DEFAULT NULL,
  p_colaborador uuid DEFAULT NULL,
  p_ini timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL
)
RETURNS TABLE(valor numeric, km numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(valor_total), 0), COALESCE(SUM(km), 0)
  FROM public.corridas
  WHERE (p_status IS NULL OR status_extracao = p_status)
    AND (p_colaborador IS NULL OR colaborador_id = p_colaborador)
    AND (p_ini IS NULL OR created_at >= p_ini)
    AND (p_fim IS NULL OR created_at <= p_fim);
$$;
