
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
 for (let i = 0; i < length; i += 1) {
 out += chars[randomValues[i] % chars.length];
 }
 return out;
};

const generateTemporaryPassword = () => `Pan@${randomString(8)}`;

const isSafeUrl = (value: string) => {
 try {
 const parsed = new URL(value);
 return parsed.protocol === "https:" || parsed.protocol === "http:";
 } catch {
 return false;
 }
};

const hasRequiredAdminModule = (profile: { perfil?: string | null; admin_modulos?: string[] | null; ativo?: boolean | null } | null) => {
 if (!profile || profile.perfil !== "admin" || profile.ativo === false) return false;
 if (profile.admin_modulos === null || profile.admin_modulos === undefined) return true;
 return Array.isArray(profile.admin_modulos) && profile.admin_modulos.includes(REQUIRED_ADMIN_MODULE);
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
if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(req, 503, "Serviço não configurado.");
    }

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
 return jsonError(req, 403, "Apenas admins com acesso ao módulo colaboradores podem criar usuários.");
 }

 const body = await req.json();
 const nome = String(body?.nome || "").trim();
 const cargo = String(body?.cargo || "Colaborador").trim() || "Colaborador";
 const aniversario = body?.aniversario ? String(body.aniversario).trim() : null;
 const email = String(body?.email || "").trim().toLowerCase();
 const telefone = body?.telefone ? String(body.telefone).trim() : null;
 const instagram = body?.instagram ? String(body.instagram).trim() : null;
 const linkedin = body?.linkedin ? String(body.linkedin).trim() : null;
 const github = body?.github ? String(body.github).trim() : null;
 const perfil = body?.perfil === "admin" ? "admin" : "colaborador";

 if (!nome || !email) {
 return jsonError(req, 400, "nome e e-mail são obrigatórios.");
 }

 for (const [campo, valor] of [["instagram", instagram], ["linkedin", linkedin], ["github", github]] as const) {
 if (valor && !isSafeUrl(valor)) {
 return jsonError(req, 400, `${campo} deve ser uma URL http(s) válida.`);
 }
 }

 const { data: existingProfile, error: existingProfileError } = await adminClient
 .from("colaboradores")
 .select("id")
 .eq("email", email)
 .maybeSingle();

 if (existingProfileError) {
 return jsonError(req, 500, "Erro ao verificar e-mail existente.", existingProfileError.message);
 }

 if (existingProfile) {
 return jsonError(req, 409, "Já existe colaborador com este e-mail.");
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
 return jsonError(
 req,
 authErrorLower.includes("already") || authErrorLower.includes("exists") ? 409 : 400,
 authErrorLower.includes("already") || authErrorLower.includes("exists")
 ? "Já existe um usuário de autenticação com este e-mail."
 : "Não foi possível criar o usuário.",
 authErrorMessage,
 );
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
 aniversario,
 perfil,
 primeiro_acesso: true,
 });

 if (createProfileError) {
 await adminClient.auth.admin.deleteUser(createdAuth.user.id);
 return jsonError(req, 500, "Erro ao criar perfil do colaborador.", createProfileError.message);
 }

 return jsonOk(req, {
 user_id: createdAuth.user.id,
 email,
 temporary_password: temporaryPassword,
 primeiro_acesso: true,
 });
 } catch (err) {
 console.error("[create-collaborator]", err);
 return jsonError(req, 500, "Erro interno. Tente novamente.");
 }
});
