// Logica pura da adedonha (StopotS-like): constantes, sorteio de letra,
// pontuacao (10/5/0) e helpers de tempo. Sem dependencia de React/Supabase.

export const CATEGORIAS_PADRAO = [
  "Filme",
  "Esportista",
  "Cantor",
  "Doença",
  "Super-herói",
  "Verbo",
  "Nome masculino",
  "Idioma",
  "Vestuário",
  "Game",
  "Animal aquático",
  "Cor",
];

// Alfabeto util para adedonha (sem letras que quase nunca rendem: K, W, X, Y).
export const LETRAS_PADRAO = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "Z",
];

export const ALFABETO_COMPLETO = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
];

export const RODADAS_OPCOES = [4, 6, 8, 10, 12];

// Tempo (em segundos) de preenchimento por rodada — preset "Tempo" da config.
export const TEMPO_OPCOES = [
  { id: "rapido", label: "Rápido", segundos: 45 },
  { id: "medio", label: "Médio", segundos: 90 },
  { id: "longo", label: "Longo", segundos: 150 },
];

// Modo STOP: quando o botao STOP fica disponivel.
export const MODO_STOP_OPCOES = [
  { id: "padrao", label: "Padrão", desc: "Qualquer um pode dar STOP a qualquer momento." },
  { id: "completo", label: "Completo", desc: "Só pode dar STOP após preencher todas as categorias." },
];

export const TEMPO_VALIDACAO_SEGUNDOS = 60;
// Validação é por categoria: cada uma tem este tempo e auto-avança no fim.
export const TEMPO_VALIDACAO_CATEGORIA = 10;

// Ranking: tempo para todos marcarem "Estou pronto". Avança quando todos
// ficam prontos ou este tempo se esgota.
export const TEMPO_RANKING_SEGUNDOS = 30;

// Índice da categoria em validação e tempo restante dela, derivados do
// timestamp de início da fase de validação (sincroniza todos os clientes).
export const estadoValidacao = (faseIniciadaEm, totalCategorias) => {
  const decorrido = faseIniciadaEm
    ? Math.max(0, (Date.now() - new Date(faseIniciadaEm).getTime()) / 1000)
    : 0;
  const indice = Math.floor(decorrido / TEMPO_VALIDACAO_CATEGORIA);
  const restante = Math.max(0, Math.ceil(TEMPO_VALIDACAO_CATEGORIA - (decorrido % TEMPO_VALIDACAO_CATEGORIA)));
  return {
    indice,
    restante,
    acabou: indice >= totalCategorias,
    indiceVisivel: Math.min(indice, Math.max(0, totalCategorias - 1)),
  };
};

export const CONFIG_PADRAO = {
  rodadas: 8,
  modoStop: "padrao",
  tempo: "medio",
  categorias: CATEGORIAS_PADRAO,
  letras: LETRAS_PADRAO,
};

export const MAX_JOGADORES = 10;

export const tempoSegundos = (tempoId) =>
  TEMPO_OPCOES.find((t) => t.id === tempoId)?.segundos ?? 90;

// Normaliza config vinda do banco garantindo defaults.
export const normalizarConfig = (raw = {}) => ({
  rodadas: Number(raw.rodadas) || CONFIG_PADRAO.rodadas,
  modoStop: raw.modoStop || CONFIG_PADRAO.modoStop,
  tempo: raw.tempo || CONFIG_PADRAO.tempo,
  categorias:
    Array.isArray(raw.categorias) && raw.categorias.length > 0
      ? raw.categorias
      : CONFIG_PADRAO.categorias,
  letras:
    Array.isArray(raw.letras) && raw.letras.length > 0
      ? raw.letras
      : CONFIG_PADRAO.letras,
});

// Sorteia uma letra dentre as letras configuradas, evitando as ja usadas
// quando possivel.
export const sortearLetra = (letras = LETRAS_PADRAO, usadas = []) => {
  const pool = (letras.length ? letras : LETRAS_PADRAO).map((l) => l.toUpperCase());
  const usadasSet = new Set((usadas || []).map((l) => String(l).toUpperCase()));
  const disponiveis = pool.filter((l) => !usadasSet.has(l));
  const fonte = disponiveis.length > 0 ? disponiveis : pool;
  return fonte[Math.floor(Math.random() * fonte.length)];
};

// Normaliza uma resposta para comparacao (lower, sem acentos, sem espacos extra).
export const normalizarResposta = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

// Resposta comeca com a letra da rodada?
export const comecaComLetra = (valor, letra) => {
  const norm = normalizarResposta(valor);
  if (!norm) return false;
  return norm[0] === normalizarResposta(letra)[0];
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
// Regras StopotS: 10 = valida e unica; 5 = valida porem repetida (mesma palavra
// que outro jogador na mesma categoria); 0 = vazia ou invalidada pela maioria.
//
// Entradas:
//   respostas: [{ id, jogadorId, categoria, resposta }]
//   validacoes: [{ respostaId, votante_id, valido }]
//   letra: string
//   totalVotantes: numero de jogadores aptos a votar (para "maioria")
//
// Retorna: Map jogadorId -> pontos da rodada.
export const calcularPontuacaoRodada = ({
  respostas = [],
  validacoes = [],
  letra = "",
  totalVotantes = 0,
}) => {
  const votosPorResposta = new Map(); // respostaId -> { validos, invalidos }
  validacoes.forEach((v) => {
    const atual = votosPorResposta.get(v.respostaId) || { validos: 0, invalidos: 0 };
    if (v.valido) atual.validos += 1;
    else atual.invalidos += 1;
    votosPorResposta.set(v.respostaId, atual);
  });

  // Uma resposta e considerada invalida quando a maioria dos votantes a denunciou.
  const maioria = Math.floor(totalVotantes / 2) + 1;
  const ehValida = (resposta) => {
    if (!comecaComLetra(resposta.resposta, letra)) return false;
    const votos = votosPorResposta.get(resposta.id) || { validos: 0, invalidos: 0 };
    if (totalVotantes > 0 && votos.invalidos >= maioria) return false;
    return true;
  };

  // Conta palavras validas por categoria para detectar repeticoes.
  const contagemPorCategoria = new Map(); // categoria -> Map(palavraNorm -> count)
  respostas.forEach((r) => {
    if (!ehValida(r)) return;
    const palavra = normalizarResposta(r.resposta);
    if (!palavra) return;
    const mapa = contagemPorCategoria.get(r.categoria) || new Map();
    mapa.set(palavra, (mapa.get(palavra) || 0) + 1);
    contagemPorCategoria.set(r.categoria, mapa);
  });

  const pontosPorJogador = new Map();
  respostas.forEach((r) => {
    let pontos = 0;
    if (ehValida(r)) {
      const palavra = normalizarResposta(r.resposta);
      const repeticoes = contagemPorCategoria.get(r.categoria)?.get(palavra) || 0;
      pontos = repeticoes > 1 ? 5 : 10;
    }
    pontosPorJogador.set(r.jogadorId, (pontosPorJogador.get(r.jogadorId) || 0) + pontos);
  });

  return pontosPorJogador;
};

// Nome de exibicao de um jogador respeitando o anonimato.
export const nomeExibicao = (jogador) => {
  if (!jogador) return "Jogador";
  return jogador.apelido || jogador.nome || "Jogador";
};
