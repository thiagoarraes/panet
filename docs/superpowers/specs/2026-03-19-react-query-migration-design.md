# Phase 1: React Query Migration + Realtime Mural + N+1 RPCs

**Date:** 2026-03-19
**Status:** Approved
**Approach:** B — Migração completa com hooks por domínio, domain-by-domain

## Problema

O Layout.jsx (~3200 linhas) centraliza toda a lógica de data fetching, caching manual (businessCache.js com localStorage), e passa dados via props para todas as páginas. Isso causa:

- Cache com TTL Infinity na hidratação (dados stale no reload)
- N+1 queries em galerias e presencial
- Realtime existente no mural e colaboradores acoplado ao Layout (difícil de reusar/testar)
- Prop drilling massivo (AdminPage recebe ~44 props)
- Código difícil de manter e testar

## Decisões de Design

1. **React Query (TanStack Query)** substitui businessCache.js por completo
2. **Hooks por domínio** — cada página busca seus dados via hooks, sem props do Layout
3. **Realtime** migrar subscriptions existentes (mural + colaboradores) para dentro dos hooks
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
      admin/
        useAdminPostagens.js
        useAdminFerias.js
        useAdminAusencias.js
        useAdminPresencial.js
        useAdminGaleria.js
        useAdminMural.js
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
| mural | 30s | Chat — realtime atualiza via setQueryData, staleTime evita refetch desnecessário no focus |
| ferias | 2min | Dados moderados |
| ausencias | 2min | Similar a férias |
| presencial | 45s | Confirmações mudam durante eventos |
| galerias | 90s | Upload de fotos |
| aniversarios | 6h | Dados quase estáticos |

## Hooks de Query

### Padrão geral

```js
export function useDomain(userId) {
  return useQuery({
    queryKey: ['domain'],
    queryFn: async () => {
      const { data, error } = await supabase.from('table').select('...')
      if (error) throw error
      return data
    },
    staleTime: DOMAIN_STALE_TIME,
    enabled: !!userId, // só busca quando autenticado
  })
}
```

### Mural com Realtime (migração da lógica existente)

O Layout.jsx já possui subscriptions Realtime para mural (INSERT/UPDATE/DELETE) e colaboradores.
A migração **move** essa lógica para dentro dos hooks, usando `setQueryData` para atualização
cirúrgica do cache (sem refetch completo a cada evento).

```js
export function useMural(userId) {
  const queryClient = useQueryClient()

  // Realtime — atualiza cache cirurgicamente (como o Layout já faz hoje)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('mural-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mural' },
        (payload) => {
          queryClient.setQueryData(['mural'], (old) => {
            if (!old) return old
            // Evita duplicata se a mensagem já foi inserida otimisticamente
            if (old.some(m => m.id === payload.new.id)) {
              return old.map(m => m.id === payload.new.id ? payload.new : m)
            }
            return [payload.new, ...old]
          })
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mural' },
        (payload) => {
          queryClient.setQueryData(['mural'], (old) =>
            old?.map(m => m.id === payload.new.id ? payload.new : m)
          )
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'mural' },
        (payload) => {
          queryClient.setQueryData(['mural'], (old) =>
            old?.filter(m => m.id !== payload.old.id)
          )
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, queryClient])

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
    staleTime: 30 * 1000, // realtime cuida da freshness, staleTime evita refetch no focus
    enabled: !!userId,
  })
}
```

### Colaboradores com Realtime (migração da subscription existente)

O Layout.jsx também tem uma subscription Realtime em colaboradores que cascateia
reloads para férias e aniversários. Essa lógica é movida para o hook:

```js
export function useColaboradores(userId) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('colaboradores-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'colaboradores' },
        () => {
          // Invalida colaboradores + domínios dependentes
          queryClient.invalidateQueries({ queryKey: ['colaboradores'] })
          queryClient.invalidateQueries({ queryKey: ['ferias'] })
          queryClient.invalidateQueries({ queryKey: ['aniversarios'] })
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, queryClient])

  return useQuery({
    queryKey: ['colaboradores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, nome, email, cargo, setor, avatar_url, perfil, telefone, aniversario')
        .order('nome')
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
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
| editar colaborador (nome/avatar) | `['colaboradores', 'postagens', 'mural', 'presencial', 'ferias', 'aniversarios']` |

## Loading e Error States

### Estratégia

Usar `isLoading` / `isError` em cada componente (sem Suspense boundaries — mais controle).

**Dashboard** — consome múltiplos domínios. Cada card exibe seu próprio loading/error state
independentemente, permitindo renderização progressiva (cards que carregam primeiro aparecem
primeiro, sem bloquear os demais):

```jsx
function DashboardPage() {
  const { data: postagens, isLoading: loadingPosts } = usePostagens(userId)
  const { data: muralMsgs, isLoading: loadingMural } = useMural(userId)
  // ...
  return (
    <>
      <PostagensCard data={postagens} loading={loadingPosts} />
      <MuralCard data={muralMsgs} loading={loadingMural} />
    </>
  )
}
```

**Páginas simples** — loading spinner enquanto `isLoading`, fallback de erro com retry:

```jsx
if (isLoading) return <Spinner />
if (isError) return <ErrorCard onRetry={refetch} />
```

### DevTools (apenas em dev)

Instalar `@tanstack/react-query-devtools` para debug durante a migração:

```jsx
// main.jsx (só em desenvolvimento)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

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
3. **Mural** — migrar Realtime existente para hook + optimistic updates com setQueryData
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
| Mural realtime | Acoplado ao Layout | Encapsulado no hook useMural |
| Layout.jsx | ~3200 linhas | ~1500 linhas |
| Prop drilling | ~44 props no AdminPage | 0 (hooks diretos) |
| businessCache.js | 107 linhas manual | Deletado |
