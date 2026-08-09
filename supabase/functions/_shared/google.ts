// Autenticação Google via service account com domain-wide delegation.
// Mesma mecânica já usada em add-calendar-event/index.ts (mantido intocado);
// aqui em forma reutilizável para o PanPass ler o Gmail do dono da caixa.
//
// Requer o escopo desejado liberado para o client ID do service account em
// Google Admin Console → Segurança → Controle de acesso a dados e à API →
// Delegação em todo o domínio.

export function base64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function createServiceAccountJwt(
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
      sub: userEmail, // impersonação: é isto que dá acesso à caixa do usuário
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

export async function getAccessToken(jwt: string): Promise<string> {
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
  return data.access_token as string;
}

// Atalho: token já pronto para impersonar `userEmail` com `scope`.
export async function getImpersonatedToken(userEmail: string, scope: string): Promise<string> {
  const googleJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!googleJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada.");
  const sa = JSON.parse(googleJson);
  const jwt = await createServiceAccountJwt(sa.client_email, sa.private_key, userEmail, scope);
  return await getAccessToken(jwt);
}
