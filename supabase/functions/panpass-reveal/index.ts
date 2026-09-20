// PanPass — revelação de credencial para o colaborador.
//
// Todo segredo sai por aqui e por mais lugar nenhum: o client não tem
// privilégio de SELECT nas colunas cifradas (ver migration add_panpass).
// Toda tentativa, com sucesso ou não, vira uma linha em panpass_acessos.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "../_shared/crypto.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const TIPOS = ["senha"] as const;
type Tipo = (typeof TIPOS)[number];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonError(req, 405, "Method not allowed");

    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(req, 503, "Serviço não configurado.");
    }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;

  let colaboradorId: string | null = null;
  let servicoId: string | null = null;
  let tipo: Tipo | null = null;

  // Registra a tentativa. Nunca deixa a auditoria derrubar a resposta.
  const registrar = async (sucesso: boolean, detalhe?: string) => {
    if (!tipo) return;
    try {
      await adminClient.from("panpass_acessos").insert({
        servico_id: servicoId,
        colaborador_id: colaboradorId,
        acao: tipo,
        sucesso,
        detalhe: detalhe ?? null,
        ip,
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("[panpass] falha ao gravar auditoria:", e);
    }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    const callerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!callerToken) return jsonError(req, 401, "Não autenticado.");

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);
    if (callerError || !callerUser) return jsonError(req, 401, "Não autenticado.");
    colaboradorId = callerUser.id;

    const body = await req.json();
    servicoId = String(body?.servico_id || "").trim() || null;
    const tipoBruto = String(body?.tipo || "").trim();
    if (!servicoId) return jsonError(req, 400, "servico_id é obrigatório.");
    if (!TIPOS.includes(tipoBruto as Tipo)) {
      return jsonError(req, 400, "tipo inválido.");
    }
    tipo = tipoBruto as Tipo;

    const { data: servico, error: servicoError } = await adminClient
      .from("panpass_servicos")
      .select("*")
      .eq("id", servicoId)
      .maybeSingle();

    if (servicoError) throw new Error(servicoError.message);
    if (!servico || !servico.ativo) {
      await registrar(false, "serviço inexistente ou inativo");
      return jsonError(req, 404, "Serviço não encontrado.");
    }

    // Autorização: `restrito_a` nulo libera para todos.
    const restrito: string[] | null = servico.restrito_a;
    if (Array.isArray(restrito) && !restrito.includes(callerUser.id)) {
      await registrar(false, "sem permissão para este serviço");
      return jsonError(req, 403, "Você não tem acesso a este serviço.");
    }

    const senha = await decrypt(servico.senha_cifrada);
    await registrar(true);
    return jsonOk(req, { senha, usuario: servico.usuario });
  } catch (error) {
    console.error("[panpass-reveal]", error);
    await registrar(false, "erro interno");
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});
