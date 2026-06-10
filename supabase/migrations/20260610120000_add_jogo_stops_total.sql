-- Adedonha: contador de STOPs dados por jogador (para desempate no ranking).
-- stops_total incrementa toda vez que o jogador da STOP com sucesso (primeiro a clicar).
-- ultimo_stop_em guarda o timestamp do ultimo STOP dado, usado como desempate secundario.

alter table public.jogo_jogadores
  add column if not exists stops_total smallint not null default 0,
  add column if not exists ultimo_stop_em timestamptz;
