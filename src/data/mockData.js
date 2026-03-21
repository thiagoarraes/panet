// src/data/mockData.js
// Dados fictícios usados enquanto o Supabase não está integrado.
// Quando cada módulo for integrado ao banco, importe os dados reais
// nos hooks correspondentes (src/hooks/) e remova daqui.

const postImg    = (seed) => `https://picsum.photos/seed/${seed}/800/400`;
const galeriaImg = (seed) => `https://picsum.photos/seed/${seed}/600/450`;
const todayIso = (() => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
})();

export const COLABORADORES = [
  { id: 1,  nome: "Ana Paula Ferreira", cargo: "Diretora de Criação",      email: "ana.paula@agenciapan.com",    telefone: "(84) 99812-4401", foto: "AP", cor: "#E8826A", redes: { instagram: "anapaulaferreira",   linkedin: "ana-paula-ferreira" } },
  { id: 2,  nome: "Bruno Cavalcanti",   cargo: "Gerente de Projetos",       email: "bruno.cavalcanti@agenciapan.com", telefone: "(84) 99723-5512", foto: "BC", cor: "#5B8DEF", redes: { instagram: "brunocavalcanti",    linkedin: "bruno-cavalcanti" } },
  { id: 3,  nome: "Camila Torres",      cargo: "Designer UX/UI",            email: "camila.torres@agenciapan.com",   telefone: "(84) 98834-7723", foto: "CT", cor: "#7BC47A", redes: { instagram: "camilatorres.ux" } },
  { id: 4,  nome: "Diego Almeida",      cargo: "Desenvolvedor Full Stack",   email: "diego.almeida@agenciapan.com",   telefone: "(84) 99645-8834", foto: "DA", cor: "#C478E8", redes: { linkedin: "diego-almeida-dev",  github: "diegoa" } },
  { id: 5,  nome: "Fernanda Lima",      cargo: "Social Media",              email: "fernanda.lima@agenciapan.com",   telefone: "(84) 98756-9945", foto: "FL", cor: "#E8B84B", redes: { instagram: "fernandalima.social" } },
  { id: 6,  nome: "Gabriel Souza",      cargo: "Gestor de Tráfego",         email: "gabriel.souza@agenciapan.com",   telefone: "(84) 99867-0056", foto: "GS", cor: "#4BCFE8", redes: { linkedin: "gabriel-souza-trafego" } },
  { id: 7,  nome: "Helena Costa",       cargo: "Redatora Criativa",         email: "helena.costa@agenciapan.com",    telefone: "(84) 98978-1167", foto: "HC", cor: "#E84B7A", redes: { instagram: "helenacosta.words" } },
  { id: 8,  nome: "Igor Martins",       cargo: "Fotógrafo",                 email: "igor.martins@agenciapan.com",    telefone: "(84) 99089-2278", foto: "IM", cor: "#8DE8A0", redes: { instagram: "igormartins.foto" } },
  { id: 9,  nome: "Juliana Rocha",      cargo: "Executiva de Contas",       email: "juliana.rocha@agenciapan.com",   telefone: "(84) 99100-3389", foto: "JR", cor: "#E88B4B", redes: { linkedin: "juliana-rocha-contas" } },
  { id: 10, nome: "Seven Rodrigues",    cargo: "Tech Lead",                 email: "seven@agenciapan.com",           telefone: "(84) 99211-4490", foto: "SR", cor: "#11E7E7", redes: { github: "sevenrodrigues", linkedin: "seven-rodrigues" }, isMe: true },
];

export const POSTAGENS_INIT = [
  { id: 1, titulo: "Pan conquista Prêmio Referência em Marketing Digital 2025", categoria: "Notícia",    data: "2026-03-12", imagem: postImg("premio-pan"),   descricao: "A Agência Pan foi reconhecida como uma das melhores agências digitais do Nordeste no prêmio anual da Abradi. Um marco histórico para todos nós!", curtidas: [1,3,5,7,9], comentarios: [{ autor: COLABORADORES[1], texto: "Merecidíssimo! Muito orgulho de fazer parte desse time.", hora: "09:15" }, { autor: COLABORADORES[4], texto: "Que notícia incrível! Vamos comemorar!", hora: "10:02" }] },
  { id: 2, titulo: "Novo processo de alinhamento semanal a partir de abril",    categoria: "Comunicado", data: "2026-03-10", imagem: postImg("reuniao-pan"),  descricao: "A partir de abril, as reuniões de alinhamento semanal acontecerão toda segunda-feira às 9h. A participação é obrigatória para todos os líderes de área.", curtidas: [2,4,6], comentarios: [{ autor: COLABORADORES[8], texto: "Ótimo! Precisávamos muito disso.", hora: "14:30" }] },
  { id: 3, titulo: "Happy Hour Pan — Edição Março 🎉",                          categoria: "Evento",     data: "2026-03-08", imagem: postImg("happyhour"),    descricao: "O happy hour deste mês acontece no dia 28/03, sexta-feira, a partir das 18h. Local: Terraço do escritório. Confirmem presença com a Ju!", curtidas: [1,2,3,4,5,6,7,8,9,10], comentarios: [{ autor: COLABORADORES[2], texto: "Já confirmo presença! 🎊", hora: "11:00" }] },
  { id: 4, titulo: "Expansão: Pan abre nova frente de serviços em Branding",    categoria: "Notícia",    data: "2026-03-05", imagem: postImg("branding-pan"), descricao: "A Pan está expandindo seu portfólio com uma nova área de Branding Estratégico. Apresentação oficial para o time acontece na próxima semana.", curtidas: [3,5,7], comentarios: [] },
  { id: 5, titulo: "Atualização da política de home office",                    categoria: "Comunicado", data: "2026-03-01", imagem: postImg("homeoffice"),   descricao: "A partir de abril, o modelo híbrido será de 3 dias presenciais e 2 em home office por semana.", curtidas: [1,2,4,8], comentarios: [] },
];

export const ANIVERSARIANTES_INIT = [
  { colaborador: COLABORADORES[1], data: "22/03", diasRestantes: 8,  reacoes: [1, 3, 5] },
  { colaborador: COLABORADORES[2], data: "05/04", diasRestantes: 22, reacoes: [2, 4] },
  { colaborador: COLABORADORES[3], data: "18/05", diasRestantes: 65, reacoes: [] },
  { colaborador: COLABORADORES[0], data: "14/03", diasRestantes: 0,  reacoes: [2, 4, 6, 8, 10] },
];

export const FERIAS_INIT = [
  { colaborador: COLABORADORES[5], inicio: "10/03/2026", fim: "28/03/2026", status: "em_andamento" },
  { colaborador: COLABORADORES[7], inicio: "24/03/2026", fim: "07/04/2026", status: "marcado" },
  { colaborador: COLABORADORES[9], inicio: "14/04/2026", fim: "28/04/2026", status: "marcado" },
];

export const DAYOFF_INIT = [
  { colaborador: COLABORADORES[4], inicio: "14/03/2026", fim: "14/03/2026" },
  { colaborador: COLABORADORES[6], inicio: "17/03/2026", fim: "17/03/2026" },
];

export const PRESENCIAL_INIT = [
  {
    id: "presencial-1",
    titulo: "Sprint de Criacao Presencial",
    dataIso: "2026-03-19",
    horaIso: "09:30",
    amigoSecretoAtivo: true,
    amigoSecretoRegras: "Participa quem confirmar presenca e entrar no amigo secreto antes do admin iniciar o sorteio.",
    local: "Escritorio Pan - Sala Principal",
    mapsUrl: "https://maps.google.com/?q=Agencia+Pan",
    vagas: 14,
    observacao: "Dia focado em alinhamentos rapidos, brainstorm e gravacoes internas.",
    status: "aberto",
    confirmacoes: [
      { id: "presencial-1-confirm-1", status: "confirmado", observacao: "Vou direto para o escritorio.", colaborador: COLABORADORES[2] },
      { id: "presencial-1-confirm-2", status: "confirmado", observacao: "", colaborador: COLABORADORES[4] },
      { id: "presencial-1-confirm-3", status: "talvez", observacao: "Confirmo de manha.", colaborador: COLABORADORES[7] },
    ],
  },
  {
    id: "presencial-2",
    titulo: "Dia de Integracao de Projetos",
    dataIso: "2026-03-26",
    horaIso: "10:00",
    amigoSecretoAtivo: false,
    amigoSecretoRegras: "",
    local: "Escritorio Pan - Hub Colaborativo",
    mapsUrl: "https://maps.google.com/?q=Agencia+Pan",
    vagas: 10,
    observacao: "Opcional. Bom momento para quem precisa alinhar demandas entre contas, design e desenvolvimento.",
    status: "aberto",
    confirmacoes: [
      { id: "presencial-2-confirm-1", status: "confirmado", observacao: "", colaborador: COLABORADORES[1] },
      { id: "presencial-2-confirm-2", status: "talvez", observacao: "Depende de reuniao externa.", colaborador: COLABORADORES[8] },
    ],
  },
  {
    id: "presencial-3",
    titulo: "Pan Morning Presencial",
    dataIso: "2026-04-02",
    horaIso: "08:30",
    amigoSecretoAtivo: true,
    amigoSecretoRegras: "Sorteio opcional para quem quiser participar da dinamica do encontro.",
    local: "Escritorio Pan - Terraço",
    mapsUrl: "https://maps.google.com/?q=Agencia+Pan",
    vagas: 16,
    observacao: "Cafe da manha com time completo e rodada de updates leves.",
    status: "aberto",
    confirmacoes: [],
  },
];

export const GALERIA_EVENTOS = [
  { id: 1, evento: "Festa de Fim de Ano 2025",  mes: "Dez 2025", capa: galeriaImg("christmas-party"), fotos: [
      { src: galeriaImg("xmas1"),    legenda: "Time todo reunido!" },
      { src: galeriaImg("xmas2"),    legenda: "Mesa de natal incrível" },
      { src: galeriaImg("party1"),   legenda: "Hora da celebração" },
      { src: galeriaImg("party2"),   legenda: "Risadas garantidas" },
      { src: galeriaImg("office1"),  legenda: "Escritório decorado" },
      { src: galeriaImg("team1"),    legenda: "Equipe de criação" },
  ]},
  { id: 2, evento: "Workshop de Branding",       mes: "Fev 2026", capa: galeriaImg("workshop-brand"), fotos: [
      { src: galeriaImg("workshop1"), legenda: "Apresentação de cases" },
      { src: galeriaImg("workshop2"), legenda: "Dinâmica em grupo" },
      { src: galeriaImg("design1"),   legenda: "Exercício de identidade" },
      { src: galeriaImg("meeting1"),  legenda: "Feedback dos times" },
  ]},
  { id: 3, evento: "Confraternização Q3",        mes: "Set 2025", capa: galeriaImg("confrat-q3"), fotos: [
      { src: galeriaImg("drink1"),    legenda: "Brinde ao Q3" },
      { src: galeriaImg("confrat1"),  legenda: "Time de contas" },
      { src: galeriaImg("food1"),     legenda: "Mesa farta!" },
      { src: galeriaImg("fun1"),      legenda: "Momento de descontração" },
      { src: galeriaImg("group1"),    legenda: "Foto oficial do Q3" },
  ]},
  { id: 4, evento: "Kick-off 2026",              mes: "Jan 2026", capa: galeriaImg("kickoff-2026"), fotos: [
      { src: galeriaImg("kickoff1"), legenda: "Abertura do ano" },
      { src: galeriaImg("kickoff2"), legenda: "Planejamento estratégico" },
      { src: galeriaImg("office2"),  legenda: "Novo layout do escritório" },
  ]},
  { id: 5, evento: "Happy Hour Outubro",         mes: "Out 2025", capa: galeriaImg("happyhour-out"), fotos: [
      { src: galeriaImg("bar1"),  legenda: "No terraço!" },
      { src: galeriaImg("beer1"), legenda: "Merecido!" },
      { src: galeriaImg("team2"), legenda: "Sexta-feira mood" },
  ]},
  { id: 6, evento: "Aniversário da Agência",     mes: "Jul 2025", capa: galeriaImg("aniversario-pan"), fotos: [
      { src: galeriaImg("bday1"),      legenda: "8 anos de Pan! 🎂" },
      { src: galeriaImg("bday2"),      legenda: "Bolo comemorativo" },
      { src: galeriaImg("bday3"),      legenda: "Equipe toda presente" },
      { src: galeriaImg("celebrate1"), legenda: "Parabéns Pan!" },
      { src: galeriaImg("celebrate2"), legenda: "Confraternização" },
      { src: galeriaImg("team3"),      legenda: "Foto histórica" },
  ]},
];

export const MURAL_INIT = [
  { id: 1, colaborador: COLABORADORES[0], texto: "Pessoal, quem tiver interesse no workshop de branding semana que vem, me mandem mensagem! Serão apenas 8 vagas.", hora: "08:42", data: "Hoje" },
  { id: 2, colaborador: COLABORADORES[4], texto: "Alguém sabe a senha do Wi-Fi novo do escritório? 😅", hora: "09:15", data: "Hoje" },
  { id: 3, colaborador: COLABORADORES[1], texto: "Brunopanwifi123 hahaha", hora: "09:17", data: "Hoje" },
  { id: 4, colaborador: COLABORADORES[8], texto: "Lembrem que amanhã temos reunião de alinhamento de contas às 14h! Confirmem presença 🙏", hora: "11:30", data: "Hoje" },
  { id: 5, colaborador: COLABORADORES[2], texto: "Entregando as artes do cliente Natura hoje à tarde. Pessoal de criação, qualquer dúvida me chamem!", hora: "13:45", data: "Ontem" },
];

export const MOOD_CHECKINS_INIT = [
  {
    id: "mood-1",
    colaboradorId: 1,
    moodId: "flow",
    energy: 8,
    tags: ["Criativo hoje", "Bom humor"],
    dateKey: todayIso,
    createdAt: `${todayIso}T08:35:00`,
    updatedAt: `${todayIso}T08:35:00`,
  },
  {
    id: "mood-2",
    colaboradorId: 3,
    moodId: "focus",
    energy: 7,
    tags: ["Deadline próximo", "Inspirado"],
    dateKey: todayIso,
    createdAt: `${todayIso}T09:12:00`,
    updatedAt: `${todayIso}T09:12:00`,
  },
  {
    id: "mood-3",
    colaboradorId: 6,
    moodId: "steady",
    energy: 5,
    tags: ["Reunião demais"],
    dateKey: todayIso,
    createdAt: `${todayIso}T10:05:00`,
    updatedAt: `${todayIso}T10:05:00`,
  },
  {
    id: "mood-4",
    colaboradorId: 8,
    moodId: "rocket",
    energy: 9,
    tags: ["Tomei café", "Com ideia nova"],
    dateKey: todayIso,
    createdAt: `${todayIso}T10:44:00`,
    updatedAt: `${todayIso}T10:44:00`,
  },
];
