# React Query Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Panet app from manual localStorage caching (businessCache.js) to TanStack React Query, with domain-based hooks, Supabase Realtime in hooks, and N+1 RPC fixes.

**Architecture:** Each data domain (colaboradores, postagens, mural, etc.) gets its own query hook and mutation hook. Pages consume data via hooks instead of props from Layout.jsx. Layout shrinks from ~3200 to ~1500 lines. Migration is incremental — domain by domain.

**Tech Stack:** React 18, TanStack React Query v5, Supabase JS v2, Vite 5

**Spec:** `docs/superpowers/specs/2026-03-19-react-query-migration-design.md`

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `src/lib/queryClient.js` | QueryClient singleton with default options |
| `src/hooks/queries/useColaboradores.js` | Fetch + Realtime subscription for colaboradores |
| `src/hooks/queries/useMural.js` | Fetch + Realtime subscription for mural |
| `src/hooks/queries/usePostagens.js` | Fetch postagens with curtidas/comentarios |
| `src/hooks/queries/useFerias.js` | Fetch ferias + dayoff |
| `src/hooks/queries/useAusencias.js` | Fetch ausencias |
| `src/hooks/queries/usePresencial.js` | Fetch presencial via RPC |
| `src/hooks/queries/useGalerias.js` | Fetch galerias via RPC |
| `src/hooks/queries/useAniversarios.js` | Fetch aniversarios via RPC |
| `src/hooks/queries/admin/useAdminPostagens.js` | Paginated admin postagens |
| `src/hooks/queries/admin/useAdminFerias.js` | Paginated admin ferias |
| `src/hooks/queries/admin/useAdminAusencias.js` | Paginated admin ausencias |
| `src/hooks/queries/admin/useAdminPresencial.js` | Paginated admin presencial |
| `src/hooks/queries/admin/useAdminGaleria.js` | Paginated admin galeria |
| `src/hooks/queries/admin/useAdminMural.js` | Paginated admin mural |
| `src/hooks/mutations/usePostMutations.js` | Curtida, comentario, CRUD post |
| `src/hooks/mutations/useMuralMutations.js` | Enviar/deletar mensagem mural |
| `src/hooks/mutations/useFeriasMutations.js` | CRUD ferias |
| `src/hooks/mutations/useAusenciasMutations.js` | CRUD ausencias |
| `src/hooks/mutations/usePresencialMutations.js` | Confirmar, amigo secreto |
| `src/hooks/mutations/useGaleriaMutations.js` | CRUD galeria/fotos |
| `src/hooks/mutations/useAniversarioMutations.js` | Parabenizar |
| `supabase/migrations/YYYYMMDD_rpc_presencial_completo.sql` | RPC get_presencial_completo |
| `supabase/migrations/YYYYMMDD_rpc_galerias_com_fotos.sql` | RPC get_galerias_com_fotos |

### Files to modify

| File | Change |
|------|--------|
| `package.json` | Add @tanstack/react-query, @tanstack/react-query-devtools |
| `src/main.jsx` | Wrap App in QueryClientProvider |
| `src/components/Layout.jsx` | Remove load/handle functions domain by domain, remove props, remove businessCache imports, remove realtime (moved to hooks) |
| `src/pages/DashboardPage.jsx` | Replace props with hooks |
| `src/pages/PostagensPage.jsx` | Replace props with hooks |
| `src/pages/PostDetalhePage.jsx` | Replace props with hooks |
| `src/pages/ColaboradoresPage.jsx` | Replace props with hooks |
| `src/pages/AniversariosPage.jsx` | Replace props with hooks |
| `src/pages/FeriasPage.jsx` | Replace props with hooks |
| `src/pages/PresencialPage.jsx` | Replace props with hooks |
| `src/pages/GaleriaPage.jsx` | Replace props with hooks |
| `src/pages/PerfilPage.jsx` | Substituir props de perfil/onSalvar por hooks |
| `src/pages/admin/AdminPage.jsx` | Remover props massivos, sub-páginas usam hooks |
| `src/pages/admin/AdminPostagens.jsx` | Usar useAdminPostagens hook |
| `src/pages/admin/AdminFerias.jsx` | Usar useAdminFerias + useAdminAusencias hooks (ausências é gerenciado dentro de AdminFerias) |
| `src/pages/admin/AdminPresencial.jsx` | Usar useAdminPresencial hook |
| `src/pages/admin/AdminGaleria.jsx` | Usar useAdminGaleria hook |
| `src/pages/admin/AdminMural.jsx` | Usar useAdminMural hook |
| `src/pages/admin/AdminColaboradores.jsx` | Usar useColaboradores hook |
| `src/pages/admin/AdminAniversarios.jsx` | Usar useAniversarios hook |

**Nota:** `MuralPage.jsx` existe mas NÃO é renderizado nas rotas — é código morto. Verificar e deletar na Task 10 se confirmado.
**Nota:** `AdminAusencias.jsx` NÃO existe como arquivo separado — ausências são gerenciadas dentro de `AdminFerias.jsx`.

### Files to delete

| File | Reason |
|------|--------|
| `src/lib/businessCache.js` | Entirely replaced by React Query (Task 9) |

---

## Task 1: Infrastructure — Install React Query + Provider

**Files:**
- Modify: `package.json`
- Create: `src/lib/queryClient.js`
- Modify: `src/main.jsx`

- [ ] **Step 1: Install dependencies**

```bash
cd C:\Users\thiaq\Downloads\Projetos\panet\.claude\worktrees\gracious-nightingale
npm install @tanstack/react-query@^5
npm install -D @tanstack/react-query-devtools@^5
```

- [ ] **Step 2: Create queryClient.js**

Create `src/lib/queryClient.js`:

```js
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
```

- [ ] **Step 3: Wrap App in QueryClientProvider**

Modify `src/main.jsx` — add QueryClientProvider around App:

```jsx
import "./styles/global.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Verify dev server**

```bash
npm run dev
```

Expected: app loads normally — React Query is installed but not yet used.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/queryClient.js src/main.jsx
git commit -m "feat: add React Query infrastructure (QueryClient + Provider + DevTools)"
```

---

## Task 2: Colaboradores — Query Hook + Realtime

This is the foundation. All other domains depend on colaboradores data.

**Files:**
- Create: `src/hooks/queries/useColaboradores.js`
- Modify: `src/components/Layout.jsx` — remove `loadColaboradores`, colaboradores state, realtime subscription
- Modify: `src/pages/ColaboradoresPage.jsx` — use hook instead of props

**Important context:**
- Layout.jsx currently loads colaboradores at `loadColaboradores` callback (~line 660-730)
- Colaboradores have a Realtime channel `colaboradores-live-${currentProfile.id}` (~line 1887-1907)
- `syncColaboradorReferences()` cascades updates — React Query invalidation replaces this
- Mock data fallback: `isSupabaseEnabled ? [] : COLABORADORES` — hooks must handle this

**Regra de segurança para todos os hooks:** O `supabase` é `null` quando `isSupabaseEnabled` é `false`. Todo `queryFn` e `useEffect` DEVE verificar `if (!isSupabaseEnabled || !supabase)` antes de chamar métodos do supabase.

- [ ] **Step 1: Criar useColaboradores hook**

Criar `src/hooks/queries/useColaboradores.js`:

```js
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase";
import { COLABORADORES } from "../../data/mockData";

const STALE_TIME = 5 * 60 * 1000; // 5min

export function useColaboradores(userId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !isSupabaseEnabled || !supabase) return;
    const channel = supabase
      .channel(`colaboradores-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "colaboradores" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
          queryClient.invalidateQueries({ queryKey: ["ferias"] });
          queryClient.invalidateQueries({ queryKey: ["aniversarios"] });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, queryClient]);

  return useQuery({
    queryKey: ["colaboradores"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return COLABORADORES;
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome, email, cargo, setor, avatar_url, perfil, telefone, aniversario, admin_modulos, cor")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: !!userId || !isSupabaseEnabled,
  });
}
```

**Note for implementer:** The exact `.select()` columns must match what `loadColaboradores` in Layout.jsx currently selects. Read the existing `loadColaboradores` function and copy the exact select string. The columns listed above are an approximation — verify against the actual code.

- [ ] **Step 2: Migrate ColaboradoresPage to use hook**

Read `src/pages/ColaboradoresPage.jsx` to understand current prop structure. Then replace the `colaboradores` prop with the hook:

```js
// At top of file, add:
import { useColaboradores } from "../hooks/queries/useColaboradores";

// In the component, replace prop with:
export function ColaboradoresPage({ currentUserId }) {
  const { data: colaboradores = [] } = useColaboradores(currentUserId);
  // ... rest of component stays the same
}
```

**Note for implementer:** The page may receive other props besides `colaboradores`. Only remove the `colaboradores` prop — keep all other props unchanged for now.

- [ ] **Step 3: Atualizar Layout.jsx — parar de passar prop colaboradores para ColaboradoresPage**

No Layout.jsx, encontrar onde `<ColaboradoresPage` é renderizado e remover a prop `colaboradores`. Passar `currentUserId={currentProfile?.id}` se não estiver já passado.

**NÃO remover** `loadColaboradores` nem o state de colaboradores do Layout ainda — outras páginas ainda dependem. Isso acontece na Task 10 (Cleanup).

- [ ] **Step 3b: Migrar AdminColaboradores.jsx**

`AdminColaboradores.jsx` recebe `initialColaboradores` e `onDeleteColaborador` do AdminPage. Substituir por `useColaboradores(currentUserId)` direto no componente. O hook de mutation para delete de colaborador pode ser chamado via edge function como já é feito — manter a lógica `invokeAdminFunctionHttp` existente mas disparar `queryClient.invalidateQueries({ queryKey: ['colaboradores'] })` no sucesso.

- [ ] **Step 4: Verify build + dev server**

```bash
npm run build
```

Open the app, navigate to the Colaboradores page. Verify data loads correctly.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/queries/useColaboradores.js src/pages/ColaboradoresPage.jsx src/components/Layout.jsx
git commit -m "feat: add useColaboradores hook with Realtime, migrate ColaboradoresPage"
```

---

## Task 3: Mural — Query Hook + Realtime + Optimistic Mutations

**Files:**
- Create: `src/hooks/queries/useMural.js`
- Create: `src/hooks/mutations/useMuralMutations.js`
- Modify: `src/pages/DashboardPage.jsx` — use hooks for mural section (partial migration)

**Important context:**
- The mural Realtime in Layout.jsx (~line 1824-1878) has sophisticated logic: `resolveColaborador()`, `mapDbMuralToUi()`, and PanZap latency metrics via `panzapPendingRef`
- The hook must apply the same data transformation as the queryFn
- `handleEnviarMensagem` uses optimistic updates with `upsertMuralMessage()`
- Mural messages have `colaborador_id`, `texto`, `data`, `hora` fields

- [ ] **Step 1: Study existing mural loading + realtime in Layout.jsx**

Read Layout.jsx sections:
- `loadMural` function — understand the select query and data mapping
- Mural realtime subscription — understand `resolveColaborador()` and `mapDbMuralToUi()`
- `handleEnviarMensagem` — understand the optimistic update pattern
- `handleDeleteMuralMensagem` / `handleDeleteMuralMensagens`

Document the exact Supabase query and data transformations before writing the hook.

- [ ] **Step 2: Create useMural hook**

Create `src/hooks/queries/useMural.js`:

The hook must:
1. Fetch mural messages with the same `.select()` and `.order()` as `loadMural`
2. Subscribe to Realtime INSERT/UPDATE/DELETE on `mural` table
3. Use `queryClient.setQueryData` for surgical cache updates (not invalidateQueries)
4. Apply the same data transformation (`mapDbMuralToUi` equivalent) in both queryFn and realtime handlers

```js
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "../../lib/supabase";
import { MURAL_INIT } from "../../data/mockData";

const STALE_TIME = 30 * 1000; // 30s (era 20s no cache antigo, aumentado porque Realtime cuida da freshness)
const MURAL_LIMIT = 120;

// Copy the exact mapDbMuralToUi transform from Layout.jsx
function mapMuralRow(row) {
  // IMPLEMENTER: copy the mapping logic from Layout.jsx's mural data transform
  return row;
}

export function useMural(userId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !isSupabaseEnabled || !supabase) return;
    const channel = supabase
      .channel(`mural-live-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mural" },
        (payload) => {
          queryClient.setQueryData(["mural"], (old) => {
            if (!old) return old;
            const mapped = mapMuralRow(payload.new);
            if (old.some((m) => m.id === mapped.id)) {
              return old.map((m) => (m.id === mapped.id ? mapped : m));
            }
            return [mapped, ...old];
          });
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mural" },
        (payload) => {
          queryClient.setQueryData(["mural"], (old) =>
            old?.map((m) => (m.id === payload.new.id ? mapMuralRow(payload.new) : m))
          );
        }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mural" },
        (payload) => {
          queryClient.setQueryData(["mural"], (old) =>
            old?.filter((m) => m.id !== payload.old.id)
          );
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, queryClient]);

  return useQuery({
    queryKey: ["mural"],
    queryFn: async () => {
      if (!isSupabaseEnabled || !supabase) return MURAL_INIT;
      const { data, error } = await supabase
        .from("mural")
        .select("*") // IMPLEMENTER: use exact same select as loadMural
        .order("created_at", { ascending: false })
        .limit(MURAL_LIMIT);
      if (error) throw error;
      return (data || []).map(mapMuralRow);
    },
    staleTime: STALE_TIME,
    enabled: !!userId || !isSupabaseEnabled,
  });
}
```

- [ ] **Step 3: Create useMuralMutations**

Create `src/hooks/mutations/useMuralMutations.js`:

```js
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export function useEnviarMensagem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mensagem) => {
      const { data, error } = await supabase.from("mural").insert(mensagem).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async (novaMensagem) => {
      await queryClient.cancelQueries({ queryKey: ["mural"] });
      const previous = queryClient.getQueryData(["mural"]);
      queryClient.setQueryData(["mural"], (old) => [
        { ...novaMensagem, _pending: true, id: `temp-${Date.now()}` },
        ...(old || []),
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["mural"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });
}

export function useDeleteMuralMensagem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("mural").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });
}

export function useDeleteMuralMensagens() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids) => {
      const { error } = await supabase.from("mural").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural"] });
    },
  });
}
```

**Note for implementer:** The `handleEnviarMensagem` in Layout.jsx has PanZap latency metric tracking via `panzapPendingRef`. Decide whether to preserve this in the mutation hook or move it to the consuming component. Recommend: keep metric tracking in the DashboardPage component where it's consumed, using the mutation's `onSuccess` callback.

- [ ] **Step 4: Partially migrate DashboardPage — mural section only**

In `src/pages/DashboardPage.jsx`:
- Import `useMural` and `useEnviarMensagem`
- Replace `muralMsgs` prop with `const { data: muralMsgs = [] } = useMural(currentUserId)`
- Replace `onEnviarMensagem` prop usage with `const enviarMensagem = useEnviarMensagem()`
- Keep all other props unchanged (they'll be migrated in later tasks)

- [ ] **Step 5: Update Layout.jsx — stop passing mural props to DashboardPage**

Remove `muralMsgs` and `onEnviarMensagem` props from the DashboardPage render in Layout.jsx. Keep other props.

- [ ] **Step 6: Verify build + test mural**

```bash
npm run build
```

Open app, navigate to Dashboard. Test:
1. Mural messages load correctly
2. Sending a message works (optimistic + persisted)
3. Messages from other tabs/users appear via Realtime

- [ ] **Step 7: Commit**

```bash
git add src/hooks/queries/useMural.js src/hooks/mutations/useMuralMutations.js src/pages/DashboardPage.jsx src/components/Layout.jsx
git commit -m "feat: add useMural + useMuralMutations hooks with Realtime, migrate DashboardPage mural"
```

---

## Task 3.5: Extrair utilitários compartilhados do Layout.jsx

**Files:**
- Create: `src/lib/imageUtils.js`
- Modify: `src/components/Layout.jsx` — importar de imageUtils em vez de definir localmente

As mutations de postagens e galerias precisam de `optimizeImageToWebp` e helpers de storage path. Extraí-los antes de criar os hooks de mutation.

- [ ] **Step 1: Extrair funções utilitárias do Layout.jsx**

Mover para `src/lib/imageUtils.js`:
- `optimizeImageToWebp(file, options)`
- `getGaleriaStoragePathFromUrl(rawUrl)`
- `getAvatarStoragePathFromUrl(rawUrl)`
- `getPostStoragePathFromUrl(rawUrl)`

- [ ] **Step 2: Atualizar Layout.jsx para importar de imageUtils.js**

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/imageUtils.js src/components/Layout.jsx
git commit -m "refactor: extrair utilitários de imagem do Layout para lib/imageUtils"
```

---

## Task 4: Postagens — Query Hook + Mutations

**Files:**
- Create: `src/hooks/queries/usePostagens.js`
- Create: `src/hooks/mutations/usePostMutations.js`
- Modify: `src/pages/PostagensPage.jsx` — use hooks
- Modify: `src/pages/PostDetalhePage.jsx` — use hooks
- Modify: `src/pages/DashboardPage.jsx` — replace postagens props with hook

**Important context:**
- Postagens are loaded with nested relations: `curtidas(colaborador_id)` and `comentarios(id, autor:colaboradores(id, nome, avatar_url), texto, created_at, updated_at)`
- `handleToggleCurtida`, `handleComentar`, `handleEditarComentario`, `handleDeletarComentario` all invalidate postagens
- `handleCreatePost`, `handleUpdatePost`, `handleDeletePost` also invalidate postagens
- Some handlers involve storage operations (image upload/delete)

- [ ] **Step 1: Study loadPostagens and all post handlers in Layout.jsx**

Read the exact `.select()` query, data mapping, and all mutation handlers. Document columns and relations.

- [ ] **Step 2: Create usePostagens hook**

Create `src/hooks/queries/usePostagens.js` with the exact same query. Use `staleTime: 2 * 60 * 1000`.

- [ ] **Step 3: Create usePostMutations**

Create `src/hooks/mutations/usePostMutations.js` with:
- `useToggleCurtida()` — insert/delete curtida, invalidates `['postagens']`
- `useComentar()` — insert comentario, invalidates `['postagens']`
- `useEditarComentario()` — update comentario, invalidates `['postagens']`
- `useDeletarComentario()` — delete comentario, invalidates `['postagens']`
- `useCreatePost()` — insert post (with image upload if needed), invalidates `['postagens']`
- `useUpdatePost()` — update post, invalidates `['postagens']`
- `useDeletePost()` — delete post (with image cleanup), invalidates `['postagens']`

**Note for implementer:** Image upload/delete logic is in `handleCreatePost`/`handleDeletePost` in Layout.jsx. The `optimizeImageToWebp` utility function in Layout.jsx will need to be accessible from the mutation hook. Either import it from Layout or extract it to a shared utility file `src/lib/imageUtils.js`.

- [ ] **Step 4: Migrar PostagensPage, PostDetalhePage, DashboardPage**

Substituir props de postagens por hooks em cada página. Remover props correspondentes do Layout.jsx.

**Nota sobre PostDetalhePage:** Esta página recebe props de quase todos os domínios (postagens, colaboradores, mural, ferias, aniversarios). Nesta task, migrar apenas os props de postagens (curtida, comentário, CRUD). Os demais props serão removidos progressivamente nas Tasks 5-8 conforme cada domínio é migrado.

- [ ] **Step 5: Verify build + test posts**

Test: view posts, like/unlike, comment, edit comment, delete comment, create post, edit post, delete post.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/queries/usePostagens.js src/hooks/mutations/usePostMutations.js src/pages/PostagensPage.jsx src/pages/PostDetalhePage.jsx src/pages/DashboardPage.jsx src/components/Layout.jsx
git commit -m "feat: add usePostagens + usePostMutations hooks, migrate post pages"
```

---

## Task 5: Ferias + Ausencias — Query Hooks + Mutations

**Files:**
- Create: `src/hooks/queries/useFerias.js`
- Create: `src/hooks/queries/useAusencias.js`
- Create: `src/hooks/mutations/useFeriasMutations.js`
- Create: `src/hooks/mutations/useAusenciasMutations.js`
- Modify: `src/pages/FeriasPage.jsx` — use hooks
- Modify: `src/pages/DashboardPage.jsx` — replace ferias/dayoff/ausencias props

**Important context:**
- `loadFerias` returns both `ferias` AND `dayoff` arrays (split by type) — the hook should return `{ ferias, dayoff }`
- Ausencias is a separate domain with its own cache
- DashboardPage uses ferias, dayoff, AND ausencias in the PanOff card

- [ ] **Step 1: Study loadFerias and loadAusencias in Layout.jsx**

Document the select queries, data splitting logic (ferias vs dayoff), and mutation handlers.

- [ ] **Step 2: Create useFerias hook**

Create `src/hooks/queries/useFerias.js`. The hook must return `{ ferias, dayoff }` to match current data shape. `staleTime: 2 * 60 * 1000`.

```js
export function useFerias(userId) {
  return useQuery({
    queryKey: ["ferias"],
    queryFn: async () => {
      // IMPLEMENTER: copy exact query from loadFerias
      // Split result into { ferias, dayoff } as Layout does
      return { ferias: [], dayoff: [] };
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!userId || !isSupabaseEnabled,
  });
}
```

Consuming pages use:
```js
const { data } = useFerias(userId);
const ferias = data?.ferias || [];
const dayoff = data?.dayoff || [];
```

- [ ] **Step 3: Create useAusencias hook**

Create `src/hooks/queries/useAusencias.js`. `staleTime: 2 * 60 * 1000`.

- [ ] **Step 4: Create mutation hooks**

Create `useFeriasMutations.js` and `useAusenciasMutations.js` with CRUD operations. Each invalidates its own query key.

- [ ] **Step 5: Migrate FeriasPage and DashboardPage**

Replace ferias/dayoff/ausencias props with hooks. Remove props from Layout.jsx.

- [ ] **Step 6: Verify build + test**

Test: view ferias list, create/edit/delete ferias, view PanOff card on dashboard with ausencias.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/queries/useFerias.js src/hooks/queries/useAusencias.js src/hooks/mutations/useFeriasMutations.js src/hooks/mutations/useAusenciasMutations.js src/pages/FeriasPage.jsx src/pages/DashboardPage.jsx src/components/Layout.jsx
git commit -m "feat: add useFerias + useAusencias hooks with mutations, migrate pages"
```

---

## Task 6: Presencial — Query Hook + RPC + Mutations

**Files:**
- Create: `src/hooks/queries/usePresencial.js`
- Create: `src/hooks/mutations/usePresencialMutations.js`
- Create: `supabase/migrations/YYYYMMDD_rpc_presencial_completo.sql`
- Modify: `src/pages/PresencialPage.jsx` — use hooks

**Important context:**
- Currently 3 sequential queries: agendas → confirmacoes → amigo secreto results
- The RPC `get_presencial_completo` combines these into 1 call
- Mutations: `handleRespondPresencial`, `handleTogglePresencialSecretSanta`, `handleRunPresencialSecretSanta`
- `handleCreatePresencialAgenda`, `handleUpdatePresencialAgenda`, `handleDeletePresencialAgenda`

- [ ] **Step 1: Study loadPresencial and all presencial handlers in Layout.jsx**

Document the 3 sequential queries and their data shapes. Design the RPC to return the combined result.

- [ ] **Step 2: Create Supabase migration for get_presencial_completo RPC**

Create `supabase/migrations/YYYYMMDD_rpc_presencial_completo.sql`:

```sql
-- IMPLEMENTER: Write the RPC based on the exact queries in loadPresencial.
-- It should return agendas with their confirmacoes and amigo secreto results
-- in a single call, eliminating the N+1 pattern.
CREATE OR REPLACE FUNCTION get_presencial_completo()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Combine the 3 queries from loadPresencial into 1
  -- Return: agendas[] with nested confirmacoes[] and amigo_secreto_results
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT a.*,
      (SELECT json_agg(row_to_json(c))
       FROM presencial_confirmacoes c
       LEFT JOIN colaboradores col ON col.id = c.colaborador_id
       WHERE c.agenda_id = a.id
      ) AS confirmacoes
    FROM presencial_agendas a
    ORDER BY a.data DESC
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
```

**Note for implementer:** The exact query structure depends on what `loadPresencial` does. The SQL above is a starting point — adjust to match the actual data shape.

- [ ] **Step 3: Apply migration**

```bash
# If using Supabase CLI:
npx supabase db push
# Or apply manually via Supabase dashboard SQL editor
```

- [ ] **Step 4: Create usePresencial hook using the RPC**

Create `src/hooks/queries/usePresencial.js`. `staleTime: 45 * 1000`.

- [ ] **Step 5: Create usePresencialMutations**

Create `src/hooks/mutations/usePresencialMutations.js` with:
- `useRespondPresencial()` — confirm/decline attendance
- `useToggleSecretSanta()` — join/leave amigo secreto
- `useRunSecretSanta()` — execute draw
- `useCreatePresencialAgenda()`, `useUpdatePresencialAgenda()`, `useDeletePresencialAgenda()`

All invalidate `['presencial']`.

- [ ] **Step 6: Migrate PresencialPage**

Replace props with hooks.

- [ ] **Step 7: Verify build + test**

Test: view presencial page, confirm attendance, amigo secreto flow.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/queries/usePresencial.js src/hooks/mutations/usePresencialMutations.js src/pages/PresencialPage.jsx src/components/Layout.jsx supabase/migrations/
git commit -m "feat: add usePresencial hook with RPC, eliminate N+1 queries"
```

---

## Task 7: Galerias — Query Hook + RPC + Mutations

**Files:**
- Create: `src/hooks/queries/useGalerias.js`
- Create: `src/hooks/mutations/useGaleriaMutations.js`
- Create: `supabase/migrations/YYYYMMDD_rpc_galerias_com_fotos.sql`
- Modify: `src/pages/GaleriaPage.jsx` — use hooks

**Important context:**
- Currently has a fallback pattern: try join → if fail, fetch eventos + fotos separately
- The RPC eliminates this by returning eventos with fotos in a single call
- Mutations involve storage operations (photo upload/delete)

- [ ] **Step 1: Study loadGaleria and all galeria handlers in Layout.jsx**

- [ ] **Step 2: Create Supabase migration for get_galerias_com_fotos RPC**

- [ ] **Step 3: Apply migration**

- [ ] **Step 4: Create useGalerias hook using the RPC**

`staleTime: 90 * 1000`.

- [ ] **Step 5: Create useGaleriaMutations**

With: `useCreateGaleriaEvento()`, `useUpdateGaleriaEvento()`, `useDeleteGaleriaEvento()`, `useAddGaleriaFoto()`, `useUpdateGaleriaFoto()`, `useDeleteGaleriaFoto()`, `useSetGaleriaCapa()`, `useUploadGaleriaFotos()`. All invalidate `['galerias']`.

**Note for implementer:** `handleUploadGaleriaFotos` in Layout.jsx involves storage bucket operations and the `optimizeImageToWebp` utility. Extract this to a shared utility if not already done in Task 4.

- [ ] **Step 6: Migrate GaleriaPage**

- [ ] **Step 7: Verify build + test gallery operations**

- [ ] **Step 8: Commit**

```bash
git add src/hooks/queries/useGalerias.js src/hooks/mutations/useGaleriaMutations.js src/pages/GaleriaPage.jsx src/components/Layout.jsx supabase/migrations/
git commit -m "feat: add useGalerias hook with RPC, eliminate N+1 queries"
```

---

## Task 8: Aniversarios — Query Hook + Mutations

**Files:**
- Create: `src/hooks/queries/useAniversarios.js`
- Create: `src/hooks/mutations/useAniversarioMutations.js`
- Modify: `src/pages/AniversariosPage.jsx` — use hooks
- Modify: `src/pages/DashboardPage.jsx` — replace aniversariantes prop

**Important context:**
- Uses RPC `get_aniversariantes_with_reacoes` with `p_ano` parameter
- `staleTime: 6 * 60 * 60 * 1000` (6 hours — very stable data)
- `handleParabenizarAniversario` is the only mutation

- [ ] **Step 1: Study loadAniversarios and handleParabenizarAniversario in Layout.jsx**

- [ ] **Step 2: Create useAniversarios hook**

```js
export function useAniversarios(userId) {
  return useQuery({
    queryKey: ["aniversarios", new Date().getFullYear()],
    queryFn: async () => {
      if (!isSupabaseEnabled) return ANIVERSARIANTES_INIT;
      const { data, error } = await supabase.rpc("get_aniversariantes_with_reacoes", {
        p_ano: new Date().getFullYear(),
      });
      if (error) throw error;
      return data || [];
    },
    staleTime: 6 * 60 * 60 * 1000,
    enabled: !!userId || !isSupabaseEnabled,
  });
}
```

- [ ] **Step 3: Create useAniversarioMutations**

`useParabenizar()` — insert parabenizacao, invalidates `['aniversarios']`.

- [ ] **Step 4: Migrate AniversariosPage and DashboardPage**

Replace aniversariantes/onParabenizar props with hooks.

- [ ] **Step 5: Verify build + test**

- [ ] **Step 6: Commit**

```bash
git add src/hooks/queries/useAniversarios.js src/hooks/mutations/useAniversarioMutations.js src/pages/AniversariosPage.jsx src/pages/DashboardPage.jsx src/components/Layout.jsx
git commit -m "feat: add useAniversarios hook with mutations, migrate pages"
```

---

## Task 9: Admin Hooks — Paginated Queries

**Files:**
- Create: `src/hooks/queries/admin/useAdminPostagens.js`
- Create: `src/hooks/queries/admin/useAdminFerias.js`
- Create: `src/hooks/queries/admin/useAdminAusencias.js`
- Create: `src/hooks/queries/admin/useAdminPresencial.js`
- Create: `src/hooks/queries/admin/useAdminGaleria.js`
- Create: `src/hooks/queries/admin/useAdminMural.js`
- Modify: `src/pages/admin/AdminPage.jsx` — remove massive prop list
- Modify: `src/pages/admin/Admin*.jsx` — use hooks instead of props

**Important context:**
- Each admin page has: search, pagination (page + pageSize), count query
- Layout.jsx has `listAdminPostagens`, `listAdminFerias`, etc. — these become hooks
- `ADMIN_LIST_CACHE_TTL = 30s` → `staleTime: 30 * 1000`
- AdminPage currently receives ~44 props — goal is 0 data props

- [ ] **Step 1: Study all listAdmin* functions in Layout.jsx**

Document the exact query patterns for each admin domain (select, filters, pagination, search).

- [ ] **Step 2: Create admin hooks (all 6)**

Each follows this pattern:

```js
// src/hooks/queries/admin/useAdminPostagens.js
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";

export function useAdminPostagens({ page = 1, pageSize = 20, search = "" } = {}) {
  return useQuery({
    queryKey: ["admin", "postagens", { page, pageSize, search }],
    queryFn: async () => {
      let query = supabase.from("postagens").select("*", { count: "exact" });
      if (search) {
        query = query.ilike("titulo", `%${search}%`);
      }
      const { data, count, error } = await query
        .range((page - 1) * pageSize, page * pageSize - 1)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { data: data || [], total: count || 0 };
    },
    staleTime: 30 * 1000,
  });
}
```

**Note for implementer:** Each admin list function has different search fields and filters. Copy the exact query logic from each `listAdmin*` function in Layout.jsx.

- [ ] **Step 3: Migrate AdminPage and all admin sub-pages**

AdminPage.jsx should become a thin router that renders sub-pages without passing data props. Each admin sub-page uses its own hook.

Remove from AdminPage props: `postagens`, `setPostagens`, `ferias`, `dayoff`, `colaboradores`, `ausencias`, `presencialAgendas`, `galeriaEventos`, `muralMsgs`, `onListPostagens`, `onListFerias`, etc.

Manter: `aba`, `onChangeAba`, `currentProfile`, `adminModulos` (props de auth/permissão).

**AdminAniversarios:** Usa o hook regular `useAniversarios` (não precisa de hook admin dedicado — dados são estáticos).
**AdminColaboradores:** Já migrado na Task 2 (Step 3b).

- [ ] **Step 4: Verify build + test each admin page**

Test: search, pagination, CRUD operations in each admin section.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/queries/admin/ src/pages/admin/ src/components/Layout.jsx
git commit -m "feat: add admin hooks with pagination, eliminate AdminPage prop drilling"
```

---

## Task 10: Cleanup — Remove businessCache + Simplify Layout

**Files:**
- Delete: `src/lib/businessCache.js`
- Modify: `src/components/Layout.jsx` — remove all data loading code, state, imports, cache TTLs, realtime subscriptions (already moved to hooks)

**This is the final task.** At this point, all pages use hooks. The Layout should only contain:
- Authentication (login, session, first-access)
- Routing (URL resolution, page rendering)
- UI shell (sidebar, header, navigation, theme toggle)
- Permissions/admin module checks
- Utility functions (image optimization, storage path helpers)

- [ ] **Step 1: Remove businessCache.js import from Layout.jsx**

Delete the import line:
```js
import { invalidateCachedDomain, mutateCachedDomain, readCachedDomain, runDedupedRequest, writeCachedDomain } from "../lib/businessCache.js";
```

- [ ] **Step 2: Remove all data state from Layout.jsx**

Delete state declarations for: `colaboradores`, `postagens`, `aniversariantes`, `ferias`, `dayoff`, `ausencias`, `presencialAgendas`, `galeriaEventos`, `muralMsgs`.

- [ ] **Step 3: Remove all load* functions from Layout.jsx**

Delete: `loadColaboradores`, `loadPostagens`, `loadFerias`, `loadAusencias`, `loadPresencial`, `loadAniversarios`, `loadMural`, `loadGaleria`, `loadAllBusinessData`, `hydrateBusinessDataFromCache`, all `listAdmin*` functions.

- [ ] **Step 4: Remove all handle* mutation functions from Layout.jsx**

Delete all handler functions that were migrated to mutation hooks. Keep `handleLogin`, `handleLogout`, `handleConcluirPrimeiroAcesso`, `handleToggleTheme`, and navigation handlers.

- [ ] **Step 5: Remove Realtime subscriptions from Layout.jsx**

The mural and colaboradores subscriptions are now in the hooks. Remove them from Layout.jsx.

- [ ] **Step 6: Remove cache TTL constants and businessCache references**

Delete `DATA_CACHE_TTL`, `ADMIN_LIST_CACHE_TTL`, `adminListCache` state, and all references to `readCachedDomain`, `writeCachedDomain`, `invalidateCachedDomain`, `mutateCachedDomain`, `runDedupedRequest`.

- [ ] **Step 7: Remove data props from page renders**

Clean up all `<PageComponent prop1={...} prop2={...} />` renders to remove data props that are now provided by hooks.

- [ ] **Step 7b: Migrar PerfilPage.jsx**

PerfilPage recebe `profile` e `onSalvar` do Layout. Criar um hook `usePerfilMutation` (ou adicionar ao `useColaboradores` mutations) para salvar perfil. A página pode usar `currentProfile` do contexto de auth que permanece no Layout.

- [ ] **Step 7c: Verificar e remover MuralPage.jsx se for código morto**

MuralPage.jsx existe mas NÃO é renderizado em nenhuma rota. Verificar se é importado em algum lugar. Se não, deletar.

- [ ] **Step 8: Deletar businessCache.js**

```bash
rm src/lib/businessCache.js
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```

Must succeed with zero errors.

- [ ] **Step 10: Full app smoke test**

Test every page:
1. Dashboard — all cards load (postagens, mural, ferias, ausencias, aniversarios)
2. Postagens — list, like, comment, edit/delete
3. Colaboradores — list renders
4. Aniversarios — list with parabenizar
5. Ferias — list, create, edit, delete
6. Presencial — confirm, amigo secreto
7. Galerias — view, upload photos
8. Mural — send message (realtime)
9. Admin — all tabs with search/pagination
10. Login/logout flow

- [ ] **Step 11: Commit**

```bash
git status  # Revisar mudanças antes de commitar — NÃO usar git add -A cegamente
git add src/lib/businessCache.js src/components/Layout.jsx src/pages/ # Adicionar arquivos específicos
git commit -m "feat: remover businessCache.js, simplificar Layout para auth+routing+UI

Layout reduzido de ~3200 para ~1500 linhas.
Todo data fetching agora via React Query hooks.
businessCache.js deletado completamente."
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] All pages load without console errors
- [ ] React Query DevTools show correct cache entries and staleTime
- [ ] Mural Realtime works (send from one tab, see in another)
- [ ] Optimistic updates work (mural message appears instantly)
- [ ] `localStorage` no longer has `panet.business-cache.v2` key (old cache gone)
- [ ] Layout.jsx is ~1500 lines or less
- [ ] AdminPage receives minimal props (auth/permissions only)
- [ ] No references to businessCache remain in the codebase
