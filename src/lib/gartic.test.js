import { describe, test, expect } from "vitest";
import {
  BANCO_PALAVRAS,
  OPCOES_PALAVRA,
  CONFIG_PADRAO,
  normalizarConfig,
  tempoSegundos,
  sortearPalavras,
  totalRodadas,
  desenhistaDaRodada,
  normalizarPalpite,
  acertou,
  mascararPalavra,
  revelarDica,
  segundosRestantes,
  pontosAcerto,
  pontosDesenhista,
} from "./gartic.js";

describe("normalizarConfig", () => {
  test("aplica defaults quando vazio", () => {
    expect(normalizarConfig({})).toEqual(CONFIG_PADRAO);
  });

  test("coage voltas para número e mantém valores válidos", () => {
    expect(normalizarConfig({ voltas: "3", tempo: "rapido" })).toEqual({
      voltas: 3,
      tempo: "rapido",
    });
  });

  test("cai no default quando voltas é inválido", () => {
    expect(normalizarConfig({ voltas: 0 }).voltas).toBe(CONFIG_PADRAO.voltas);
  });
});

describe("tempoSegundos", () => {
  test("resolve preset conhecido", () => {
    expect(tempoSegundos("rapido")).toBe(60);
    expect(tempoSegundos("longo")).toBe(120);
  });

  test("fallback para id desconhecido", () => {
    expect(tempoSegundos("inexistente")).toBe(80);
  });
});

describe("sortearPalavras", () => {
  test("retorna N palavras distintas do banco", () => {
    const opcoes = sortearPalavras([], OPCOES_PALAVRA);
    expect(opcoes).toHaveLength(OPCOES_PALAVRA);
    expect(new Set(opcoes).size).toBe(OPCOES_PALAVRA);
    opcoes.forEach((p) => expect(BANCO_PALAVRAS).toContain(p));
  });

  test("evita palavras já usadas quando há banco suficiente", () => {
    const usadas = BANCO_PALAVRAS.slice(0, 10);
    const opcoes = sortearPalavras(usadas, 3);
    opcoes.forEach((p) => expect(usadas).not.toContain(p));
  });
});

describe("totalRodadas", () => {
  test("multiplica jogadores por voltas", () => {
    expect(totalRodadas(4, 2)).toBe(8);
  });

  test("piso de 1 para entradas degeneradas", () => {
    expect(totalRodadas(0, 0)).toBe(1);
  });
});

describe("desenhistaDaRodada", () => {
  const jogadores = [{ id: "a" }, { id: "b" }, { id: "c" }];

  test("round-robin determinístico 1-based", () => {
    expect(desenhistaDaRodada(jogadores, 1).id).toBe("a");
    expect(desenhistaDaRodada(jogadores, 2).id).toBe("b");
    expect(desenhistaDaRodada(jogadores, 3).id).toBe("c");
  });

  test("dá a volta na lista", () => {
    expect(desenhistaDaRodada(jogadores, 4).id).toBe("a");
  });

  test("retorna null sem jogadores", () => {
    expect(desenhistaDaRodada([], 1)).toBeNull();
  });
});

describe("normalizarPalpite / acertou", () => {
  test("ignora caixa, acentos e espaços extras", () => {
    expect(normalizarPalpite("  Cão   Bravo ")).toBe("cao bravo");
  });

  test("acerta com variações de acento e caixa", () => {
    expect(acertou("LEÃO", "leao")).toBe(true);
    expect(acertou("girafa", "Girafa")).toBe(true);
  });

  test("não acerta palavra diferente", () => {
    expect(acertou("gato", "cachorro")).toBe(false);
  });

  test("palpite vazio nunca acerta", () => {
    expect(acertou("", "")).toBe(false);
  });
});

describe("mascararPalavra", () => {
  test("underscores preservando espaços e hífens", () => {
    expect(mascararPalavra("gato")).toBe("_ _ _ _");
    expect(mascararPalavra("guarda-chuva")).toBe("_ _ _ _ _ _ - _ _ _ _ _");
  });
});

describe("revelarDica", () => {
  const contarLetras = (s) => (s.match(/[a-zA-ZÀ-ÿ]/g) || []).length;

  test("nada revelado no começo (antes de 40%)", () => {
    expect(contarLetras(revelarDica("gato", 0))).toBe(0);
    expect(contarLetras(revelarDica("gato", 0.3))).toBe(0);
  });

  test("revela mais letras conforme o tempo passa", () => {
    const cedo = contarLetras(revelarDica("cachorro", 0.5));
    const tarde = contarLetras(revelarDica("cachorro", 1));
    expect(tarde).toBeGreaterThan(cedo);
  });

  test("nunca revela mais que metade das letras", () => {
    const reveladas = contarLetras(revelarDica("gato", 1));
    expect(reveladas).toBeLessThanOrEqual(2);
  });

  test("preserva espaços e hífens", () => {
    expect(revelarDica("guarda-chuva", 0)).toContain("-");
  });
});

describe("segundosRestantes", () => {
  test("retorna a duração quando não há início", () => {
    expect(segundosRestantes(null, 80)).toBe(80);
  });

  test("conta para baixo a partir do início", () => {
    const inicio = new Date(Date.now() - 30 * 1000).toISOString();
    const restante = segundosRestantes(inicio, 80);
    expect(restante).toBeGreaterThan(45);
    expect(restante).toBeLessThanOrEqual(50);
  });

  test("não fica negativo", () => {
    const inicio = new Date(Date.now() - 200 * 1000).toISOString();
    expect(segundosRestantes(inicio, 80)).toBe(0);
  });
});

describe("pontosAcerto", () => {
  test("primeiro a acertar pontua mais que o segundo", () => {
    expect(pontosAcerto(1, 0)).toBeGreaterThan(pontosAcerto(2, 0));
  });

  test("bônus de tempo soma até 50", () => {
    expect(pontosAcerto(1, 1)).toBe(150);
    expect(pontosAcerto(1, 0)).toBe(100);
  });

  test("piso de 40 por ordem alta", () => {
    expect(pontosAcerto(99, 0)).toBe(40);
  });
});

describe("pontosDesenhista", () => {
  test("zero quando ninguém acerta", () => {
    expect(pontosDesenhista(0, 4)).toBe(0);
  });

  test("30 por acerto", () => {
    expect(pontosDesenhista(2, 4)).toBe(60);
  });

  test("bônus quando todos acertam", () => {
    expect(pontosDesenhista(4, 4)).toBe(150);
  });
});
