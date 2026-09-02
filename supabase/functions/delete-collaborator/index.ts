import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUIRED_ADMIN_MODULE = "colaboradores";

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

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();

const hasRequiredAdminModule = (profile: { perfil?: string | null; admin_modulos?: string[] | null; ativo?: boolean | null } | null) => {
  if (!profile || profile.perfil !== "admin" || profile.ativo === false) return false;
  if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
  return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
};

const findAuthUserIdByEmail = async (
  adminClient: { auth: { admin: { listUsers: (params: { page: number; perPage: number }) => Promise<{ data?: { users?: Array<{ id?: string; email?: string | null }> }; error?: { message?: string } | null }> } } },
  email: string,
) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return "";
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) return "";
    const users = data?.users || [];
    const hit = users.find((user) => normalizeEmail(user?.email) === normalized);
    if (hit?.id) return hit.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return "";
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
    const candidateTokens = bearerToken.trim() ? [bearerToken.trim()] : [];

    if (candidateTokens.length === 0) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let callerUser: { id: string } | null = null;
    for (const token of candidateTokens) {
      const {
        data: { user },
        error,
      } = await adminClient.auth.getUser(token);
      if (!error && user?.id) {
        callerUser = { id: user.id };
        break;
      }
    }

    if (!callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileError } = await adminClient
      .from("colaboradores")
      .select("id, perfil, admin_modulos, ativo")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !hasRequiredAdminModule(callerProfile)) {
      return new Response(JSON.stringify({ error: "Only admins with colaboradores access can delete users." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userId = String(body?.user_id || "").trim();
    const providedEmail = normalizeEmail(body?.email);
    if (!userId && !providedEmail) {
      return new Response(JSON.stringify({ error: "user_id ou email é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId && userId === callerUser.id) {
      return new Response(JSON.stringify({ error: "Você não pode excluir seu próprio usuário." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetProfile:
      | {
          id: string;
          foto_url: string | null;
          email: string | null;
        }
      | null = null;

    if (userId) {
      const { data, error } = await adminClient
        .from("colaboradores")
        .select("id, foto_url, email")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetProfile = data;
    }

    if (!targetProfile && providedEmail) {
      const { data, error } = await adminClient
        .from("colaboradores")
        .select("id, foto_url, email")
        .eq("email", providedEmail)
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetProfile = data;
    }

    const targetProfileId = String(targetProfile?.id || userId || "").trim();
    const targetEmail = normalizeEmail(targetProfile?.email || providedEmail);

    if (targetProfileId && targetProfileId === callerUser.id) {
      return new Response(JSON.stringify({ error: "Você não pode excluir seu próprio usuário." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ error: reassignPostsError }, avatarListResult] = await Promise.all([
      targetProfileId
        ? adminClient.from("postagens").update({ autor_id: callerUser.id }).eq("autor_id", targetProfileId)
        : Promise.resolve({ error: null }),
      targetProfileId
        ? adminClient.storage.from("avatares").list(targetProfileId, {
          limit: 1000,
          offset: 0,
        })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const userAvatarFiles = avatarListResult?.data || [];
    const listAvatarError = avatarListResult?.error || null;

    if (reassignPostsError) {
      return new Response(JSON.stringify({ error: reassignPostsError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (listAvatarError) {
      return new Response(JSON.stringify({ error: listAvatarError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avatarPaths = new Set<string>();
    const currentAvatarPath = extractAvatarPathFromUrl(String(targetProfile?.foto_url || ""));
    if (currentAvatarPath) avatarPaths.add(currentAvatarPath);

    for (const file of userAvatarFiles || []) {
      if (!file?.name) continue;
      avatarPaths.add(`${targetProfileId}/${file.name}`);
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

    // Ensure collaborator-linked data is removed before deleting auth user.
    // This avoids stale cards/filters and handles schemas without full FK cascade.
    const cleanupTasks = await Promise.all([
      targetProfileId ? adminClient.from("curtidas").delete().eq("colaborador_id", targetProfileId) : Promise.resolve({ error: null }),
      targetProfileId ? adminClient.from("comentarios").delete().eq("colaborador_id", targetProfileId) : Promise.resolve({ error: null }),
      targetProfileId ? adminClient.from("mural").delete().eq("colaborador_id", targetProfileId) : Promise.resolve({ error: null }),
      targetProfileId ? adminClient.from("ferias").delete().eq("colaborador_id", targetProfileId) : Promise.resolve({ error: null }),
      targetProfileId ? adminClient.from("aniversario_parabenizacoes").delete().eq("colaborador_id", targetProfileId) : Promise.resolve({ error: null }),
      targetProfileId ? adminClient.from("aniversario_parabenizacoes").delete().eq("aniversariante_id", targetProfileId) : Promise.resolve({ error: null }),
      targetProfileId ? adminClient.from("colaboradores").delete().eq("id", targetProfileId) : Promise.resolve({ error: null }),
      targetEmail ? adminClient.from("colaboradores").delete().eq("email", targetEmail) : Promise.resolve({ error: null }),
    ]);

    for (const result of cleanupTasks) {
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let authUserId = targetProfileId;
    if (!authUserId && targetEmail) {
      authUserId = await findAuthUserIdByEmail(adminClient, targetEmail);
    }

    if (authUserId) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId);
      if (deleteError && !String(deleteError.message || "").toLowerCase().includes("not found")) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, deleted_auth_user_id: authUserId || null }), {
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
