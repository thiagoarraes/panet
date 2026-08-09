// Geração de código TOTP (RFC 6238) — HMAC-SHA1, janela de 30s, 6 dígitos.
// É o padrão de todo app autenticador (Google Authenticator, Authy, 1Password).
// Implementado com WebCrypto nativo; nenhuma dependência.

const PERIODO_S = 30;
const DIGITOS = 6;
const BASE32_ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Base32 (RFC 4648) — formato em que os serviços entregam o secret.
// Retorno preso a ArrayBuffer: é o que crypto.subtle.importKey aceita.
export function base32Decode(secret: string): Uint8Array<ArrayBuffer> {
  const limpo = secret.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const char of limpo) {
    const idx = BASE32_ALFABETO.indexOf(char);
    if (idx === -1) throw new Error("Secret TOTP não é Base32 válido.");
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((valor >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export async function gerarTotp(
  secret: string,
  agoraMs: number = Date.now(),
): Promise<{ codigo: string; segundosRestantes: number }> {
  const contador = Math.floor(agoraMs / 1000 / PERIODO_S);

  // Contador em big-endian de 8 bytes.
  const msg = new Uint8Array(8);
  let resto = contador;
  for (let i = 7; i >= 0; i--) {
    msg[i] = resto & 0xff;
    resto = Math.floor(resto / 256);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));

  // Dynamic truncation (RFC 4226 §5.3).
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binario =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];

  const codigo = String(binario % 10 ** DIGITOS).padStart(DIGITOS, "0");
  const segundosRestantes = PERIODO_S - Math.floor((agoraMs / 1000) % PERIODO_S);
  return { codigo, segundosRestantes };
}
