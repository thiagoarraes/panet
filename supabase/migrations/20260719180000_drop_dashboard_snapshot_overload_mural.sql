-- Remove a sobrecarga antiga de get_dashboard_snapshot(int, int), resíduo do PanZap:
-- ela ainda referenciava public.mural (dropada em 20260719160000), ficando quebrada.
-- A versão de 5 parâmetros tem default em todos e atende qualquer chamada.
drop function if exists public.get_dashboard_snapshot(integer, integer);
