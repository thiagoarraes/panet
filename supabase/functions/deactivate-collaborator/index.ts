import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import { criarRest } from "../_shared/rest.ts";

type Perfil = { perfil?: string | null; admin_modulos?: string[] | null; ativo?: boolean | null };

const REQUIRED_ADMIN_MODULE = "colaboradores";

const hasRequiredAdminModule = (
  profile: { perfil?: string | null; admin_modulos?: string[] | null; ativo?: boolean | null } | null
) => {
  if (!profile || profile.perfil !== "admin" || profile.ativo === false) return false;
  if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
  return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
};

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

    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    if (!bearerToken.trim()) {
      return jsonError(req, 401, "Não autenticado.");
    }

    const rest = criarRest(supabaseUrl, serviceRoleKey);

    // Verify caller identity
    const { data: callerUser, error: callerError } = await rest.getUser(bearerToken.trim());

    if (callerError || !callerUser?.id) {
      return jsonError(req, 401, "Não autenticado.");
    }

    // Verify caller has colaboradores admin module
    const { data: callerProfile, error: profileError } = await rest.selectOne<Perfil>(
      "colaboradores",
      `id=eq.${callerUser.id}&select=id,perfil,admin_modulos,ativo`,
    );

    if (profileError || !hasRequiredAdminModule(callerProfile)) {
      return jsonError(
        req,
        403,
        "Apenas admins com acesso ao módulo colaboradores podem executar esta ação."
      );
    }

    const body = await req.json();
    const targetId = String(body?.user_id || "").trim();
    // action: "deactivate" (default) | "reactivate"
    const action = String(body?.action || "deactivate") === "reactivate" ? "reactivate" : "deactivate";

    if (!targetId) {
      return jsonError(req, 400, "user_id é obrigatório.");
    }

    // Prevent acting on self
    if (targetId === callerUser.id) {
      const label = action === "deactivate" ? "desativar" : "reativar";
      return jsonError(req, 400, `Você não pode ${label} seu próprio usuário.`);
    }

    // Verify target exists
    const { data: targetProfile, error: targetError } = await rest.selectOne(
      "colaboradores",
      `id=eq.${targetId}&select=id,email,ativo`,
    );

    if (targetError) {
      return jsonError(req, 500, "Erro ao localizar o colaborador.", targetError.message);
    }
    if (!targetProfile) {
      return jsonError(req, 404, "Colaborador não encontrado.");
    }

    if (action === "deactivate") {
      // 1. Set ativo = false in colaboradores
      const { error: updateError } = await rest.update("colaboradores", `id=eq.${targetId}`, { ativo: false });

      if (updateError) {
        return jsonError(req, 500, "Erro ao desativar o colaborador.", updateError.message);
      }

      // 2. Ban the auth user (~100 years = effectively permanent)
      const { error: banError } = await rest.adminUpdateUser(targetId, { ban_duration: "876000h" });

      if (banError && !String(banError.message || "").toLowerCase().includes("not found")) {
        // Roll back the ativo change if auth ban fails
        await rest.update("colaboradores", `id=eq.${targetId}`, { ativo: true });
        return jsonError(req, 500, "Erro ao banir o usuário de autenticação.", banError.message);
      }
    } else {
      // Reactivate: set ativo = true + remove ban
      const { error: updateError } = await rest.update("colaboradores", `id=eq.${targetId}`, { ativo: true });

      if (updateError) {
        return jsonError(req, 500, "Erro ao reativar o colaborador.", updateError.message);
      }

      // Remove ban from auth user
      const { error: unbanError } = await rest.adminUpdateUser(targetId, { ban_duration: "none" });

      if (unbanError && !String(unbanError.message || "").toLowerCase().includes("not found")) {
        // Roll back the ativo change if unban fails
        await rest.update("colaboradores", `id=eq.${targetId}`, { ativo: false });
        return jsonError(req, 500, "Erro ao desbanir o usuário de autenticação.", unbanError.message);
      }
    }

    return jsonOk(req, { ok: true, action, user_id: targetId });
  } catch (err) {
    console.error("[deactivate-collaborator]", err);
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});
