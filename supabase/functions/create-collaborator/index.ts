import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const randomString = (length: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

const generateTemporaryPassword = () => `Pan@${randomString(8)}`;

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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerToken = authHeader.replace("Bearer ", "");
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
      .select("id, perfil")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.perfil !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create users." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const nome = String(body?.nome || "").trim();
    const cargo = String(body?.cargo || "Colaborador").trim() || "Colaborador";
    const email = String(body?.email || "").trim().toLowerCase();
    const telefone = body?.telefone ? String(body.telefone).trim() : null;
    const instagram = body?.instagram ? String(body.instagram).trim() : null;
    const linkedin = body?.linkedin ? String(body.linkedin).trim() : null;
    const github = body?.github ? String(body.github).trim() : null;
    const perfil = body?.perfil === "admin" ? "admin" : "colaborador";

    if (!nome || !email) {
      return new Response(JSON.stringify({ error: "nome e email sao obrigatorios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("colaboradores")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfileError) {
      return new Response(JSON.stringify({ error: existingProfileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingProfile) {
      return new Response(JSON.stringify({ error: "Ja existe colaborador com este e-mail." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const temporaryPassword = generateTemporaryPassword();

    const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { nome, cargo, perfil },
    });

    if (createAuthError || !createdAuth.user) {
      const authErrorMessage = createAuthError?.message || "Failed to create auth user.";
      const authErrorLower = authErrorMessage.toLowerCase();
      return new Response(JSON.stringify({ error: createAuthError?.message || "Failed to create auth user." }), {
        status: authErrorLower.includes("already") || authErrorLower.includes("exists") ? 409 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: createProfileError } = await adminClient.from("colaboradores").insert({
      id: createdAuth.user.id,
      nome,
      cargo,
      email,
      telefone,
      instagram,
      linkedin,
      github,
      perfil,
      primeiro_acesso: true,
    });

    if (createProfileError) {
      await adminClient.auth.admin.deleteUser(createdAuth.user.id);
      return new Response(JSON.stringify({ error: createProfileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        user_id: createdAuth.user.id,
        email,
        temporary_password: temporaryPassword,
        primeiro_acesso: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

