
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

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

const hasRequiredAdminModule = (profile: { perfil?: string | null; admin_modulos?: string[] | null; ativo?: boolean | null } | null) => {
 if (!profile || profile.perfil !== "admin" || profile.ativo === false) return false;
 if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
 return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
};

serve(async (req) => {
 if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

 if (req.method !== "POST") {
 return jsonError(req, 405, "Method not allowed");
 }

try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    if (!supabaseUrl || !serviceRoleKey) return jsonError(req, 503, "Serviço não configurado.");

 const authHeader = req.headers.get("Authorization");
 const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
 const callerToken = bearerToken.trim();
 if (!callerToken) {
 return jsonError(req, 401, "Não autenticado.");
 }
 const adminClient = createClient(supabaseUrl, serviceRoleKey, {
 auth: { persistSession: false },
 });

 const {
 data: { user: callerUser },
 error: callerError,
 } = await adminClient.auth.getUser(callerToken);

 if (callerError || !callerUser) {
 return jsonError(req, 401, "Não autenticado.");
 }

 const { data: callerProfile, error: profileError } = await adminClient
 .from("colaboradores")
 .select("id, perfil, admin_modulos, ativo")
 .eq("id", callerUser.id)
 .maybeSingle();

 if (profileError || !hasRequiredAdminModule(callerProfile)) {
 return jsonError(req, 403, "Apenas admins com acesso ao módulo colaboradores podem redefinir senhas.");
 }

 const body = await req.json();
 const userId = String(body?.user_id || "").trim();
 const email = String(body?.email || "")
 .trim()
 .toLowerCase();

 if (!userId && !email) {
 return jsonError(req, 400, "user_id ou email é obrigatório.");
 }

 let targetProfile:
 | {
 id: string;
 email: string;
 }
 | null = null;

 if (userId) {
 const { data, error } = await adminClient.from("colaboradores").select("id,email").eq("id", userId).maybeSingle();
 if (error) return jsonError(req, 500, "Erro ao localizar colaborador.", error.message);
 targetProfile = data;
 } else {
 const { data, error } = await adminClient.from("colaboradores").select("id,email").eq("email", email).maybeSingle();
 if (error) return jsonError(req, 500, "Erro ao localizar colaborador.", error.message);
 targetProfile = data;
 }

 if (!targetProfile?.id) {
 return jsonError(req, 404, "Colaborador não encontrado.");
 }

 const temporaryPassword = generateTemporaryPassword();
 const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(targetProfile.id, {
 password: temporaryPassword,
 email_confirm: true,
 });
 if (updateAuthError) {
 return jsonError(req, 500, "Erro ao redefinir a senha.", updateAuthError.message);
 }

 const { error: updateProfileError } = await adminClient
 .from("colaboradores")
 .update({ primeiro_acesso: true })
 .eq("id", targetProfile.id);
 if (updateProfileError) {
 return jsonError(req, 500, "Erro ao atualizar o perfil.", updateProfileError.message);
 }

 return jsonOk(req, {
 ok: true,
 user_id: targetProfile.id,
 email: targetProfile.email,
 temporary_password: temporaryPassword,
 primeiro_acesso: true,
 });
 } catch (err) {
 console.error("[reset-password]", err);
 return jsonError(req, 500, "Erro interno. Tente novamente.");
 }
});
