
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import { criarRest } from "../_shared/rest.ts";

type Corrida = {
  id: string;
  colaborador_id: string;
  recibo_path: string | null;
  recibo_mime: string | null;
  status_extracao: string | null;
};

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

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
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonError(req, 405, "Method not allowed");
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
      return jsonError(req, 503, "Serviço não configurado.");
    }

    const authHeader = req.headers.get("Authorization");
    const callerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!callerToken) return jsonError(req, 401, "Não autenticado.");

    const rest = criarRest(supabaseUrl, serviceRoleKey);

    const { data: callerUser, error: callerError } = await rest.getUser(callerToken);
    if (callerError || !callerUser) return jsonError(req, 401, "Não autenticado.");

    const body = await req.json();
    const corridaId = String(body?.corrida_id || "").trim();
    if (!corridaId) return jsonError(req, 400, "corrida_id é obrigatório.");

    const { data: corrida, error: corridaError } = await rest.selectOne<Corrida>(
      "corridas",
      `id=eq.${corridaId}&select=id,colaborador_id,recibo_path,recibo_mime,status_extracao`,
    );
    if (corridaError) return jsonError(req, 404, "Corrida não encontrada.");
    if (!corrida) return jsonError(req, 404, "Corrida não encontrada.");

    // Dono da corrida ou admin pode disparar a extração.
    if (corrida.colaborador_id !== callerUser.id) {
      const { data: profile } = await rest.selectOne<{ perfil: string | null }>(
        "colaboradores",
        `id=eq.${callerUser.id}&select=perfil`,
      );
      if (profile?.perfil !== "admin") return jsonError(req, 403, "Forbidden");
    }

    const markError = async (message: string) => {
      await rest.update("corridas", `id=eq.${corridaId}`, {
        status_extracao: "erro",
        erro_extracao: message.slice(0, 500),
      });
    };

    if (!corrida.recibo_path) {
      return jsonError(req, 400, "Corrida sem recibo anexado.");
    }
    if (!ALLOWED_MIME.has(String(corrida.recibo_mime || ""))) {
      return jsonError(req, 400, "Formato de recibo não suportado.");
    }

    const { data: fileBlob, error: downloadError } = await rest.storageDownload("recibos", corrida.recibo_path);
    if (downloadError || !fileBlob) {
      await markError(`Falha ao baixar recibo: ${downloadError?.message || "arquivo vazio"}`);
      return jsonError(req, 500, "Falha ao baixar o recibo do storage.", downloadError?.message);
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    if (fileBytes.length > MAX_BYTES) {
      return jsonError(req, 413, "Recibo excede o tamanho máximo suportado (8 MB).");
    }

    const base64Data = encodeBase64(fileBytes);
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
      return jsonError(req, 502, "Falha na API de extração.", errText.slice(0, 300));
    }

    const anthropicJson = await anthropicResponse.json();
    const rawText = String(anthropicJson?.content?.[0]?.text || "");

    let fields;
    try {
      fields = parseExtraction(rawText);
    } catch (parseErr) {
      await markError(`Resposta inválida da IA: ${parseErr instanceof Error ? parseErr.message : "parse"}`);
      return jsonError(req, 502, "Não foi possível interpretar a resposta da IA.");
    }

    // Documento não é recibo de corrida: rejeita, apaga arquivo e a corrida.
    if (fields.eh_recibo_corrida === false) {
      await rest.storageRemove("recibos", [corrida.recibo_path]);
      await rest.del("corridas", `id=eq.${corridaId}`);
 return jsonOk(
 req,
 { ok: false, rejected: true, error: "O documento enviado não é um recibo de corrida de aplicativo (Uber/99)." },
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

    const { data: updated, error: updateError } = await rest.updateReturning(
      "corridas",
      `id=eq.${corridaId}&select=*`,
      update,
    );
    if (updateError) {
      await markError(`Falha ao salvar extração: ${updateError.message}`);
      return jsonError(req, 500, "Erro ao salvar a extração.", updateError.message);
    }

 return jsonOk(req, { ok: true, corrida: updated });
  } catch (err) {
    console.error("[extract-recibo]", err);
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});
