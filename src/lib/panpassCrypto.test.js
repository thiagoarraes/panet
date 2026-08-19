import { describe, expect, it, beforeAll } from "vitest";

// As funções vivem nas Edge Functions (Deno), mas são JS puro com WebCrypto —
// rodam igual no Node do Vitest. O único acoplamento é `Deno.env`, que o
// crypto.ts lê; damos um stub antes de importá-lo.
beforeAll(() => {
  const chave = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
  globalThis.Deno = { env: { get: (k) => (k === "PANPASS_MASTER_KEY" ? chave : undefined) } };
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
