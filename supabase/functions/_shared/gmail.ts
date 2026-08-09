// Busca o código de verificação mais recente na caixa de e-mail do dono do
// serviço, para o colaborador não precisar pedir o código a ninguém.
//
// Escopo mínimo: gmail.readonly. A busca é limitada a mensagens recentes e,
// opcionalmente, a um remetente — não é um leitor de e-mail genérico.

import { getImpersonatedToken } from "./google.ts";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// Palavras que indicam que a mensagem é mesmo de verificação. Evita capturar
// número de pedido, valor ou CEP de um e-mail qualquer que chegou junto.
const PISTAS = [
  "codigo", "código", "code", "verification", "verificacao", "verificação",
  "confirm", "autenticacao", "autenticação", "one-time", "otp", "acesso",
];

type Mensagem = { assunto: string; corpo: string; recebidoEm: string };

const decodeBase64Url = (data: string): string => {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

// O corpo pode estar na raiz ou em qualquer parte do multipart.
// deno-lint-ignore no-explicit-any
const extrairCorpo = (payload: any): string => {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (Array.isArray(payload.parts)) {
    return payload.parts.map(extrairCorpo).join("\n");
  }
  return "";
};

const temPista = (texto: string): boolean => {
  const lower = texto.toLowerCase();
  return PISTAS.some((p) => lower.includes(p));
};

// Prefere sequências de 6 dígitos (o formato mais comum); cai para 4-8.
const extrairCodigo = (texto: string): string | null => {
  const semTags = texto.replace(/<[^>]+>/g, " ");
  return (
    semTags.match(/\b\d{6}\b/)?.[0] ??
    semTags.match(/\b\d{4,8}\b/)?.[0] ??
    null
  );
};

export async function buscarCodigoVerificacao(
  caixaEmail: string,
  remetente?: string | null,
  janela = "newer_than:1h",
): Promise<{ codigo: string; assunto: string; recebidoEm: string } | null> {
  const token = await getImpersonatedToken(caixaEmail, GMAIL_SCOPE);
  const auth = { Authorization: `Bearer ${token}` };

  const q = [janela, remetente ? `from:${remetente}` : ""].filter(Boolean).join(" ");
  const listRes = await fetch(
    `${API}/messages?maxResults=8&q=${encodeURIComponent(q)}`,
    { headers: auth },
  );
  if (!listRes.ok) throw new Error(`Gmail list falhou: ${await listRes.text()}`);
  const lista = await listRes.json();
  const ids: string[] = (lista.messages || []).map((m: { id: string }) => m.id);
  if (ids.length === 0) return null;

  // A API já devolve em ordem decrescente de data; para na primeira que serve.
  for (const id of ids) {
    const msgRes = await fetch(`${API}/messages/${id}?format=full`, { headers: auth });
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();

    const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
    const assunto = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
    const corpo = extrairCorpo(msg.payload);
    const recebidoEm = new Date(Number(msg.internalDate || Date.now())).toISOString();

    const candidata: Mensagem = { assunto, corpo, recebidoEm };
    if (!temPista(`${candidata.assunto} ${msg.snippet || ""} ${candidata.corpo}`)) continue;

    const codigo =
      extrairCodigo(candidata.assunto) ??
      extrairCodigo(msg.snippet || "") ??
      extrairCodigo(candidata.corpo);
    if (codigo) return { codigo, assunto: candidata.assunto, recebidoEm: candidata.recebidoEm };
  }

  return null;
}
