
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonError, jsonOk } from "../_shared/http.ts";
import { getServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";
import { criarRest } from "../_shared/rest.ts";

const EVENT_ID_RE = /^[A-Za-z0-9_-]+$/;

function base64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function createServiceAccountJwt(
  serviceAccountEmail: string,
  privateKeyPem: string,
  userEmail: string,
  scope: string,
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64url(
    JSON.stringify({
      iss: serviceAccountEmail,
      sub: userEmail,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signingInput = `${header}.${claims}`;
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(signatureBytes)}`;
}

async function getAccessToken(jwt: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!response.ok) throw new Error(`Token error: ${await response.text()}`);
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  if (req.method !== "POST") {
    return jsonError(req, 405, "Method not allowed");
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey();
    const googleJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

    if (!supabaseUrl || !serviceRoleKey || !googleJson) {
      throw new Error("Missing required environment variables");
    }

    const serviceAccount = JSON.parse(googleJson);

    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : "";
    const callerToken = bearerToken.trim();

    if (!callerToken) {
      return jsonError(req, 401, "Não autenticado.");
    }

    const rest = criarRest(supabaseUrl, serviceRoleKey);

    const { data: user, error: userError } = await rest.getUser(callerToken);
    if (userError || !user) {
      return jsonError(req, 401, "Não autenticado.");
    }

    const { data: profile } = await rest.selectOne<{ email: string | null }>(
      "colaboradores",
      `id=eq.${user.id}&select=email`,
    );

    const userEmail = profile?.email || user.email;
    if (!userEmail) throw new Error("User email not found");

    const body = await req.json();
    const { eventId } = body;

    if (!eventId) {
      return jsonError(req, 400, "eventId é obrigatório");
    }
    if (!EVENT_ID_RE.test(String(eventId))) {
      return jsonError(req, 400, "eventId inválido.");
    }

    const jwt = await createServiceAccountJwt(
      serviceAccount.client_email,
      serviceAccount.private_key,
      userEmail,
      "https://www.googleapis.com/auth/calendar.events",
    );

    const accessToken = await getAccessToken(jwt);

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(String(eventId))}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    // 204 = deleted, 410 = already gone — both are acceptable
    if (!calendarResponse.ok && calendarResponse.status !== 410) {
      throw new Error(`Calendar API error: ${await calendarResponse.text()}`);
    }

    return jsonOk(req, { success: true });
  } catch (err) {
    console.error("[remove-calendar-event]", err);
    return jsonError(req, 500, "Erro interno. Tente novamente.");
  }
});

