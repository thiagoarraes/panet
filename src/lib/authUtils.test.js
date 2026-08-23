import { describe, expect, it } from "vitest";
import { friendlyLoginError, isRetryableLoginError } from "./authUtils";

const INSTAVEL = "O serviço de autenticação está instável. Tente novamente em alguns segundos.";
const CREDENCIAL = "E-mail ou senha incorretos. Verifique os dados e tente novamente.";
const GENERICA = "Não foi possível fazer login.";

describe("isRetryableLoginError", () => {
  it("trata erro 5xx como instabilidade temporária", () => {
    expect(isRetryableLoginError({ status: 500 })).toBe(true);
    expect(isRetryableLoginError({ status: 503 })).toBe(true);
  });

  it("nao trata 400 como instabilidade temporária", () => {
    expect(isRetryableLoginError({ status: 400 })).toBe(false);
  });

  it("reconhece falhas de rede pela mensagem", () => {
    expect(isRetryableLoginError({ message: "Failed to fetch" })).toBe(true);
    expect(isRetryableLoginError({ message: "upstream connect error" })).toBe(true);
    expect(isRetryableLoginError({ message: "gateway timeout" })).toBe(true);
  });
});

describe("friendlyLoginError", () => {
  it("avisa sobre instabilidade quando o erro é temporário", () => {
    expect(friendlyLoginError({ status: 503 })).toBe(INSTAVEL);
    expect(friendlyLoginError({ message: "Failed to fetch" })).toBe(INSTAVEL);
  });

  it("traduz credencial inválida do Supabase", () => {
    expect(friendlyLoginError({ status: 400 })).toBe(CREDENCIAL);
    expect(friendlyLoginError({ message: "Invalid login credentials" })).toBe(CREDENCIAL);
    expect(friendlyLoginError({ message: "Email not confirmed" })).toBe(CREDENCIAL);
  });

  it("nao vaza a mensagem crua do Supabase em credencial inválida", () => {
    const msg = friendlyLoginError({ status: 400, message: "Invalid login credentials" });
    expect(msg).not.toContain("Invalid");
    expect(msg).toBe(CREDENCIAL);
  });

  // Instabilidade tem precedência: um 400 acompanhado de falha de rede é
  // problema de conexao, nao senha errada.
  it("prioriza instabilidade sobre credencial quando os dois combinam", () => {
    expect(friendlyLoginError({ status: 400, message: "network request failed" })).toBe(INSTAVEL);
  });

  it("repassa mensagens desconhecidas sem reescrever", () => {
    expect(friendlyLoginError({ message: "Rate limit exceeded" })).toBe("Rate limit exceeded");
  });

  it("cai na mensagem genérica quando nao ha o que exibir", () => {
    expect(friendlyLoginError(null)).toBe(GENERICA);
    expect(friendlyLoginError(undefined)).toBe(GENERICA);
    expect(friendlyLoginError({})).toBe(GENERICA);
  });
});
