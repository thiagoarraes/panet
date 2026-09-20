import { describe, test, expect } from "vitest";
import { REQUISITOS_SENHA, requisitosPendentes, senhaValida } from "./senhaRequisitos";

describe("requisitos de senha", () => {
  test("aceita senha que cumpre os cinco requisitos", () => {
    expect(senhaValida("Grunge775!")).toBe(true);
    expect(requisitosPendentes("Grunge775!")).toEqual([]);
  });

  // O caso do incidente: a barra de forca antiga pintava 4/4 verde e o submit
  // recusava. O checklist tem que apontar exatamente o que falta.
  test("aponta caractere especial faltante em senha longa e forte na aparencia", () => {
    const pendentes = requisitosPendentes("Grunge775");
    expect(senhaValida("Grunge775")).toBe(false);
    expect(pendentes.map((r) => r.id)).toEqual(["especial"]);
  });

  test("lista todos os requisitos pendentes de uma senha vazia", () => {
    expect(requisitosPendentes("").map((r) => r.id)).toEqual([
      "tamanho",
      "minuscula",
      "maiuscula",
      "numero",
      "especial",
    ]);
  });

  test.each([
    ["Ab1!xyzw", true, "exatamente 8 caracteres"],
    ["Ab1!xyz", false, "7 caracteres"],
    ["ABC123!@#", false, "sem minuscula"],
    ["abc123!@#", false, "sem maiuscula"],
    ["abcDEF!@#", false, "sem numero"],
    ["abcDEF123", false, "sem especial"],
    ["Ab1 xyzw", true, "espaco conta como caractere especial"],
    ["Ab1çxyzw", true, "acento conta como caractere especial"],
  ])("%s -> %s (%s)", (senha, esperado) => {
    expect(senhaValida(senha)).toBe(esperado);
  });

  test("nao quebra com valores nulos", () => {
    expect(senhaValida(null)).toBe(false);
    expect(senhaValida(undefined)).toBe(false);
  });

  test("todo requisito tem id e label unicos", () => {
    const ids = REQUISITOS_SENHA.map((r) => r.id);
    const labels = REQUISITOS_SENHA.map((r) => r.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
    for (const r of REQUISITOS_SENHA) expect(r.label.trim()).not.toBe("");
  });
});
