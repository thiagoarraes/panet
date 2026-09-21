const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Preferimos sempre a publishable (esquema novo de API keys). A anon legada
// fica so como fallback: ela e desativada ao concluir a migracao de chaves, e
// ter ordens de precedencia diferentes por arquivo ja causou incidente antes.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return cookies;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Revoga a sessão no Supabase antes de limpar os cookies.
  // Falhas de rede não impedem o logout local (best-effort).
  //
  // scope=local é obrigatório: o padrão do GoTrue é `global`, que derruba as
  // sessões do usuário em TODOS os dispositivos. Sair no navegador do trabalho
  // matava a sessão de casa e a do ambiente de dev — e de um jeito difícil de
  // diagnosticar, porque o access token continua com assinatura válida. O
  // PostgREST segue aceitando (só confere assinatura) e a tela parece logada,
  // enquanto as Edge Functions respondem "Não autenticado." (o GoTrue confere
  // a linha da sessão e devolve session_not_found).
  const cookies = parseCookies(req.headers.cookie);
  const accessToken = cookies.panet_at;
  if (accessToken && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: cookies.panet_rt || "" }),
      });
    } catch (_err) {
      // Best-effort: cookies são limpos de qualquer forma.
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const base = `HttpOnly; ${isProd ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=0`;

  res.setHeader("Set-Cookie", [
    `panet_at=; ${base}`,
    `panet_rt=; ${base}`,
    `panet_sid=; ${isProd ? "Secure; " : ""}SameSite=Strict; Path=/; Max-Age=0`,
  ]);

  return res.status(200).json({ success: true });
}
