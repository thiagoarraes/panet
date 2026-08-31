import { describe, test, expect } from "vitest";
import { temModulo, isSuperAdmin } from "./permissoes.js";

describe("isSuperAdmin", () => {
  test("admin com admin_modulos null e super admin", () => {
    expect(isSuperAdmin({ perfil: "admin", ativo: true, admin_modulos: null })).toBe(true);
  });

  // Bug real que existia em AdminPage.jsx:39-40 antes desta extracao: o campo
  // admin_modulos so existe para quem e admin, entao um colaborador comum
  // tambem tem admin_modulos === null. Um check que so olhasse esse campo
  // classificaria QUALQUER colaborador como super admin.
  test("colaborador comum com admin_modulos null NAO e super admin", () => {
    expect(isSuperAdmin({ perfil: "colaborador", ativo: true, admin_modulos: null })).toBe(false);
  });

  test("admin desativado (ex-panner) NAO e super admin mesmo com modulos null", () => {
    expect(isSuperAdmin({ perfil: "admin", ativo: false, admin_modulos: null })).toBe(false);
  });

  test("perfil ausente NAO e super admin", () => {
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe("temModulo", () => {
  test("super admin (modulos null) tem qualquer modulo", () => {
    const p = { perfil: "admin", ativo: true, admin_modulos: null };
    expect(temModulo(p, "colaboradores")).toBe(true);
    expect(temModulo(p, "panpass")).toBe(true);
  });

  test("admin com lista restrita so tem os modulos listados", () => {
    const p = { perfil: "admin", ativo: true, admin_modulos: ["colaboradores"] };
    expect(temModulo(p, "colaboradores")).toBe(true);
    expect(temModulo(p, "panpass")).toBe(false);
  });

  test("admin com lista vazia nao tem nenhum modulo", () => {
    const p = { perfil: "admin", ativo: true, admin_modulos: [] };
    expect(temModulo(p, "colaboradores")).toBe(false);
  });

  // O caso critico da feature: colaborador comum nunca ve dados de RH, mesmo
  // com admin_modulos null (que para ele so significa "campo nao populado").
  test("colaborador comum nunca tem modulo, mesmo com admin_modulos null", () => {
    expect(temModulo({ perfil: "colaborador", ativo: true, admin_modulos: null }, "colaboradores")).toBe(false);
  });

  test("admin desativado perde o modulo mesmo com acesso total", () => {
    expect(temModulo({ perfil: "admin", ativo: false, admin_modulos: null }, "colaboradores")).toBe(false);
  });

  test("perfil ausente nunca tem modulo", () => {
    expect(temModulo(null, "colaboradores")).toBe(false);
    expect(temModulo(undefined, "colaboradores")).toBe(false);
  });
});
