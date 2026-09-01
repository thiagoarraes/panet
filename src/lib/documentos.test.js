import { describe, test, expect } from "vitest";
import {
  soDigitos,
  formatCpf,
  formatCnpj,
  formatTelefone,
  formatCep,
  isCpfValido,
  isCnpjValido,
} from "./documentos.js";

describe("soDigitos", () => {
  test("remove tudo que nao e digito", () => {
    expect(soDigitos("123.456.789-09")).toBe("12345678909");
    expect(soDigitos(null)).toBe("");
  });
});

describe("formatCpf", () => {
  test("aplica a mascara completa", () => {
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
  });

  test("formata parcialmente enquanto digita", () => {
    expect(formatCpf("123")).toBe("123");
    expect(formatCpf("1234")).toBe("123.4");
    expect(formatCpf("123456")).toBe("123.456");
    expect(formatCpf("1234567")).toBe("123.456.7");
  });

  test("ignora digitos alem do 11o", () => {
    expect(formatCpf("123456789099999")).toBe("123.456.789-09");
  });
});

describe("formatCnpj", () => {
  test("aplica a mascara completa", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("formatTelefone", () => {
  test("formata fixo (10 digitos)", () => {
    expect(formatTelefone("1122223333")).toBe("(11) 2222-3333");
  });

  test("formata celular (11 digitos)", () => {
    expect(formatTelefone("11922223333")).toBe("(11) 92222-3333");
  });
});

describe("formatCep", () => {
  test("aplica a mascara progressivamente", () => {
    expect(formatCep("01310")).toBe("01310");
    expect(formatCep("01310100")).toBe("01310-100");
  });

  test("ignora caracteres nao numericos e trunca em 8 digitos", () => {
    expect(formatCep("01310-100extra")).toBe("01310-100");
  });
});

describe("isCpfValido", () => {
  test("aceita CPF com digito verificador correto", () => {
    expect(isCpfValido("123.456.789-09")).toBe(true);
  });

  test("rejeita sequencia repetida", () => {
    expect(isCpfValido("111.111.111-11")).toBe(false);
    expect(isCpfValido("000.000.000-00")).toBe(false);
  });

  test("rejeita digito verificador errado", () => {
    expect(isCpfValido("123.456.789-00")).toBe(false);
  });

  test("rejeita tamanho errado", () => {
    expect(isCpfValido("123")).toBe(false);
  });
});

describe("isCnpjValido", () => {
  test("aceita CNPJ com digito verificador correto", () => {
    expect(isCnpjValido("11.222.333/0001-81")).toBe(true);
  });

  test("rejeita sequencia repetida", () => {
    expect(isCnpjValido("11.111.111/1111-11")).toBe(false);
  });

  test("rejeita digito verificador errado", () => {
    expect(isCnpjValido("11.222.333/0001-00")).toBe(false);
  });
});
