import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const REQUIRED_ADMIN_MODULE = "colaboradores";

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();

const hasRequiredAdminModule = (
  profile: { perfil?: string | null; admin_modulos?: string[] | null; ativo?: boolean | null } | null
) => {
  if (!profile || profile.perfil !== "admin" || profile.ativo === false) return false;
  if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
  return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
};

const extractAvatarPathFromUrl = (rawUrl: string) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (!parsed.pathname.includes("/storage/v1/object/")) return "";
    return decodeURIComponent(parsed.pathname.split("/storage/v1/object/")[1] || "").replace(/^avatares\//, "");
  } catch (_err) {
    return "";
  }
};

// Procura em auth.users, NAO em colaboradores.
//
// Esta funcao so e chamada quando o perfil nao foi encontrado -- ou seja,
// exatamente no caso do usuario orfao (auth user vivo, perfil ja removido por
// uma exclusao que falhou no meio). A versao antiga consultava `colaboradores`,
// onde por definicao nao ha nada a achar nesse cenario: devolvia null, o
// deleteUser era pulado e a function respondia ok:true sem excluir ninguem.
// deno-lint-ignore-next-line no-explicit-any
async function findAuthUserIdByEmail(adminClient: SupabaseClient<any>, email: string) {
  const alvo = String(email || "").trim().toLowerCase();
  if (!alvo) return null;

  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const achado = users.find((u) => String(u?.email || "").trim().toLowerCase() === alvo);
    if (achado?.id) return achado.id;
    if (users.length < perPage) break;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonError(req, 405, "Method not allowed");
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(req, 503, "Serviço não configurado.");
    }

    // Accept bearer token from Authorization header or apikey header.
    const authHeader = req.headers.get("Authorization");
    const candidateTokens = [
      authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "",
      req.headers.get("apikey") || "",
    ]
      .map((token) => token.trim())
      .filter(Boolean);

    if (candidateTokens.length === 0) {
      return jsonError(req, 401, "Não autenticado.");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let callerUser: { id: string } | null = null;
    for (const token of candidateTokens) {
      const {
        data: { user },
        error,
      } = await adminClient.auth.getUser(token);
      if (!error && user?.id) {
        callerUser = { id: user.id };
        break;
      }
    }

    if (!callerUser) {
      return jsonError(req, 401, "Não autenticado.");
    }

    const { data: callerProfile, error: profileError } = await adminClient
      .from("colaboradores")
      .select("id, perfil, admin_modulos, ativo")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !hasRequiredAdminModule(callerProfile)) {
      return jsonError(req, 403, "Apenas admins com acesso ao módulo colaboradores podem excluir usuários.");
    }

    const body = await req.json();
    const userId = String(body?.user_id || "").trim();
    const providedEmail = normalizeEmail(body?.email);
    if (!userId && !providedEmail) {
      return jsonError(req, 400, "user_id ou email é obrigatório.");
    }

    if (userId && userId === callerUser.id) {
      return jsonError(req, 400, "Você não pode excluir seu próprio usuário.");
    }

    let targetProfile:
      | {
          id: string;
          foto_url: string | null;
          email: string | null;
        }
      | null = null;

    if (userId) {
      const { data, error } = await adminClient
        .from("colaboradores")
        .select("id, foto_url, email")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        return jsonError(req, 500, "Erro ao localizar o colaborador.", error.message);
      }
      targetProfile = data;
    }

    if (!targetProfile && providedEmail) {
      const { data, error } = await adminClient
        .from("colaboradores")
        .select("id, foto_url, email")
        .eq("email", providedEmail)
        .maybeSingle();
      if (error) {
        return jsonError(req, 500, "Erro ao localizar o colaborador por e-mail.", error.message);
      }
      targetProfile = data;
    }

    const targetProfileId = String(targetProfile?.id || userId || "").trim();
    const targetEmail = normalizeEmail(targetProfile?.email || providedEmail);

    if (targetProfileId && targetProfileId === callerUser.id) {
      return jsonError(req, 400, "Você não pode excluir seu próprio usuário.");
    }

    const [{ error: reassignPostsError }, avatarListResult] = await Promise.all([
      targetProfileId
        ? adminClient.from("postagens").update({ autor_id: callerUser.id }).eq("autor_id", targetProfileId)
        : Promise.resolve({ error: null }),
      targetProfileId
        ? adminClient.storage.from("avatares").list(targetProfileId, {
            limit: 1000,
            offset: 0,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const userAvatarFiles = avatarListResult?.data || [];
    const listAvatarError = avatarListResult?.error || null;

    if (reassignPostsError) {
      return jsonError(req, 500, "Erro ao reatribuir postagens.", reassignPostsError.message);
    }

    if (listAvatarError) {
      return jsonError(req, 500, "Erro ao listar avatares.", listAvatarError.message);
    }

    const avatarPaths = new Set<string>();
    const currentAvatarPath = extractAvatarPathFromUrl(String(targetProfile?.foto_url || ""));
    if (currentAvatarPath) avatarPaths.add(currentAvatarPath);

    for (const file of userAvatarFiles || []) {
      if (!file?.name) continue;
      avatarPaths.add(`${targetProfileId}/${file.name}`);
    }

    if (avatarPaths.size > 0) {
      const { error: removeAvatarError } = await adminClient.storage.from("avatares").remove(Array.from(avatarPaths));
      if (removeAvatarError) {
        return jsonError(req, 500, "Erro ao remover avatares.", removeAvatarError.message);
      }
    }

    // Limpa o que aponta para o colaborador ANTES de remover o perfil.
    //
    // A tabela `mural` esteve nesta lista ate depois de ter sido dropada pela
    // migration 20260719160000_remove_mural_panzap: o PostgREST devolvia
    // PGRST205 e toda exclusao morria em "Erro ao limpar dados vinculados".
    // Pior, o delete de `colaboradores` rodava no MESMO Promise.all -- ele
    // passava, o mural falhava, a function retornava 500 e o auth user ficava
    // para tras. Era essa a fabrica de usuarios orfaos. Por isso o perfil so
    // sai depois que toda a limpeza deu certo, fora do lote paralelo.
    const cleanupTasks = targetProfileId
      ? await Promise.all([
          adminClient.from("curtidas").delete().eq("colaborador_id", targetProfileId),
          adminClient.from("comentarios").delete().eq("colaborador_id", targetProfileId),
          adminClient.from("ferias").delete().eq("colaborador_id", targetProfileId),
          adminClient.from("aniversario_parabenizacoes").delete().eq("colaborador_id", targetProfileId),
          adminClient.from("aniversario_parabenizacoes").delete().eq("aniversariante_id", targetProfileId),
        ])
      : [];

    for (const result of cleanupTasks) {
      if (result.error) {
        return jsonError(req, 500, "Erro ao limpar dados vinculados.", result.error.message);
      }
    }

    const perfilTasks = await Promise.all([
      targetProfileId ? adminClient.from("colaboradores").delete().eq("id", targetProfileId) : Promise.resolve({ error: null }),
      targetEmail ? adminClient.from("colaboradores").delete().eq("email", targetEmail) : Promise.resolve({ error: null }),
    ]);

    for (const result of perfilTasks) {
      if (result.error) {
        return jsonError(req, 500, "Erro ao remover o perfil do colaborador.", result.error.message);
      }
    }

    let authUserId: string | null = targetProfileId;
    if (!authUserId && targetEmail) {
      authUserId = await findAuthUserIdByEmail(adminClient, targetEmail);
    }

    // Sem perfil E sem auth user nao ha o que excluir. Responder ok:true aqui
    // mascarava exclusoes que nao aconteceram -- a tela dizia "excluido" e o
    // usuario seguia de pe, so invisivel na listagem.
    if (!authUserId && !targetProfile) {
      return jsonError(req, 404, "Colaborador não encontrado.");
    }

    if (authUserId) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId);
      if (deleteError && !String(deleteError.message || "").toLowerCase().includes("not found")) {
        return jsonError(req, 500, "Erro ao excluir o usuário de autenticação.", deleteError.message);
      }
    }

    return jsonOk(req, { ok: true, deleted_auth_user_id: authUserId || null });
  } catch (err) {
    console.error("[delete-collaborator]", err);
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});
