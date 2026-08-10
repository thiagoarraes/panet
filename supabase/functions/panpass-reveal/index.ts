// PanPass — revelação de credencial para o colaborador.
//
// Todo segredo sai por aqui e por mais lugar nenhum: o client não tem
// privilégio de SELECT nas colunas cifradas (ver migration add_panpass).
// Toda tentativa, com sucesso ou não, vira uma linha em panpass_acessos.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt } from "../_shared/crypto.ts";
import { gerarTotp } from "../_shared/totp.ts";
import { buscarCodigoVerificacao } from "../_shared/gmail.ts";

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

const TIPOS = ["senha", "totp", "codigo_email"] as const;
type Tipo = (typeof TIPOS)[number];

// Mesma regra do frontend (PanPassPage.jsx): só caixa @agenciapan.com está
// sob a delegação do Google Workspace. Checado de novo aqui — o frontend só
// esconde o botão, quem garante é o servidor.
const ehEmailCorporativo = (email: string) => email.toLowerCase().endsWith("@agenciapan.com");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env vars are missing." }, 500);
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
    if (!callerToken) return jsonResponse({ error: "Missing bearer token" }, 401);

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);
    if (callerError || !callerUser) return jsonResponse({ error: "Unauthorized" }, 401);
    colaboradorId = callerUser.id;

    const body = await req.json();
    servicoId = String(body?.servico_id || "").trim() || null;
    const tipoBruto = String(body?.tipo || "").trim();
    if (!servicoId) return jsonResponse({ error: "servico_id é obrigatório." }, 400);
    if (!TIPOS.includes(tipoBruto as Tipo)) {
      return jsonResponse({ error: "tipo inválido." }, 400);
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
      return jsonResponse({ error: "Serviço não encontrado." }, 404);
    }

    // Autorização: `restrito_a` nulo libera para todos.
    const restrito: string[] | null = servico.restrito_a;
    if (Array.isArray(restrito) && !restrito.includes(callerUser.id)) {
      await registrar(false, "sem permissão para este serviço");
      return jsonResponse({ error: "Você não tem acesso a este serviço." }, 403);
    }

    if (tipo === "senha") {
      const senha = await decrypt(servico.senha_cifrada);
      await registrar(true);
      return jsonResponse({ senha, usuario: servico.usuario }, 200);
    }

    if (tipo === "totp") {
      if (servico.mfa_tipo !== "totp" || !servico.totp_secret_cifrado) {
        await registrar(false, "serviço sem TOTP configurado");
        return jsonResponse({ error: "Este serviço não usa app autenticador." }, 400);
      }
      const secret = await decrypt(servico.totp_secret_cifrado);
      const { codigo, segundosRestantes } = await gerarTotp(secret);
      await registrar(true);
      return jsonResponse({ codigo, segundos_restantes: segundosRestantes }, 200);
    }

    // tipo === "codigo_email" — o código sempre chega no e-mail de login,
    // não existe caixa separada.
    if (servico.mfa_tipo !== "email") {
      await registrar(false, "serviço sem código por e-mail configurado");
      return jsonResponse({ error: "Este serviço não usa código por e-mail." }, 400);
    }

    // Caixa fora do domínio da empresa: a delegação do Google Workspace não
    // alcança e-mail pessoal, então nem tentamos — só orientamos quem pedir.
    if (!ehEmailCorporativo(servico.usuario)) {
      await registrar(true, "e-mail não gerenciado pela empresa — orientado a pedir ao dono");
      return jsonResponse({ gerenciado: false }, 200);
    }

    const achado = await buscarCodigoVerificacao(servico.usuario);
    if (!achado) {
      await registrar(false, "nenhum código recente na caixa");
      return jsonResponse(
        {
          error:
            "Nenhum código recente encontrado. Peça o envio do código na tela do serviço e tente de novo em alguns segundos.",
        },
        404,
      );
    }

    await registrar(true, achado.tipo === "link" ? "link de login" : undefined);
    return jsonResponse(
      {
        email_tipo: achado.tipo, // "codigo" | "link" — a UI decide como exibir
        valor: achado.valor,
        assunto: achado.assunto,
        recebido_em: achado.recebidoEm,
      },
      200,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro inesperado.";
    console.error("[panpass-reveal]", msg);
    await registrar(false, msg);
    return jsonResponse({ error: msg }, 500);
  }
});
