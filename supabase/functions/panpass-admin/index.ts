// PanPass — cadastro e edição de serviços (somente admin).
//
// Separada de panpass-reveal de propósito: leitura de segredo e escrita de
// segredo são superfícies distintas. Aqui a senha/secret chega em claro no
// corpo da requisição e sai cifrada para o banco; nunca volta para o client.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encrypt } from "../_shared/crypto.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const textoOuNull = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

const REQUIRED_ADMIN_MODULE = "panpass";

const hasRequiredAdminModule = (profile: { perfil?: string | null; admin_modulos?: string[] | null; ativo?: boolean | null } | null) => {
  if (!profile || profile.perfil !== "admin" || profile.ativo === false) return false;
  if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
  return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonError(req, 405, "Method not allowed");

 try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    if (!supabaseUrl || !serviceRoleKey) return jsonError(req, 503, "Serviço não configurado.");

    const authHeader = req.headers.get("Authorization");
    const callerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!callerToken) return jsonError(req, 401, "Não autenticado.");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);
    if (callerError || !callerUser) return jsonError(req, 401, "Não autenticado.");

    const { data: perfil } = await adminClient
      .from("colaboradores")
      .select("perfil, admin_modulos, ativo")
      .eq("id", callerUser.id)
      .maybeSingle();
    if (!hasRequiredAdminModule(perfil)) return jsonError(req, 403, "Acesso restrito.");

    const body = await req.json();
    const acao = String(body?.acao || "").trim();

    if (acao === "delete") {
      const id = String(body?.id || "").trim();
      if (!id) return jsonError(req, 400, "id é obrigatório.");
      const { error } = await adminClient.from("panpass_servicos").delete().eq("id", id);
      if (error) return jsonError(req, 500, "Erro ao remover o serviço.", error.message);
      return jsonOk(req, { ok: true });
    }

    if (acao !== "upsert") return jsonError(req, 400, "Ação inválida.");

    const s = body?.servico || {};
    const id = textoOuNull(s.id);
    const nome = textoOuNull(s.nome);
    const usuario = textoOuNull(s.usuario);

    if (!nome) return jsonError(req, 400, "nome é obrigatório.");
    if (!usuario) return jsonError(req, 400, "usuário/e-mail é obrigatório.");

    // deno-lint-ignore no-explicit-any
    const registro: Record<string, any> = {
      nome,
      categoria: textoOuNull(s.categoria),
      url_login: textoOuNull(s.url_login),
      logo_url: textoOuNull(s.logo_url),
      usuario,
      mfa_tipo: "nenhum",
      mfa_email: null,
      mfa_email_remetente: null,
      mfa_email_gerenciado: true,
      totp_secret_cifrado: null,
      restrito_a: Array.isArray(s.restrito_a) && s.restrito_a.length > 0 ? s.restrito_a : null,
      ativo: s.ativo !== false,
      updated_at: new Date().toISOString(),
    };

    // Campo write-only: vazio na edição significa "manter a senha atual".
    const senha = textoOuNull(s.senha);
    if (senha) registro.senha_cifrada = await encrypt(senha);

    if (id) {
      const { error } = await adminClient.from("panpass_servicos").update(registro).eq("id", id);
      if (error) return jsonError(req, 500, "Erro ao salvar o serviço.", error.message);
      return jsonOk(req, { ok: true, id });
    }

    if (!registro.senha_cifrada) return jsonError(req, 400, "senha é obrigatória.");

    const { data, error } = await adminClient
      .from("panpass_servicos")
      .insert(registro)
      .select("id")
      .single();
    if (error) return jsonError(req, 500, "Erro ao criar o serviço.", error.message);
    return jsonOk(req, { ok: true, id: data.id });
  } catch (error) {
    console.error("[panpass-admin]", error);
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});
