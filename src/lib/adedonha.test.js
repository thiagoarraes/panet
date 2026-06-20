import { describe, test, expect } from "vitest";
import {
  CONFIG_PADRAO,
  LETRAS_PADRAO,
  normalizarConfig,
  tempoSegundos,
  normalizarResposta,
  comecaComLetra,
  sortearLetra,
  segundosRestantes,
  estadoValidacao,
  calcularPontuacaoRodada,
} from "./adedonha.js";

describe("normalizarConfig", () => {
  test("aplica defaults quando vazio", () => {
    expect(normalizarConfig({})).toEqual(CONFIG_PADRAO);
  });

  test("preserva categorias/letras customizadas e coage rodadas", () => {
    const cfg = normalizarConfig({ rodadas: "6", categorias: ["X"], letras: ["A"] });
    expect(cfg.rodadas).toBe(6);
    expect(cfg.categorias).toEqual(["X"]);
    expect(cfg.letras).toEqual(["A"]);
  });

  test("ignora arrays vazios e volta ao default", () => {
    expect(normalizarConfig({ categorias: [] }).categorias).toEqual(CONFIG_PADRAO.categorias);
  });
});

describe("tempoSegundos", () => {
  test("resolve preset e faz fallback", () => {
    expect(tempoSegundos("rapido")).toBe(45);
    expect(tempoSegundos("xpto")).toBe(90);
  });
});

describe("normalizarResposta / comecaComLetra", () => {
  test("remove acentos, caixa e espaços", () => {
    expect(normalizarResposta("  Ávila ")).toBe("avila");
  });

  test("compara a primeira letra ignorando acento", () => {
    expect(comecaComLetra("Água", "A")).toBe(true);
    expect(comecaComLetra("Banana", "A")).toBe(false);
  });

  test("resposta vazia não começa com letra", () => {
    expect(comecaComLetra("", "A")).toBe(false);
  });
});

describe("sortearLetra", () => {
  test("retorna letra do pool", () => {
    expect(LETRAS_PADRAO).toContain(sortearLetra(LETRAS_PADRAO, []));
  });

  test("evita letras já usadas quando possível", () => {
    const usadas = LETRAS_PADRAO.slice(0, LETRAS_PADRAO.length - 1);
    const restante = LETRAS_PADRAO[LETRAS_PADRAO.length - 1];
    expect(sortearLetra(LETRAS_PADRAO, usadas)).toBe(restante);
  });
});

describe("segundosRestantes", () => {
  test("duração total sem início", () => {
    expect(segundosRestantes(null, 90)).toBe(90);
  });

  test("não fica negativo", () => {
    const inicio = new Date(Date.now() - 1000 * 1000).toISOString();
    expect(segundosRestantes(inicio, 90)).toBe(0);
  });
});

describe("estadoValidacao", () => {
  test("início recente fica na categoria 0", () => {
    const { indice, acabou } = estadoValidacao(new Date().toISOString(), 5);
    expect(indice).toBe(0);
    expect(acabou).toBe(false);
  });

  test("acaba quando o índice passa do total de categorias", () => {
    const inicio = new Date(Date.now() - 100 * 1000).toISOString();
    expect(estadoValidacao(inicio, 3).acabou).toBe(true);
  });
});

describe("calcularPontuacaoRodada", () => {
  test("válida e única vale 10", () => {
    const respostas = [{ id: "r1", jogadorId: "j1", categoria: "Comida", resposta: "Abacaxi" }];
    const pontos = calcularPontuacaoRodada({ respostas, validacoes: [], letra: "A", totalVotantes: 1 });
    expect(pontos.get("j1")).toBe(10);
  });

  test("válida porém repetida vale 5 para cada", () => {
    const respostas = [
      { id: "r1", jogadorId: "j1", categoria: "Comida", resposta: "Abacaxi" },
      { id: "r2", jogadorId: "j2", categoria: "Comida", resposta: "abacaxi" },
    ];
    const pontos = calcularPontuacaoRodada({ respostas, validacoes: [], letra: "A", totalVotantes: 2 });
    expect(pontos.get("j1")).toBe(5);
    expect(pontos.get("j2")).toBe(5);
  });

  test("resposta que não começa com a letra vale 0", () => {
    const respostas = [{ id: "r1", jogadorId: "j1", categoria: "Comida", resposta: "Banana" }];
    const pontos = calcularPontuacaoRodada({ respostas, validacoes: [], letra: "A", totalVotantes: 1 });
    expect(pontos.get("j1")).toBe(0);
  });

  test("resposta invalidada pela maioria vale 0", () => {
    const respostas = [{ id: "r1", jogadorId: "j1", categoria: "Comida", resposta: "Abacaxi" }];
    const validacoes = [
      { respostaId: "r1", votanteId: "j2", valido: false },
      { respostaId: "r1", votanteId: "j3", valido: false },
    ];
    const pontos = calcularPontuacaoRodada({ respostas, validacoes, letra: "A", totalVotantes: 3 });
    expect(pontos.get("j1")).toBe(0);
  });
});
