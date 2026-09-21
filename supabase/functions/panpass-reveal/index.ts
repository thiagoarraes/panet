// PanPass — revelação de credencial para o colaborador.
//
// Todo segredo sai por aqui e por mais lugar nenhum: o client não tem
// privilégio de SELECT nas colunas cifradas (ver migration add_panpass).
// Toda tentativa, com sucesso ou não, vira uma linha em panpass_acessos.
//
// Sem supabase-js de proposito. Esta function faz tres chamadas REST triviais
// (validar token, ler o servico, gravar auditoria) e importar o client inteiro
// do esm.sh so para isso dominava o cold start -- que aqui e o caso comum,
// porque o PanPass e usado de vez em quando e a function quase sempre esta
// fria. Com fetch puro o boot cai e some o maior pedaco do tempo percebido
// entre o clique e a senha aparecer.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { decrypt } from "../_shared/crypto.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const TIPOS = ["senha"] as const;
type Tipo = (typeof TIPOS)[number];

type Servico = {
  usuario: string | null;
  senha_cifrada: string;
  ativo: boolean | null;
  restrito_a: string[] | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonError(req, 405, "Method not allowed");

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError(req, 503, "Serviço não configurado.");
  }

  const base = supabaseUrl.replace(/\/$/, "");
  const admin = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;

  let colaboradorId: string | null = null;
  let servicoId: string | null = null;
  let tipo: Tipo | null = null;

  // Registra a tentativa. Nunca deixa a auditoria derrubar a resposta.
  const registrar = async (sucesso: boolean, detalhe?: string) => {
    if (!tipo) return;
    try {
      const r = await fetch(`${base}/rest/v1/panpass_acessos`, {
        method: "POST",
        headers: { ...admin, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          servico_id: servicoId,
          colaborador_id: colaboradorId,
          acao: tipo,
          sucesso,
          detalhe: detalhe ?? null,
          ip,
          user_agent: userAgent,
        }),
      });
      if (!r.ok) console.error("[panpass] auditoria HTTP", r.status, await r.text());
    } catch (e) {
      console.error("[panpass] falha ao gravar auditoria:", e);
    }
  };

  // O insert NAO entra no caminho critico: era o terceiro round-trip em serie
  // antes de devolver a senha. `EdgeRuntime.waitUntil` mantem a escrita viva
  // depois da resposta sair, entao a auditoria continua garantida sem custar
  // latencia. Sem essa API (dev local), cai no await de antes.
  // deno-lint-ignore no-explicit-any
  const edge = (globalThis as any).EdgeRuntime;
  const registrarEmBackground = (sucesso: boolean, detalhe?: string) => {
    const p = registrar(sucesso, detalhe);
    if (edge?.waitUntil) {
      edge.waitUntil(p);
      return Promise.resolve();
    }
    return p;
  };

  try {
    const authHeader = req.headers.get("Authorization");
    const callerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!callerToken) return jsonError(req, 401, "Não autenticado.");

    // Valida o corpo antes de qualquer rede: erro de payload nao deve custar
    // round-trip nenhum.
    const body = await req.json();
    servicoId = String(body?.servico_id || "").trim() || null;
    const tipoBruto = String(body?.tipo || "").trim();
    if (!servicoId) return jsonError(req, 400, "servico_id é obrigatório.");
    if (!TIPOS.includes(tipoBruto as Tipo)) {
      return jsonError(req, 400, "tipo inválido.");
    }
    tipo = tipoBruto as Tipo;

    // Validar o chamador e ler o servico sao independentes: rodavam em serie e
    // somavam duas latencias. Em paralelo, custa o maior dos dois.
    //
    // Buscar o servico antes de confirmar o chamador e seguro: roda no servidor
    // com service role e nada sai daqui antes das checagens de autenticacao e
    // de `restrito_a` logo abaixo. O select pede so as colunas usadas -- antes
    // era `*` e trazia coluna que ninguem le.
    const [userRes, servicoRes] = await Promise.all([
      fetch(`${base}/auth/v1/user`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${callerToken}` },
      }),
      fetch(
        `${base}/rest/v1/panpass_servicos` +
          `?select=usuario,senha_cifrada,ativo,restrito_a&id=eq.${encodeURIComponent(servicoId)}&limit=1`,
        { headers: admin },
      ),
    ]);

    if (!userRes.ok) return jsonError(req, 401, "Não autenticado.");
    const callerUser = await userRes.json();
    if (!callerUser?.id) return jsonError(req, 401, "Não autenticado.");
    colaboradorId = callerUser.id;

    if (!servicoRes.ok) throw new Error(`servico HTTP ${servicoRes.status}: ${await servicoRes.text()}`);
    const linhas: Servico[] = await servicoRes.json();
    const servico = linhas?.[0] ?? null;

    if (!servico || !servico.ativo) {
      await registrarEmBackground(false, "serviço inexistente ou inativo");
      return jsonError(req, 404, "Serviço não encontrado.");
    }

    // Autorização: `restrito_a` nulo libera para todos.
    const restrito = servico.restrito_a;
    if (Array.isArray(restrito) && !restrito.includes(callerUser.id)) {
      await registrarEmBackground(false, "sem permissão para este serviço");
      return jsonError(req, 403, "Você não tem acesso a este serviço.");
    }

    const senha = await decrypt(servico.senha_cifrada);
    await registrarEmBackground(true);
    return jsonOk(req, { senha, usuario: servico.usuario });
  } catch (error) {
    console.error("[panpass-reveal]", error);
    await registrar(false, "erro interno");
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});
