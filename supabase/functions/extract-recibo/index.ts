import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EXTRACTION_PROMPT = `Você recebe um documento enviado por um colaborador que deveria ser o recibo/comprovante de uma corrida de aplicativo (Uber, 99 ou similar). Analise o documento e responda APENAS com um JSON válido, sem cercas de código, exatamente com estas chaves:
{
  "eh_recibo_corrida": boolean,
  "origem": string | null,
  "destino": string | null,
  "horario": string | null,
  "duracao_min": number | null,
  "km": number | null,
  "veiculo": string | null,
  "motorista": string | null,
  "valor_total": number | null
}
Regras:
- eh_recibo_corrida = true SOMENTE se o documento for claramente um recibo/comprovante de viagem de app de transporte (Uber, 99, InDrive, Cabify e similares), com sinais como trajeto/endereços, valor da corrida, motorista/veículo ou a marca do app. Qualquer outra coisa (nota fiscal de loja, boleto, cardápio, foto aleatória, print sem relação, documento em branco) = false.
- Se eh_recibo_corrida = false, coloque null em todos os outros campos.
- origem/destino são os endereços de partida/chegada; horario é a data/hora de início em ISO 8601 (se só houver hora sem data, use null); duracao_min em minutos; km é a distância; veiculo é modelo/placa; valor_total é o valor pago em reais como número (ex: 24.90). Use null para campo não encontrado.`;

// deno-lint-ignore no-explicit-any
const parseExtraction = (text: string): Record<string, any> => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object") throw new Error("Resposta da IA não é um objeto JSON.");
  return parsed;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase env vars are missing.");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

    const authHeader = req.headers.get("Authorization");
    const callerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!callerToken) return jsonResponse({ error: "Missing bearer token" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);
    if (callerError || !callerUser) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const corridaId = String(body?.corrida_id || "").trim();
    if (!corridaId) return jsonResponse({ error: "corrida_id é obrigatório." }, 400);

    const { data: corrida, error: corridaError } = await adminClient
      .from("corridas")
      .select("id, colaborador_id, recibo_path, recibo_mime, status_extracao")
      .eq("id", corridaId)
      .maybeSingle();
    if (corridaError || !corrida) return jsonResponse({ error: "Corrida não encontrada." }, 404);

    // Dono da corrida ou admin pode disparar a extração.
    if (corrida.colaborador_id !== callerUser.id) {
      const { data: profile } = await adminClient
        .from("colaboradores")
        .select("perfil")
        .eq("id", callerUser.id)
        .maybeSingle();
      if (profile?.perfil !== "admin") return jsonResponse({ error: "Forbidden" }, 403);
    }

    const markError = async (message: string) => {
      await adminClient
        .from("corridas")
        .update({ status_extracao: "erro", erro_extracao: message.slice(0, 500) })
        .eq("id", corridaId);
    };

    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from("recibos")
      .download(corrida.recibo_path);
    if (downloadError || !fileBlob) {
      await markError(`Falha ao baixar recibo: ${downloadError?.message || "arquivo vazio"}`);
      return jsonResponse({ ok: false, error: "Falha ao baixar o recibo do storage." }, 500);
    }

    const base64Data = encodeBase64(new Uint8Array(await fileBlob.arrayBuffer()));
    const isPdf = corrida.recibo_mime === "application/pdf";
    const mediaBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
      : { type: "image", source: { type: "base64", media_type: corrida.recibo_mime, data: base64Data } };

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [mediaBlock, { type: "text", text: EXTRACTION_PROMPT }],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      await markError(`API de extração retornou ${anthropicResponse.status}: ${errText.slice(0, 300)}`);
      return jsonResponse({ ok: false, error: "Falha na API de extração." }, 502);
    }

    const anthropicJson = await anthropicResponse.json();
    const rawText = String(anthropicJson?.content?.[0]?.text || "");

    let fields;
    try {
      fields = parseExtraction(rawText);
    } catch (parseErr) {
      await markError(`Resposta inválida da IA: ${parseErr instanceof Error ? parseErr.message : "parse"}`);
      return jsonResponse({ ok: false, error: "Não foi possível interpretar a resposta da IA." }, 502);
    }

    // Documento não é recibo de corrida: rejeita, apaga arquivo e a corrida.
    if (fields.eh_recibo_corrida === false) {
      await adminClient.storage.from("recibos").remove([corrida.recibo_path]).catch(() => {});
      await adminClient.from("corridas").delete().eq("id", corridaId);
      return jsonResponse(
        { ok: false, rejected: true, error: "O documento enviado não é um recibo de corrida de aplicativo (Uber/99)." },
        200,
      );
    }

    const toNumberOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const toTextOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const horarioIso = toTextOrNull(fields.horario);
    const horarioValid = horarioIso && !Number.isNaN(Date.parse(horarioIso)) ? horarioIso : null;
    const duracaoNum = toNumberOrNull(fields.duracao_min);

    const update = {
      origem: toTextOrNull(fields.origem),
      destino: toTextOrNull(fields.destino),
      horario: horarioValid,
      duracao_min: duracaoNum !== null ? Math.round(duracaoNum) : null,
      km: toNumberOrNull(fields.km),
      veiculo: toTextOrNull(fields.veiculo),
      motorista: toTextOrNull(fields.motorista),
      valor_total: toNumberOrNull(fields.valor_total),
      status_extracao: "ok",
      erro_extracao: null,
    };

    const { data: updated, error: updateError } = await adminClient
      .from("corridas")
      .update(update)
      .eq("id", corridaId)
      .select()
      .maybeSingle();
    if (updateError) {
      await markError(`Falha ao salvar extração: ${updateError.message}`);
      return jsonResponse({ ok: false, error: updateError.message }, 500);
    }

    return jsonResponse({ ok: true, corrida: updated }, 200);
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
