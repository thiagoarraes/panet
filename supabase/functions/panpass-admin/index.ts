// PanPass — cadastro e edição de serviços (somente admin).
//
// Separada de panpass-reveal de propósito: leitura de segredo e escrita de
// segredo são superfícies distintas. Aqui a senha/secret chega em claro no
// corpo da requisição e sai cifrada para o banco; nunca volta para o client.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encrypt } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const MFA_TIPOS = ["nenhum", "totp", "email"];

const textoOuNull = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

// Mesma regra de PanPassPage.jsx e panpass-reveal/index.ts: calculado a partir
// do domínio, nunca aceito do client — evita um admin esquecer de marcar a
// caixa como "não gerenciada" e quebrar o fluxo do colaborador.
const ehEmailCorporativo = (email: string) => email.toLowerCase().endsWith("@agenciapan.com");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase env vars are missing.");

    const authHeader = req.headers.get("Authorization");
    const callerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!callerToken) return jsonResponse({ error: "Missing bearer token" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);
    if (callerError || !callerUser) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: perfil } = await adminClient
      .from("colaboradores")
      .select("perfil")
      .eq("id", callerUser.id)
      .maybeSingle();
    if (perfil?.perfil !== "admin") return jsonResponse({ error: "Acesso restrito." }, 403);

    const body = await req.json();
    const acao = String(body?.acao || "").trim();

    if (acao === "delete") {
      const id = String(body?.id || "").trim();
      if (!id) return jsonResponse({ error: "id é obrigatório." }, 400);
      const { error } = await adminClient.from("panpass_servicos").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true }, 200);
    }

    if (acao !== "upsert") return jsonResponse({ error: "ação inválida." }, 400);

    const s = body?.servico || {};
    const id = textoOuNull(s.id);
    const nome = textoOuNull(s.nome);
    const usuario = textoOuNull(s.usuario);
    const mfaTipo = String(s.mfa_tipo || "nenhum");

    if (!nome) return jsonResponse({ error: "nome é obrigatório." }, 400);
    if (!usuario) return jsonResponse({ error: "usuário/e-mail é obrigatório." }, 400);
    if (!MFA_TIPOS.includes(mfaTipo)) return jsonResponse({ error: "mfa_tipo inválido." }, 400);

    // deno-lint-ignore no-explicit-any
    const registro: Record<string, any> = {
      nome,
      categoria: textoOuNull(s.categoria),
      url_login: textoOuNull(s.url_login),
      logo_url: textoOuNull(s.logo_url),
      usuario,
      mfa_tipo: mfaTipo,
      // O código sempre chega no mesmo e-mail usado para logar — não existe
      // caixa separada. mfa_email_remetente ficou sem uso; deixado null.
      mfa_email: mfaTipo === "email" ? usuario : null,
      mfa_email_remetente: null,
      mfa_email_gerenciado: mfaTipo === "email" ? ehEmailCorporativo(usuario) : true,
      restrito_a: Array.isArray(s.restrito_a) && s.restrito_a.length > 0 ? s.restrito_a : null,
      ativo: s.ativo !== false,
      updated_at: new Date().toISOString(),
    };

    // Campos write-only: vazio na edição significa "manter o valor atual".
    const senha = textoOuNull(s.senha);
    if (senha) registro.senha_cifrada = await encrypt(senha);

    const totpSecret = mfaTipo === "totp" ? textoOuNull(s.totp_secret) : null;
    if (totpSecret) registro.totp_secret_cifrado = await encrypt(totpSecret);
    if (mfaTipo !== "totp") registro.totp_secret_cifrado = null;

    if (id) {
      const { error } = await adminClient.from("panpass_servicos").update(registro).eq("id", id);
      if (error) throw new Error(error.message);
      return jsonResponse({ ok: true, id }, 200);
    }

    if (!registro.senha_cifrada) return jsonResponse({ error: "senha é obrigatória." }, 400);
    if (mfaTipo === "totp" && !registro.totp_secret_cifrado) {
      return jsonResponse({ error: "Informe o secret do app autenticador." }, 400);
    }

    const { data, error } = await adminClient
      .from("panpass_servicos")
      .insert(registro)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return jsonResponse({ ok: true, id: data.id }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro inesperado.";
    console.error("[panpass-admin]", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
