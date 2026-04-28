import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUIRED_ADMIN_MODULE = "colaboradores";

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();

const hasRequiredAdminModule = (
  profile: { perfil?: string | null; admin_modulos?: string[] | null } | null
) => {
  if (!profile || profile.perfil !== "admin") return false;
  if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
  return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase env vars are missing.");
    }

    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    if (!bearerToken.trim()) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify caller identity
    const { data: { user: callerUser }, error: callerError } =
      await adminClient.auth.getUser(bearerToken.trim());

    if (callerError || !callerUser?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has colaboradores admin module
    const { data: callerProfile, error: profileError } = await adminClient
      .from("colaboradores")
      .select("id, perfil, admin_modulos")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !hasRequiredAdminModule(callerProfile)) {
      return new Response(
        JSON.stringify({ error: "Apenas admins com acesso ao módulo colaboradores podem executar esta ação." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const targetId = String(body?.user_id || "").trim();
    // action: "deactivate" (default) | "reactivate"
    const action = String(body?.action || "deactivate") === "reactivate" ? "reactivate" : "deactivate";

    if (!targetId) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent acting on self
    if (targetId === callerUser.id) {
      const label = action === "deactivate" ? "desativar" : "reativar";
      return new Response(
        JSON.stringify({ error: `Você não pode ${label} seu próprio usuário.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target exists
    const { data: targetProfile, error: targetError } = await adminClient
      .from("colaboradores")
      .select("id, email, ativo")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError) {
      return new Response(JSON.stringify({ error: targetError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Colaborador não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      // 1. Set ativo = false in colaboradores
      const { error: updateError } = await adminClient
        .from("colaboradores")
        .update({ ativo: false })
        .eq("id", targetId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Ban the auth user (~100 years = effectively permanent)
      const { error: banError } = await adminClient.auth.admin.updateUserById(targetId, {
        ban_duration: "876000h",
      });

      if (banError && !String(banError.message || "").toLowerCase().includes("not found")) {
        // Roll back the ativo change if auth ban fails
        await adminClient.from("colaboradores").update({ ativo: true }).eq("id", targetId);
        return new Response(JSON.stringify({ error: banError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Reactivate: set ativo = true + remove ban
      const { error: updateError } = await adminClient
        .from("colaboradores")
        .update({ ativo: true })
        .eq("id", targetId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove ban from auth user
      const { error: unbanError } = await adminClient.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
      });

      if (unbanError && !String(unbanError.message || "").toLowerCase().includes("not found")) {
        // Roll back the ativo change if unban fails
        await adminClient.from("colaboradores").update({ ativo: false }).eq("id", targetId);
        return new Response(JSON.stringify({ error: unbanError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, action, user_id: targetId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
