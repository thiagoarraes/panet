// Logica pura do gartic (Skribbl-like): banco de palavras, sorteio, rodizio de
// desenhista, normalizacao/comparacao de palpites e pontuacao.
// Sem dependencia de React/Supabase.

// Banco de palavras pt-br geral, agrupado so para curadoria (o jogo usa o flat).
const PALAVRAS_POR_TEMA = {
  animais: [
    "cachorro", "gato", "elefante", "girafa", "leão", "tartaruga", "pinguim",
    "coruja", "cavalo", "macaco", "jacaré", "borboleta", "aranha", "tubarão",
    "polvo", "cobra", "sapo", "abelha", "caranguejo", "camelo", "ouriço", "raposa",
  ],
  objetos: [
    "guarda-chuva", "óculos", "relógio", "tesoura", "chave", "martelo", "telefone",
    "lâmpada", "cadeira", "vassoura", "mochila", "garfo", "panela", "violão",
    "câmera", "bicicleta", "escova de dente", "controle remoto", "abajur", "balde",
  ],
  comida: [
    "pizza", "hambúrguer", "banana", "abacaxi", "cenoura", "bolo", "sorvete",
    "pipoca", "ovo frito", "cachorro-quente", "melancia", "queijo", "sushi",
    "brigadeiro", "café", "pão", "morango", "milho",
  ],
  lugares: [
    "praia", "montanha", "castelo", "farol", "ponte", "igreja", "estádio",
    "aeroporto", "vulcão", "deserto", "cachoeira", "ilha", "floresta", "arranha-céu",
  ],
  acoes: [
    "dormir", "correr", "nadar", "dançar", "chorar", "pular", "cozinhar", "pescar",
    "voar", "cantar", "espirrar", "abraçar", "escalar", "telefonar",
  ],
  natureza: [
    "arco-íris", "tempestade", "nuvem", "estrela", "girassol", "cacto", "neve",
    "relâmpago", "lua", "sol", "vento", "fogueira",
  ],
  pessoas: [
    "palhaço", "bombeiro", "astronauta", "pirata", "robô", "fantasma", "bruxa",
    "super-herói", "rei", "ninja", "médico", "chef de cozinha",
  ],
};

export const BANCO_PALAVRAS = Object.values(PALAVRAS_POR_TEMA).flat();

// Presets de tempo de desenho (segundos).
export const TEMPO_OPCOES = [
  { id: "rapido", label: "Rápido", segundos: 60 },
  { id: "medio", label: "Médio", segundos: 80 },
  { id: "longo", label: "Longo", segundos: 120 },
];

// Voltas por jogador (cada volta = todos desenham uma vez).
export const RODADAS_OPCOES = [1, 2, 3, 4];

// Tempo para o desenhista escolher a palavra (auto-pick no fim).
export const TEMPO_ESCOLHA_SEGUNDOS = 15;

// Tempo da tela de revelacao antes de avancar.
export const TEMPO_REVELACAO_SEGUNDOS = 8;

// Quantas opcoes de palavra sao oferecidas ao desenhista.
export const OPCOES_PALAVRA = 3;

export const MAX_JOGADORES = 10;

export const CONFIG_PADRAO = {
  voltas: 2,
  tempo: "medio",
};

export const tempoSegundos = (tempoId) =>
  TEMPO_OPCOES.find((t) => t.id === tempoId)?.segundos ?? 80;

// Normaliza config vinda do banco garantindo defaults.
export const normalizarConfig = (raw = {}) => ({
  voltas: Number(raw.voltas) || CONFIG_PADRAO.voltas,
  tempo: raw.tempo || CONFIG_PADRAO.tempo,
});

// Embaralha (Fisher-Yates) sem mutar o array original.
const embaralhar = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Sorteia N palavras distintas, evitando as ja usadas quando possivel.
export const sortearPalavras = (usadas = [], n = OPCOES_PALAVRA) => {
  const usadasSet = new Set((usadas || []).map((p) => normalizarPalpite(p)));
  const disponiveis = BANCO_PALAVRAS.filter((p) => !usadasSet.has(normalizarPalpite(p)));
  const fonte = disponiveis.length >= n ? disponiveis : BANCO_PALAVRAS;
  return embaralhar(fonte).slice(0, n);
};

// Total de rodadas da partida: cada jogador desenha uma vez por volta.
export const totalRodadas = (numJogadores = 0, voltas = 1) =>
  Math.max(1, numJogadores) * Math.max(1, voltas);

// Desenhista da rodada `numero` (1-based), round-robin determinístico pela ordem
// de entrada. Resiliente a entradas/saidas: usa a lista atual de jogadores.
export const desenhistaDaRodada = (jogadores = [], numero = 1) => {
  if (!jogadores.length) return null;
  const pos = (Math.max(1, numero) - 1) % jogadores.length;
  return jogadores[pos];
};

// Normaliza texto para comparacao (lower, sem acentos, sem espacos extra).
export const normalizarPalpite = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\s+/g, " ");

// O palpite acerta a palavra?
export const acertou = (palpite, palavra) => {
  const p = normalizarPalpite(palpite);
  return Boolean(p) && p === normalizarPalpite(palavra);
};

// Mascara da palavra (dica publica): underscores preservando espacos e hifens.
export const mascararPalavra = (palavra = "") =>
  String(palavra)
    .split("")
    .map((ch) => (ch === " " ? "  " : ch === "-" ? "-" : "_"))
    .join(" ")
    .trim();

// Quanto da palavra revelar conforme o tempo decorrido (so a partir de 40% do
// tempo, até no máximo metade das letras).
const letrasReveladas = (totalLetras, fracaoDecorrida) => {
  const maxRevelar = Math.floor(totalLetras / 2);
  const prog = Math.max(0, (fracaoDecorrida - 0.4) / 0.6); // 0 antes de 40%, 1 no fim
  return Math.min(maxRevelar, Math.floor(prog * maxRevelar));
};

// Dica progressiva: underscores com algumas letras reveladas conforme o tempo.
// Determinística (mesmo resultado em todos os clientes para a mesma fração).
export const revelarDica = (palavra = "", fracaoDecorrida = 0) => {
  const chars = String(palavra).split("");
  const indicesLetra = chars
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c !== " " && x.c !== "-")
    .map((x) => x.i);
  const reveladas = new Set(indicesLetra.slice(0, letrasReveladas(indicesLetra.length, fracaoDecorrida)));
  return chars
    .map((ch, i) => {
      if (ch === " ") return "  ";
      if (ch === "-") return "-";
      return reveladas.has(i) ? ch.toUpperCase() : "_";
    })
    .join(" ")
    .trim();
};

// Segundos restantes de uma fase, dado o timestamp de inicio e a duracao.
export const segundosRestantes = (faseIniciadaEm, duracaoSegundos) => {
  if (!faseIniciadaEm) return duracaoSegundos;
  const inicio = new Date(faseIniciadaEm).getTime();
  if (Number.isNaN(inicio)) return duracaoSegundos;
  const decorrido = (Date.now() - inicio) / 1000;
  return Math.max(0, Math.ceil(duracaoSegundos - decorrido));
};

// ─── Pontuacao ──────────────────────────────────────────────────────────────
// Adivinhador: quanto mais cedo acerta (menor ordem) e mais tempo sobra, mais
// pontos. Base 100, decai com a ordem do acerto. Desenhista: ganha proporcional
// a quantos acertaram.

const PONTOS_BASE_ACERTO = 100;

// Pontos de um acerto. ordem = 1 para o primeiro a acertar, 2 para o segundo...
// fracaoTempo = segundosRestantes / duracaoTotal (0..1).
export const pontosAcerto = (ordem = 1, fracaoTempo = 0) => {
  const porOrdem = Math.max(40, PONTOS_BASE_ACERTO - (ordem - 1) * 20);
  const bonusTempo = Math.round(Math.max(0, Math.min(1, fracaoTempo)) * 50);
  return porOrdem + bonusTempo;
};

// Pontos do desenhista: 30 por acerto, com teto. Zero se ninguem acertou.
export const pontosDesenhista = (qtdAcertos = 0, totalAdivinhadores = 0) => {
  if (qtdAcertos <= 0) return 0;
  const base = qtdAcertos * 30;
  // Bonus se todos acertaram.
  const todos = totalAdivinhadores > 0 && qtdAcertos >= totalAdivinhadores ? 30 : 0;
  return base + todos;
};

// Nome de exibicao respeitando o anonimato.
export const nomeExibicao = (jogador) => {
  if (!jogador) return "Jogador";
  return jogador.apelido || jogador.nome || "Jogador";
};
