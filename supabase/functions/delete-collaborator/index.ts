import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const extractAvatarPathFromUrl = (fotoUrl: string) => {
  const trimmed = String(fotoUrl || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const path = decodeURIComponent(parsed.pathname || "");
    const markers = [
      "/storage/v1/object/public/avatares/",
      "/storage/v1/object/sign/avatares/",
      "/storage/v1/object/authenticated/avatares/",
    ];
    for (const marker of markers) {
      const idx = path.indexOf(marker);
      if (idx >= 0) {
        return path.slice(idx + marker.length);
      }
    }
    return "";
  } catch (_err) {
    return "";
  }
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

    const { data: callerProfile, error: profileError } = await adminClient
      .from("colaboradores")
      .select("id, perfil")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.perfil !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can delete users." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = String(body?.user_id || "").trim();
    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === callerUser.id) {
      return new Response(JSON.stringify({ error: "Você não pode excluir seu próprio usuário." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("colaboradores")
      .select("id, foto_url")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) {
      return new Response(JSON.stringify({ error: targetProfileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: reassignPostsError } = await adminClient
      .from("postagens")
      .update({ autor_id: callerUser.id })
      .eq("autor_id", userId);

    if (reassignPostsError) {
      return new Response(JSON.stringify({ error: reassignPostsError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avatarPaths = new Set<string>();
    const currentAvatarPath = extractAvatarPathFromUrl(String(targetProfile?.foto_url || ""));
    if (currentAvatarPath) avatarPaths.add(currentAvatarPath);

    const { data: userAvatarFiles, error: listAvatarError } = await adminClient.storage.from("avatares").list(userId, {
      limit: 1000,
      offset: 0,
    });

    if (listAvatarError) {
      return new Response(JSON.stringify({ error: listAvatarError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const file of userAvatarFiles || []) {
      if (!file?.name) continue;
      avatarPaths.add(`${userId}/${file.name}`);
    }

    if (avatarPaths.size > 0) {
      const { error: removeAvatarError } = await adminClient.storage.from("avatares").remove(Array.from(avatarPaths));
      if (removeAvatarError) {
        return new Response(JSON.stringify({ error: removeAvatarError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
