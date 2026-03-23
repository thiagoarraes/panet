import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUIRED_ADMIN_MODULE = "colaboradores";

const randomString = (length: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  let out = "";
  for (let i = 0; i < length; i += 1) out += chars[randomValues[i] % chars.length];
  return out;
};

const generateTemporaryPassword = () => `Panet@${randomString(8)}!1`;

const hasRequiredAdminModule = (profile: { perfil?: string | null; admin_modulos?: string[] | null } | null) => {
  if (!profile || profile.perfil !== "admin") return false;
  if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
  return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
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
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    const callerToken = bearerToken.trim();
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

    const { data: callerProfile, error: profileError } = await adminClient
      .from("colaboradores")
      .select("id, perfil, admin_modulos")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !hasRequiredAdminModule(callerProfile)) {
      return new Response(JSON.stringify({ error: "Only admins with colaboradores access can reset passwords." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = String(body?.user_id || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();

    if (!userId && !email) {
      return new Response(JSON.stringify({ error: "user_id ou email é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetProfile:
      | {
          id: string;
          email: string;
        }
      | null = null;

    if (userId) {
      const { data, error } = await adminClient.from("colaboradores").select("id,email").eq("id", userId).maybeSingle();
      if (error) throw error;
      targetProfile = data;
    } else {
      const { data, error } = await adminClient.from("colaboradores").select("id,email").eq("email", email).maybeSingle();
      if (error) throw error;
      targetProfile = data;
    }

    if (!targetProfile?.id) {
      return new Response(JSON.stringify({ error: "Colaborador não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(targetProfile.id, {
      password: temporaryPassword,
      email_confirm: true,
    });
    if (updateAuthError) {
      return new Response(JSON.stringify({ error: updateAuthError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateProfileError } = await adminClient
      .from("colaboradores")
      .update({ primeiro_acesso: true })
      .eq("id", targetProfile.id);
    if (updateProfileError) {
      return new Response(JSON.stringify({ error: updateProfileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: targetProfile.id,
        email: targetProfile.email,
        temporary_password: temporaryPassword,
        primeiro_acesso: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
