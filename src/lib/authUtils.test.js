import { describe, expect, it } from "vitest";
import { friendlyLoginError, isRetryableLoginError } from "./authUtils";

const INSTAVEL = "O serviço de autenticação está instável. Tente novamente em alguns segundos.";
const CREDENCIAL = "E-mail ou senha incorretos. Verifique os dados e tente novamente.";
const GENERICA = "Não foi possível fazer login.";
const BANIDO = "Seu acesso à Panet foi encerrado. Se acha que houve engano, fale com o RH.";

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

  // Ex Panner: o Supabase responde 400 + error_code user_banned. Como a regra
  // de credencial tambem captura 400, sem a checagem vindo antes o
  // ex-colaborador via "e-mail ou senha incorretos" e ia tentar recuperar
  // senha a toa.
  it("identifica usuario banido (Ex Panner) em vez de culpar a senha", () => {
    // formato do supabase-js
    expect(friendlyLoginError({ status: 400, code: "user_banned", message: "User is banned" })).toBe(BANIDO);
    // formato cru da API auth/v1
    expect(friendlyLoginError({ status: 400, error_code: "user_banned", msg: "User is banned" })).toBe(BANIDO);
    // so pela mensagem, se o code nao vier
    expect(friendlyLoginError({ status: 400, message: "User is banned" })).toBe(BANIDO);
  });

  it("banido tem precedencia sobre credencial (ambos sao 400)", () => {
    const msg = friendlyLoginError({ status: 400, code: "user_banned", message: "User is banned" });
    expect(msg).not.toBe(CREDENCIAL);
    expect(msg).toContain("RH");
  });

  // Instabilidade continua ganhando de tudo: se a rede caiu, nao da para
  // afirmar que a conta foi encerrada.
  it("instabilidade tem precedencia sobre banido", () => {
    expect(friendlyLoginError({ status: 503, code: "user_banned" })).toBe(INSTAVEL);
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
