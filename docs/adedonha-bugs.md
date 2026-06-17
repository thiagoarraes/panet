# Adedonha — lista de bugs

Diagnóstico a partir do incidente de 2026-06-17 (partida de teste derrubou o load do Panet inteiro por esgotamento do pool de conexões do Postgres).

**Status: todos corrigidos em 2026-06-17.**

## Bugs confirmados

### 1. Sala fica presa quando o host sai (sem auto-close)
As transições de fase (`preenchimento → validacao → ranking → próxima`) são disparadas **só pelo host**, no `useEffect` de [AdedonhaApp.jsx](../src/pages/jogos/adedonha/AdedonhaApp.jsx). Se o host sai/fecha a aba no meio, ninguém avança e a sala fica parada para sempre.
- **Impacto:** sala `jogando` órfã + clientes abertos seguem em loop.
- **Correção:** auto-close server-side de salas paradas (cron, igual ao `auto_close_past_presencial`).
- ✅ **Feito:** migration `20260617130000_auto_close_stale_jogo_salas.sql` — função `auto_close_stale_jogo_salas()` + cron `*/5 * * * *` que encerra salas sem atividade há 15+ min.

### 2. Retry-storm do host satura o banco
O `useEffect` de transição em [AdedonhaApp.jsx:86](../src/pages/jogos/adedonha/AdedonhaApp.jsx) **não tem array de deps** (roda a cada render) e o `liberarComBackoff` **re-dispara a mutation a cada 3s** em caso de falha. Com o tick de 1s + invalidações de realtime, vira enxurrada de writes.
- **Impacto:** `idle in transaction`/`aborted` acumulam, slot de replicação do realtime atrasa (~13s), `statement timeout`, **pool de conexões esgota → o Panet inteiro para de carregar** (queries dão `connection timeout`; o dashboard fica preso no skeleton loading).
- **Correção:** backoff exponencial + teto de tentativas; dar deps reais ao `useEffect`.
- ✅ **Feito:** `tentarTransicao` em [AdedonhaApp.jsx](../src/pages/jogos/adedonha/AdedonhaApp.jsx) com guard de reentrância (`emVoo`), teto de 4 tentativas e backoff exponencial (3s→30s) por chave de transição.

### 3. Sem ErrorBoundary global
Não existe ErrorBoundary no app. Qualquer crash de render derruba o app inteiro (tela branca).
- **Correção:** envolver o app (e isolar a página de jogos) com ErrorBoundary.
- ✅ **Feito:** [ErrorBoundary.jsx](../src/components/ErrorBoundary.jsx) novo; envolve o app em [main.jsx](../src/main.jsx) e isola a página de jogos em [JogosPage.jsx](../src/pages/JogosPage.jsx) (crash no jogo não derruba o Panet).

### 4. STOP não propaga para os outros jogadores (realtime)
Quando alguém dá STOP, o overlay e a transição **só aparecem para quem clicou** (ex.: Seven). Os demais continuam na tela de preencher categorias. Quem clicou roda sozinho a fase de validação, percorre as categorias até a última e **a barra de tempo entra em loop sem sair**; ao voltar pro dashboard o Panet fica preso no skeleton.
- **Causa raiz:** o estado entre clientes depende de **realtime** ([useJogoSala.js:147](../src/hooks/queries/useJogoSala.js)); o `invalidarSala` das mutations é **local** (só atualiza o cliente que agiu). Quando o realtime não entrega (estava afogado pelo storm do bug #2; e tabelas com `replica_identity = default` não entregam evento de **DELETE** com filtro `sala_id`), os outros clientes nunca recebem o `stop_em` da rodada.
- **Loop da barra de tempo:** `estadoValidacao` ([adedonha.js](../src/lib/adedonha.js)) calcula `restante` por `decorrido % TEMPO_VALIDACAO_CATEGORIA`; quando `acabou` (índice ≥ total de categorias), `indiceVisivel` trava na última categoria e o `restante` fica ciclando 0..10s. Só sai quando o host conclui `fecharRodada` (mover a sala para `ranking`) — que não acontece se o realtime/host falha.
- **Correção:**
  1. Tornar o realtime confiável (resolver o storm do bug #2; considerar `REPLICA IDENTITY FULL` nas tabelas que precisam de filtro em DELETE).
  2. Fallback de polling enquanto a sala está ativa (refetch periódico independente do realtime), já que o app não pode depender 100% do realtime.
  3. Quando `estadoValidacao.acabou`, parar de renderizar a barra (estado "finalizando…") em vez de ciclar o timer.
  4. Garantir que `fecharRodada`/transições sejam idempotentes e tenham fallback caso o host suma (ligado ao bug #1).
- ✅ **Feito:**
  1. Polling fallback em [useJogoSala.js](../src/hooks/queries/useJogoSala.js): `refetchInterval` de 2,5s enquanto a sala está ativa (fase ≠ `fim`) → STOP/avanço aparecem para todos mesmo se o realtime cair.
  2. Barra de tempo para de ciclar quando `acabou` em [Validacao.jsx](../src/pages/jogos/adedonha/Validacao.jsx) (mostra "Finalizando rodada… · apurando pontuação").
  3. Fallback do host abandonado coberto pelo auto-close (#1).

## Ações já tomadas no incidente
- Salas de teste não-finalizadas encerradas (`status=encerrada, fase=fim`) → quebrou o loop dos clientes abertos.
- Pool liberado; DB confirmado saudável.
