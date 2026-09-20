// Helpers HTTP compartilhados pelas Edge Functions:
// CORS restrito a origens do app e respostas de erro sem detalhes internos.

const ALLOWED_ORIGINS = [
  "https://panet.vercel.app",
  "https://panet.agenciapan.com",
  "http://localhost:5173",
  "http://localhost:4173",
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonError(
  req: Request,
  status: number,
  mensagemPublica: string,
  detalheInterno?: unknown,
) {
  if (detalheInterno !== undefined) {
    console.error("[edge]", detalheInterno);
  }
  return new Response(JSON.stringify({ error: mensagemPublica }), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function jsonOk(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
