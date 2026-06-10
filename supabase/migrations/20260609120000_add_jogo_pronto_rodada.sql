-- Adedonha: prontidão por jogador na fase de ranking.
-- pronto_rodada guarda o número da rodada em que o jogador marcou "Estou pronto".
-- Jogador é considerado pronto quando pronto_rodada = rodada_atual da sala.
-- Não precisa reset: ao avançar a rodada, rodada_atual muda e a comparação falha.

alter table public.jogo_jogadores
  add column if not exists pronto_rodada smallint not null default 0;
