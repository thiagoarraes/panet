# Phase 1: React Query Migration + Realtime Mural + N+1 RPCs

**Date:** 2026-03-19
**Status:** Approved
**Approach:** B — Migração completa com hooks por domínio, domain-by-domain

## Problema

O Layout.jsx (~3200 linhas) centraliza toda a lógica de data fetching, caching manual (businessCache.js com localStorage), e passa dados via props para todas as páginas. Isso causa:

- Cache com TTL Infinity na hidratação (dados stale no reload)
- N+1 queries em galerias e presencial
- Zero real-time (mural usa polling com 1.2s delay)
- Prop drilling massivo (AdminPage recebe 50+ props)
- Código difícil de manter e testar

## Decisões de Design

1. **React Query (TanStack Query)** substitui businessCache.js por completo
2. **Hooks por domínio** — cada página busca seus dados via hooks, sem props do Layout
3. **Realtime** apenas no Mural (via Supabase Realtime + invalidação do React Query)
4. **2 RPCs novas** para eliminar N+1 em presencial e galerias
5. **Migração domain-by-domain** — incremental, testável, reversível
6. **Ordem:** colaboradores → mural → postagens → férias/ausências → presencial → galerias → aniversários

## Arquitetura

### Estrutura de Arquivos

```
src/
  lib/
    queryClient.js              ← QueryClient config
    supabase.js                 ← (existente)
  hooks/
    queries/
      useColaboradores.js
      usePostagens.js
      useMural.js
      useFerias.js
      useAusencias.js
      usePresencial.js
      useGalerias.js
      useAniversarios.js
    mutations/
      usePostMutations.js       ← curtida, comentário, CRUD post
      useMuralMutations.js      ← enviar/deletar mensagem
      useFeriasMutations.js
      useAusenciasMutations.js
      usePresencialMutations.js
      useGaleriaMutations.js
      useAniversarioMutations.js
```

### QueryClient Config

```js
// src/lib/queryClient.js
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,     // 2min default
      gcTime: 10 * 60 * 1000,        // 10min garbage collection
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
```

### Provider (main.jsx)

```jsx
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### staleTime por Domínio

| Domínio | staleTime | Justificativa |
|---------|-----------|---------------|
| colaboradores | 5min | Muda raramente |
| postagens | 2min | Feed social |
| mural | 0s | Chat — realtime cuida da invalidação |
| ferias | 2min | Dados moderados |
| ausencias | 2min | Similar a férias |
| presencial | 45s | Confirmações mudam durante eventos |
| galerias | 90s | Upload de fotos |
| aniversarios | 6h | Dados quase estáticos |

## Hooks de Query

### Padrão geral

```js
export function useDomain() {
  return useQuery({
    queryKey: ['domain'],
    queryFn: async () => {
      const { data, error } = await supabase.from('table').select('...')
      if (error) throw error
      return data
    },
    staleTime: DOMAIN_STALE_TIME,
  })
}
```

### Mural com Realtime

```js
export function useMural() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('mural-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mural' },
        () => queryClient.invalidateQueries({ queryKey: ['mural'] })
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [queryClient])

  return useQuery({
    queryKey: ['mural'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mural')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120)
      if (error) throw error
      return data
    },
    staleTime: 0,
  })
}
```

### Admin Hooks com Paginação

```js
export function useAdminPostagens({ page, pageSize, search }) {
  return useQuery({
    queryKey: ['admin', 'postagens', { page, pageSize, search }],
    queryFn: async () => {
      let query = supabase.from('postagens').select('*', { count: 'exact' })
      if (search) query = query.ilike('titulo', `%${search}%`)
      const { data, count, error } = await query
        .range((page - 1) * pageSize, page * pageSize - 1)
        .order('created_at', { ascending: false })
      if (error) throw error
      return { data, total: count }
    },
    staleTime: 30 * 1000,
  })
}
```

## Hooks de Mutation

### Padrão geral

```js
useMutation({
  mutationFn: async (params) => { /* chamada Supabase */ },
  onMutate: async (params) => { /* optimistic update (quando aplicável) */ },
  onError: (err, params, context) => { /* rollback se optimistic */ },
  onSuccess: () => { /* invalidate queries relacionadas */ },
})
```

### Mural com Optimistic Update

```js
export function useEnviarMensagem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (mensagem) => {
      const { error } = await supabase.from('mural').insert(mensagem)
      if (error) throw error
    },
    onMutate: async (novaMensagem) => {
      await queryClient.cancelQueries({ queryKey: ['mural'] })
      const previous = queryClient.getQueryData(['mural'])
      queryClient.setQueryData(['mural'], (old) => [
        { ...novaMensagem, _pending: true },
        ...(old || []),
      ])
      return { previous }
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['mural'], context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['mural'] })
    },
  })
}
```

### Mapa de Invalidações

| Mutation | Invalida |
|----------|----------|
| criar/editar/deletar post | `['postagens']` |
| curtida / comentário | `['postagens']` |
| enviar/deletar mensagem mural | `['mural']` |
| criar/editar/deletar férias | `['ferias']` |
| criar/editar/deletar ausência | `['ausencias']` |
| confirmar presencial | `['presencial']` |
| upload foto galeria | `['galerias']` |
| parabenizar aniversário | `['aniversarios']` |
| editar colaborador (nome/avatar) | `['colaboradores', 'postagens', 'mural', 'presencial']` |

## Simplificação do Layout

### O que sai (~1700 linhas removidas)

- Todas as funções `load*()` → substituídas pelos hooks de query
- Todas as funções `handle*()` → substituídas pelos hooks de mutation
- `loadAllBusinessData()` + staggered loading → React Query gerencia
- `hydrateBusinessDataFromCache()` → cache nativo do React Query
- `scheduleMuralSync()` → Realtime substitui
- `syncColaboradorReferences()` → invalidação em cascata
- Todas as funções `listAdmin*()` → hooks com paginação
- Estado de dados (colaboradores, postagens, etc.) → vive no React Query
- Props passadas para pages → pages usam hooks direto

### O que fica (~1500 linhas)

- Autenticação e sessão
- Roteamento
- UI do layout (sidebar, header, navegação)
- Lógica de permissões/admin
- Upload de imagens (função utilitária)

### Rotas (antes vs depois)

```jsx
// Antes
<Route path="/dashboard" element={
  <DashboardPage colaboradores={colaboradores} postagens={postagens}
    muralMsgs={muralMsgs} ferias={ferias} ... />
} />

// Depois
<Route path="/dashboard" element={<DashboardPage />} />
```

## RPCs para N+1

### get_presencial_completo

Retorna agendas + confirmações em um único call, eliminando 3 queries sequenciais.

```sql
CREATE OR REPLACE FUNCTION get_presencial_completo(p_agenda_ids uuid[])
RETURNS json AS $$ ... $$
```

### get_galerias_com_fotos

Join único ao invés de fallback em 2-3 queries.

```sql
CREATE OR REPLACE FUNCTION get_galerias_com_fotos()
RETURNS json AS $$ ... $$
```

## Remoção do businessCache.js

Arquivo deletado por completo. Mapeamento de substituição:

| businessCache | React Query |
|---------------|-------------|
| `readCachedDomain()` | `queryClient.getQueryData()` |
| `writeCachedDomain()` | automático no `useQuery` |
| `invalidateCachedDomain()` | `queryClient.invalidateQueries()` |
| `mutateCachedDomain()` | `queryClient.setQueryData()` |
| `runDedupedRequest()` | deduplicação nativa |

## Ordem de Migração

1. **Infraestrutura** — instalar React Query, criar queryClient, adicionar Provider
2. **Colaboradores** — base de tudo, primeiro hook + migrar páginas que usam
3. **Mural** — adicionar Realtime + hook + optimistic updates
4. **Postagens** — hook + mutations (curtida, comentário, CRUD)
5. **Férias + Ausências** — hooks similares, migrar juntos
6. **Presencial** — hook + RPC get_presencial_completo
7. **Galerias** — hook + RPC get_galerias_com_fotos
8. **Aniversários** — hook + mutations parabenização
9. **Cleanup** — remover businessCache.js, limpar Layout, remover props não usadas

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Requests redundantes | Frequentes | -40-60% (dedup + staleTime) |
| Latência presencial/galerias | 3 queries sequenciais | 1 RPC call |
| Mural update delay | 1.2s+ polling | Instantâneo (Realtime) |
| Layout.jsx | ~3200 linhas | ~1500 linhas |
| Prop drilling | 50+ props no AdminPage | 0 (hooks diretos) |
| businessCache.js | 107 linhas manual | Deletado |
