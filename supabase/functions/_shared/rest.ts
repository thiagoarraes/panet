// Acesso ao Supabase por REST puro, sem o supabase-js.
//
// Motivo: importar o client inteiro do esm.sh dominava o cold start das Edge
// Functions -- medido em ~900-1000ms na primeira chamada contra ~130-250ms
// quente. Como quase toda function aqui e disparada por uma acao pontual do
// usuario (revelar senha, criar colaborador, marcar folga), a chamada quase
// sempre pega a function fria, e esse boot e o grosso do tempo percebido.
//
// A superficie abaixo cobre exatamente o que as functions usavam do client, e
// devolve `{ data, error }` de proposito: mantem os call sites parecidos com o
// que ja existia, entao a migracao nao reescreve tratamento de erro.

export type Erro = { message: string } | null;
export type Resp<T> = { data: T | null; error: Erro };

export type AuthUser = { id: string; email?: string | null };

const corpo = async (r: Response) => (await r.text()).slice(0, 300);

export function criarRest(supabaseUrl: string, serviceRoleKey: string) {
  const base = supabaseUrl.replace(/\/$/, "");
  const auth = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const authJson = { ...auth, "Content-Type": "application/json" };

  async function pedir<T>(url: string, init?: RequestInit): Promise<Resp<T>> {
    try {
      const r = await fetch(url, init);
      if (!r.ok) return { data: null, error: { message: `HTTP ${r.status}: ${await corpo(r)}` } };
      const txt = await r.text();
      return { data: txt ? (JSON.parse(txt) as T) : null, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }

  return {
    base,

    // ─── Auth do chamador ────────────────────────────────────────────────────
    async getUser(token: string): Promise<Resp<AuthUser>> {
      const r = await pedir<AuthUser>(`${base}/auth/v1/user`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
      });
      if (r.error) return r;
      return r.data?.id ? r : { data: null, error: { message: "token sem usuário" } };
    },

    // ─── PostgREST ───────────────────────────────────────────────────────────
    // `query` e a querystring do PostgREST, ex: "id=eq.123&select=nome".
    select<T>(tabela: string, query: string): Promise<Resp<T[]>> {
      return pedir<T[]>(`${base}/rest/v1/${tabela}?${query}`, { headers: auth });
    },

    async selectOne<T>(tabela: string, query: string): Promise<Resp<T>> {
      const r = await this.select<T>(tabela, `${query}&limit=1`);
      if (r.error) return { data: null, error: r.error };
      return { data: r.data?.[0] ?? null, error: null };
    },

    insert(tabela: string, valores: unknown): Promise<Resp<null>> {
      return pedir<null>(`${base}/rest/v1/${tabela}`, {
        method: "POST",
        headers: { ...authJson, Prefer: "return=minimal" },
        body: JSON.stringify(valores),
      });
    },

    // Equivale ao .insert(...).select(...).single() do client.
    async insertReturning<T>(tabela: string, select: string, valores: unknown): Promise<Resp<T>> {
      const r = await pedir<T[]>(`${base}/rest/v1/${tabela}?select=${select}`, {
        method: "POST",
        headers: { ...authJson, Prefer: "return=representation" },
        body: JSON.stringify(valores),
      });
      if (r.error) return { data: null, error: r.error };
      return { data: r.data?.[0] ?? null, error: null };
    },

    update(tabela: string, query: string, valores: unknown): Promise<Resp<null>> {
      return pedir<null>(`${base}/rest/v1/${tabela}?${query}`, {
        method: "PATCH",
        headers: { ...authJson, Prefer: "return=minimal" },
        body: JSON.stringify(valores),
      });
    },

    // Para quem precisa da linha atualizada de volta (equivale ao
    // .update(...).select().maybeSingle() do client).
    async updateReturning<T>(tabela: string, query: string, valores: unknown): Promise<Resp<T>> {
      const r = await pedir<T[]>(`${base}/rest/v1/${tabela}?${query}`, {
        method: "PATCH",
        headers: { ...authJson, Prefer: "return=representation" },
        body: JSON.stringify(valores),
      });
      if (r.error) return { data: null, error: r.error };
      return { data: r.data?.[0] ?? null, error: null };
    },

    del(tabela: string, query: string): Promise<Resp<null>> {
      return pedir<null>(`${base}/rest/v1/${tabela}?${query}`, {
        method: "DELETE",
        headers: { ...authJson, Prefer: "return=minimal" },
      });
    },

    // ─── Admin de usuarios (GoTrue) ──────────────────────────────────────────
    adminCreateUser(payload: unknown): Promise<Resp<AuthUser>> {
      return pedir<AuthUser>(`${base}/auth/v1/admin/users`, {
        method: "POST",
        headers: authJson,
        body: JSON.stringify(payload),
      });
    },

    adminUpdateUser(id: string, payload: unknown): Promise<Resp<AuthUser>> {
      return pedir<AuthUser>(`${base}/auth/v1/admin/users/${id}`, {
        method: "PUT",
        headers: authJson,
        body: JSON.stringify(payload),
      });
    },

    adminDeleteUser(id: string): Promise<Resp<null>> {
      return pedir<null>(`${base}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: authJson,
      });
    },

    adminListUsers(page: number, perPage: number): Promise<Resp<{ users: AuthUser[] }>> {
      return pedir<{ users: AuthUser[] }>(
        `${base}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        { headers: auth },
      );
    },

    // ─── Storage ─────────────────────────────────────────────────────────────
    storageList(bucket: string, prefix: string, limit = 1000): Promise<Resp<{ name: string }[]>> {
      return pedir<{ name: string }[]>(`${base}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: authJson,
        body: JSON.stringify({ prefix, limit, offset: 0 }),
      });
    },

    storageRemove(bucket: string, caminhos: string[]): Promise<Resp<unknown>> {
      return pedir<unknown>(`${base}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: authJson,
        body: JSON.stringify({ prefixes: caminhos }),
      });
    },

    // Devolve a URL ja absoluta. O endpoint responde `signedURL` relativo.
    async storageSignedUrl(bucket: string, caminho: string, expiraEm: number): Promise<Resp<string>> {
      const r = await pedir<{ signedURL?: string }>(
        `${base}/storage/v1/object/sign/${bucket}/${caminho}`,
        { method: "POST", headers: authJson, body: JSON.stringify({ expiresIn: expiraEm }) },
      );
      if (r.error) return { data: null, error: r.error };
      const rel = r.data?.signedURL;
      if (!rel) return { data: null, error: { message: "resposta sem signedURL" } };
      return {
        data: rel.startsWith("http") ? rel : `${base}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}`,
        error: null,
      };
    },

    async storageDownload(bucket: string, caminho: string): Promise<Resp<Blob>> {
      try {
        const r = await fetch(`${base}/storage/v1/object/${bucket}/${caminho}`, { headers: auth });
        if (!r.ok) return { data: null, error: { message: `HTTP ${r.status}: ${await corpo(r)}` } };
        return { data: await r.blob(), error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },
  };
}

export type Rest = ReturnType<typeof criarRest>;
