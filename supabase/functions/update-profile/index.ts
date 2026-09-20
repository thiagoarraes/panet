
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const isSafeUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

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
    const callerToken = bearerToken.trim();
    if (!callerToken) {
      return jsonError(req, 401, "Nao autenticado.");
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);

    if (callerError || !callerUser) {
      return jsonError(req, 401, "Nao autenticado.");
    }

    const body = await req.json();
    const nome = String(body?.nome || "").trim();
    const cargo = String(body?.cargo || "").trim();
    const telefone = body?.telefone ? String(body.telefone).trim() : null;
    const instagram = body?.instagram ? String(body.instagram).trim() : null;
    const linkedin = body?.linkedin ? String(body.linkedin).trim() : null;
    const aniversario = body?.aniversario ? String(body.aniversario).trim() : null;
    const fotoUrl = body?.foto_url ? String(body.foto_url).trim() : null;

    for (const [campo, valor] of [["foto_url", fotoUrl], ["instagram", instagram], ["linkedin", linkedin]] as const) {
      if (valor && !isSafeUrl(valor)) {
        return jsonError(req, 400, `${campo} deve ser uma URL http(s) valida.`);
      }
    }

    if (!nome || !cargo) {
      return jsonError(req, 400, "nome e cargo sao obrigatorios.");
    }

    const updateData: Record<string, string | null> = {
      nome,
      cargo,
      telefone,
      instagram,
      linkedin,
      aniversario,
    };

    if (body?.foto_url !== undefined) {
      updateData.foto_url = fotoUrl;
    }

    const { data: profile, error: updateError } = await adminClient
      .from("colaboradores")
      .update(updateData)
      .eq("id", callerUser.id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      return jsonError(req, 500, "Erro ao salvar o perfil.", updateError.message);
    }

    return jsonOk(req, { ok: true, profile });
  } catch (err) {
    console.error("[update-profile]", err);
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});
