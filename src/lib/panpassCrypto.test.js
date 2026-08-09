import { describe, expect, it, beforeAll } from "vitest";
import { gerarTotp } from "../../supabase/functions/_shared/totp.ts";

// As funções vivem nas Edge Functions (Deno), mas são JS puro com WebCrypto —
// rodam igual no Node do Vitest. O único acoplamento é `Deno.env`, que o
// crypto.ts lê; damos um stub antes de importá-lo.
beforeAll(() => {
  const chave = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
  globalThis.Deno = { env: { get: (k) => (k === "PANPASS_MASTER_KEY" ? chave : undefined) } };
});

describe("TOTP (RFC 6238)", () => {
  // Vetor oficial da RFC 6238: secret SHA-1 "12345678901234567890" em Base32,
  // T = 59s → código 94287082. Com 6 dígitos, os últimos seis: 287082.
  const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("gera o código esperado para o timestamp do vetor de referência", async () => {
    const { codigo } = await gerarTotp(SECRET, 59 * 1000);
    expect(codigo).toBe("287082");
  });

  it("gera código diferente na janela seguinte", async () => {
    const a = await gerarTotp(SECRET, 59 * 1000);
    const b = await gerarTotp(SECRET, (59 + 30) * 1000);
    expect(a.codigo).not.toBe(b.codigo);
  });

  it("reporta os segundos restantes dentro da janela de 30s", async () => {
    const { segundosRestantes } = await gerarTotp(SECRET, 65 * 1000);
    expect(segundosRestantes).toBe(25);
  });

  it("rejeita secret que não é Base32", async () => {
    await expect(gerarTotp("nao-base32!!")).rejects.toThrow(/Base32/);
  });
});

describe("cifra AES-GCM dos segredos", () => {
  it("faz round-trip do valor original", async () => {
    const { encrypt, decrypt } = await import("../../supabase/functions/_shared/crypto.ts");
    const senha = "s3nh@-de-teste-com-acento-ção";
    const cifrado = await encrypt(senha);
    expect(cifrado).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(cifrado).not.toContain(senha);
    expect(await decrypt(cifrado)).toBe(senha);
  });

  it("gera IV novo a cada cifragem", async () => {
    const { encrypt } = await import("../../supabase/functions/_shared/crypto.ts");
    const a = await encrypt("mesma-senha");
    const b = await encrypt("mesma-senha");
    expect(a).not.toBe(b);
  });

  it("falha em valor cifrado malformado", async () => {
    const { decrypt } = await import("../../supabase/functions/_shared/crypto.ts");
    await expect(decrypt("sem-separador")).rejects.toThrow(/inválido/);
  });
});
