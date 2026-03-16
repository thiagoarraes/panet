import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-jwt",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase env vars are missing.");

    const authHeader = req.headers.get("Authorization");
    const clientJwtHeader = req.headers.get("x-client-jwt");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    const callerToken = String(clientJwtHeader || bearerToken || "").trim();
    if (!callerToken) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);

    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const nome = String(body?.nome || "").trim();
    const cargo = String(body?.cargo || "").trim();
    const telefone = body?.telefone ? String(body.telefone).trim() : null;
    const instagram = body?.instagram ? String(body.instagram).trim() : null;
    const linkedin = body?.linkedin ? String(body.linkedin).trim() : null;
    const aniversario = body?.aniversario ? String(body.aniversario).trim() : null;
    const fotoUrl = body?.foto_url ? String(body.foto_url).trim() : null;

    if (!nome || !cargo) {
      return new Response(JSON.stringify({ error: "nome e cargo sao obrigatorios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, profile }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

