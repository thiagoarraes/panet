import { useState, useEffect, useRef, useCallback } from "react";

// ── Fake image helpers ────────────────────────────────────────────────────────
const postImg = (seed) => `https://picsum.photos/seed/${seed}/800/400`;
const galeriaImg = (seed) => `https://picsum.photos/seed/${seed}/600/450`;

// ── Mock Data ──────────────────────────────────────────────────────────────
const COLABORADORES = [
  { id: 1, nome: "Ana Paula Ferreira", cargo: "Diretora de Criação", email: "ana.paula@agenciapan.com", telefone: "(84) 99812-4401", foto: "AP", cor: "#E8826A", redes: { instagram: "anapaulaferreira", linkedin: "ana-paula-ferreira" } },
  { id: 2, nome: "Bruno Cavalcanti", cargo: "Gerente de Projetos", email: "bruno.cavalcanti@agenciapan.com", telefone: "(84) 99723-5512", foto: "BC", cor: "#5B8DEF", redes: { instagram: "brunocavalcanti", linkedin: "bruno-cavalcanti" } },
  { id: 3, nome: "Camila Torres", cargo: "Designer UX/UI", email: "camila.torres@agenciapan.com", telefone: "(84) 98834-7723", foto: "CT", cor: "#7BC47A", redes: { instagram: "camilatorres.ux" } },
  { id: 4, nome: "Diego Almeida", cargo: "Desenvolvedor Full Stack", email: "diego.almeida@agenciapan.com", telefone: "(84) 99645-8834", foto: "DA", cor: "#C478E8", redes: { linkedin: "diego-almeida-dev", github: "diegoa" } },
  { id: 5, nome: "Fernanda Lima", cargo: "Social Media", email: "fernanda.lima@agenciapan.com", telefone: "(84) 98756-9945", foto: "FL", cor: "#E8B84B", redes: { instagram: "fernandalima.social" } },
  { id: 6, nome: "Gabriel Souza", cargo: "Gestor de Tráfego", email: "gabriel.souza@agenciapan.com", telefone: "(84) 99867-0056", foto: "GS", cor: "#4BCFE8", redes: { linkedin: "gabriel-souza-trafego" } },
  { id: 7, nome: "Helena Costa", cargo: "Redatora Criativa", email: "helena.costa@agenciapan.com", telefone: "(84) 98978-1167", foto: "HC", cor: "#E84B7A", redes: { instagram: "helenacosta.words" } },
  { id: 8, nome: "Igor Martins", cargo: "Fotógrafo", email: "igor.martins@agenciapan.com", telefone: "(84) 99089-2278", foto: "IM", cor: "#8DE8A0", redes: { instagram: "igormartins.foto" } },
  { id: 9, nome: "Juliana Rocha", cargo: "Executiva de Contas", email: "juliana.rocha@agenciapan.com", telefone: "(84) 99100-3389", foto: "JR", cor: "#E88B4B", redes: { linkedin: "juliana-rocha-contas" } },
  { id: 10, nome: "Seven Rodrigues", cargo: "Tech Lead", email: "seven@agenciapan.com", telefone: "(84) 99211-4490", foto: "SR", cor: "#11E7E7", redes: { github: "sevenrodrigues", linkedin: "seven-rodrigues" }, isMe: true },
];

const POSTAGENS_INIT = [
  { id: 1, titulo: "Pan conquista Prêmio Referência em Marketing Digital 2025", categoria: "Notícia", data: "2026-03-12", imagem: postImg("premio-pan"), descricao: "A Agência Pan foi reconhecida como uma das melhores agências digitais do Nordeste no prêmio anual da Abradi. Um marco histórico para todos nós!", curtidas: [1, 3, 5, 7, 9], comentarios: [{ autor: COLABORADORES[1], texto: "Merecidíssimo! Muito orgulho de fazer parte desse time.", hora: "09:15" }, { autor: COLABORADORES[4], texto: "Que notícia incrível! Vamos comemorar!", hora: "10:02" }] },
  { id: 2, titulo: "Novo processo de alinhamento semanal a partir de abril", categoria: "Comunicado", data: "2026-03-10", imagem: postImg("reuniao-pan"), descricao: "A partir de abril, as reuniões de alinhamento semanal acontecerão toda segunda-feira às 9h. A participação é obrigatória para todos os líderes de área.", curtidas: [2, 4, 6], comentarios: [{ autor: COLABORADORES[8], texto: "Ótimo! Precisávamos muito disso.", hora: "14:30" }] },
  { id: 3, titulo: "Happy Hour Pan — Edição Março 🎉", categoria: "Evento", data: "2026-03-08", imagem: postImg("happyhour"), descricao: "O happy hour deste mês acontece no dia 28/03, sexta-feira, a partir das 18h. Local: Terraço do escritório. Confirmem presença com a Ju!", curtidas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], comentarios: [{ autor: COLABORADORES[2], texto: "Já confirmo presença! 🎊", hora: "11:00" }, { autor: COLABORADORES[6], texto: "Topo demais!", hora: "11:45" }] },
  { id: 4, titulo: "Expansão: Pan abre nova frente de serviços em Branding", categoria: "Notícia", data: "2026-03-05", imagem: postImg("branding-pan"), descricao: "A Pan está expandindo seu portfólio com uma nova área de Branding Estratégico. Apresentação oficial para o time acontece na próxima semana.", curtidas: [3, 5, 7], comentarios: [] },
  { id: 5, titulo: "Atualização da política de home office", categoria: "Comunicado", data: "2026-03-01", imagem: postImg("homeoffice"), descricao: "A partir de abril, o modelo híbrido será de 3 dias presenciais e 2 em home office por semana. Os dias presenciais serão definidos por cada equipe com seu gestor.", curtidas: [1, 2, 4, 8], comentarios: [{ autor: COLABORADORES[0], texto: "Adorei a flexibilidade!", hora: "16:00" }] },
];

const ANIVERSARIANTES_INIT = [
  { colaborador: COLABORADORES[1], data: "22/03", diasRestantes: 8, reacoes: [1, 3, 5] },
  { colaborador: COLABORADORES[2], data: "05/04", diasRestantes: 22, reacoes: [2, 4] },
  { colaborador: COLABORADORES[3], data: "18/05", diasRestantes: 65, reacoes: [] },
  { colaborador: COLABORADORES[0], data: "14/03", diasRestantes: 0, reacoes: [2, 4, 6, 8, 10] },
];

const FERIAS_INIT = [
  { colaborador: COLABORADORES[5], inicio: "10/03/2026", fim: "28/03/2026", status: "em_andamento" },
  { colaborador: COLABORADORES[7], inicio: "24/03/2026", fim: "07/04/2026", status: "marcado" },
  { colaborador: COLABORADORES[9], inicio: "14/04/2026", fim: "28/04/2026", status: "marcado" },
];

const DAYOFF_INIT = [
  { colaborador: COLABORADORES[4], inicio: "14/03/2026", fim: "14/03/2026" },
  { colaborador: COLABORADORES[6], inicio: "17/03/2026", fim: "17/03/2026" },
];

const GALERIA_EVENTOS = [
  {
    id: 1, evento: "Festa de Fim de Ano 2025", mes: "Dez 2025",
    capa: galeriaImg("christmas-party"),
    fotos: [
      { id: 1, src: galeriaImg("xmas1"), legenda: "Time todo reunido!" },
      { id: 2, src: galeriaImg("xmas2"), legenda: "Mesa de natal incrível" },
      { id: 3, src: galeriaImg("party1"), legenda: "Hora da celebração" },
      { id: 4, src: galeriaImg("party2"), legenda: "Risadas garantidas" },
      { id: 5, src: galeriaImg("office1"), legenda: "Escritório decorado" },
      { id: 6, src: galeriaImg("team1"), legenda: "Equipe de criação" },
    ]
  },
  {
    id: 2, evento: "Workshop de Branding", mes: "Fev 2026",
    capa: galeriaImg("workshop-brand"),
    fotos: [
      { id: 1, src: galeriaImg("workshop1"), legenda: "Apresentação de cases" },
      { id: 2, src: galeriaImg("workshop2"), legenda: "Dinâmica em grupo" },
      { id: 3, src: galeriaImg("design1"), legenda: "Exercício de identidade" },
      { id: 4, src: galeriaImg("meeting1"), legenda: "Feedback dos times" },
    ]
  },
  {
    id: 3, evento: "Confraternização Q3", mes: "Set 2025",
    capa: galeriaImg("confrat-q3"),
    fotos: [
      { id: 1, src: galeriaImg("drink1"), legenda: "Brinde ao Q3" },
      { id: 2, src: galeriaImg("confrat1"), legenda: "Time de contas" },
      { id: 3, src: galeriaImg("food1"), legenda: "Mesa farta!" },
      { id: 4, src: galeriaImg("fun1"), legenda: "Momento de descontração" },
      { id: 5, src: galeriaImg("group1"), legenda: "Foto oficial do Q3" },
    ]
  },
  {
    id: 4, evento: "Kick-off 2026", mes: "Jan 2026",
    capa: galeriaImg("kickoff-2026"),
    fotos: [
      { id: 1, src: galeriaImg("kickoff1"), legenda: "Abertura do ano" },
      { id: 2, src: galeriaImg("kickoff2"), legenda: "Planejamento estratégico" },
      { id: 3, src: galeriaImg("office2"), legenda: "Novo layout do escritório" },
    ]
  },
  {
    id: 5, evento: "Happy Hour Outubro", mes: "Out 2025",
    capa: galeriaImg("happyhour-out"),
    fotos: [
      { id: 1, src: galeriaImg("bar1"), legenda: "No terraço!" },
      { id: 2, src: galeriaImg("beer1"), legenda: "Merecido!" },
      { id: 3, src: galeriaImg("team2"), legenda: "Sexta-feira mood" },
    ]
  },
  {
    id: 6, evento: "Aniversário da Agência", mes: "Jul 2025",
    capa: galeriaImg("aniversario-pan"),
    fotos: [
      { id: 1, src: galeriaImg("bday1"), legenda: "8 anos de Pan! 🎂" },
      { id: 2, src: galeriaImg("bday2"), legenda: "Bolo comemorativo" },
      { id: 3, src: galeriaImg("bday3"), legenda: "Equipe toda presente" },
      { id: 4, src: galeriaImg("bday4"), legenda: "Discurso da diretora" },
      { id: 5, src: galeriaImg("celebrate1"), legenda: "Parabéns Pan!" },
      { id: 6, src: galeriaImg("celebrate2"), legenda: "Confraternização" },
      { id: 7, src: galeriaImg("team3"), legenda: "Foto histórica" },
    ]
  },
];

const MURAL_INIT = [
  { id: 1, colaborador: COLABORADORES[0], texto: "Pessoal, quem tiver interesse em participar do workshop de branding semana que vem, favor me mandar mensagem! Serão apenas 8 vagas.", hora: "08:42", data: "Hoje" },
  { id: 2, colaborador: COLABORADORES[4], texto: "Alguém sabe a senha do Wi-Fi novo do escritório? 😅", hora: "09:15", data: "Hoje" },
  { id: 3, colaborador: COLABORADORES[1], texto: "Brunopanwifi123 hahaha", hora: "09:17", data: "Hoje" },
  { id: 4, colaborador: COLABORADORES[8], texto: "Lembrem que amanhã temos reunião de alinhamento de contas às 14h! Confirmem presença 🙏", hora: "11:30", data: "Hoje" },
  { id: 5, colaborador: COLABORADORES[2], texto: "Entregando as artes do cliente Natura hoje à tarde. Pessoal de criação, qualquer dúvida me chamem!", hora: "13:45", data: "Ontem" },
];

// ── Date helpers (pt-BR) ──────────────────────────────────────────────────────
const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// ── Confetti engine ───────────────────────────────────────────────────────────
function useConfetti() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  const launch = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ["#11E7E7","#E8826A","#7BC47A","#E8B84B","#E84B7A","#C478E8","#fff","#5B8DEF"];
    for (let i = 0; i < 140; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 200,
        w: 6 + Math.random() * 8,
        h: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }
    let frame = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;
        p.vy += 0.05;
        if (frame > 80) p.opacity -= 0.012;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (frame < 160) animRef.current = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  }, []);

  return { canvasRef, launch };
}

// ── Helpers ────────────────────────────────────────────────────────────────
const Avatar = ({ col, size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    background: col?.cor || "#444",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.36, fontWeight: 700, color: "#0a1929",
    fontFamily: "'Syne', sans-serif", flexShrink: 0, letterSpacing: "-0.5px",
    transition: "transform 0.2s",
  }}>
    {col?.foto}
  </div>
);

const Badge = ({ cat }) => {
  const map = { Notícia: "#3B8EEA", Comunicado: "#E8955A", Evento: "#7EC47A" };
  return <span style={{ background: map[cat] || "#555", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", flexShrink: 0 }}>{cat}</span>;
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #152132; --surface: #1a2a3e; --surface2: #1f3149; --border: #243d57;
    --accent: #11E7E7; --accent2: #0dc4c4; --text: #E6EDF3; --muted: #7a9ab8;
    --danger: #FF6B6B; --success: #56D364; --sidebar-w: 240px;
  }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; line-height: 1.5; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* Date picker pt-BR feel */
  input[type="date"] { color-scheme: dark; }

  /* Sidebar */
  .sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: var(--sidebar-w); background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; z-index: 100; overflow-y: auto; transition: transform 0.3s; }
  .sidebar-logo { padding: 28px 24px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 36px; height: 36px; border-radius: 8px; background: var(--accent); display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 800; color: #0a1929; font-size: 18px; letter-spacing: -1px; flex-shrink: 0; transition: transform 0.3s; }
  .logo-mark:hover { transform: rotate(-5deg) scale(1.1); }
  .logo-text { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 17px; letter-spacing: -0.3px; }
  .logo-sub { font-size: 10px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
  .nav-section { padding: 16px 12px 8px; }
  .nav-label { font-size: 10px; color: var(--muted); letter-spacing: 2px; text-transform: uppercase; padding: 0 8px 8px; font-weight: 500; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 400; color: var(--muted); transition: all 0.18s cubic-bezier(.4,0,.2,1); margin-bottom: 2px; border: none; background: transparent; width: 100%; text-align: left; }
  .nav-item:hover { background: var(--surface2); color: var(--text); padding-left: 16px; }
  .nav-item.active { background: rgba(17,231,231,0.1); color: var(--accent); font-weight: 500; }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .sidebar-user { margin-top: auto; padding: 16px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; cursor: pointer; transition: background 0.15s; }
  .sidebar-user:hover { background: var(--surface2); }
  .user-info { flex: 1; min-width: 0; }
  .user-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .user-role { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Main */
  .main-wrap { margin-left: var(--sidebar-w); min-height: 100vh; }
  .topbar { position: sticky; top: 0; z-index: 50; background: rgba(21,33,50,0.9); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); padding: 0 32px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
  .page-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; }
  .content { padding: 28px 32px; max-width: 1200px; }

  /* Cards */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .card-header { padding: 18px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .card-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 14px; }
  .card-body { padding: 16px 20px; }

  /* Post cards */
  .post-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s; }
  .post-card:hover { border-color: var(--accent); transform: translateY(-3px); box-shadow: 0 8px 32px rgba(17,231,231,0.08); }
  .post-thumb { position: relative; overflow: hidden; height: 180px; background: var(--surface2); }
  .post-thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; display: block; }
  .post-card:hover .post-thumb img { transform: scale(1.04); }
  .post-body { padding: 16px; }
  .post-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .post-title { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 15px; line-height: 1.4; margin-bottom: 8px; cursor: pointer; transition: color 0.15s; }
  .post-title:hover { color: var(--accent); }
  .post-desc { font-size: 13px; color: var(--muted); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .post-footer { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--border); }
  .post-action { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--muted); cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; background: none; border: none; }
  .post-action:hover { background: var(--surface2); color: var(--text); }
  .post-action.liked { color: #E84B7A; }

  /* Upload zone */
  .upload-zone { border: 2px dashed var(--border); border-radius: 10px; padding: 28px; text-align: center; cursor: pointer; transition: all 0.2s; }
  .upload-zone:hover, .upload-zone.drag { border-color: var(--accent); background: rgba(17,231,231,0.04); }
  .upload-preview { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; display: block; }

  /* Collab card */
  .collab-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; transition: all 0.25s; cursor: pointer; }
  .collab-card:hover { border-color: var(--accent); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(17,231,231,0.07); }
  .collab-name { font-family: 'Syne', sans-serif; font-weight: 600; font-size: 14px; margin: 10px 0 4px; }
  .collab-cargo { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
  .collab-contact { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
  .contact-btn { font-size: 11px; color: var(--muted); border: 1px solid var(--border); border-radius: 20px; padding: 3px 10px; cursor: pointer; transition: all 0.15s; text-decoration: none; }
  .contact-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(17,231,231,0.05); }

  /* Aniversário */
  .aniv-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); transition: background 0.15s; }
  .aniv-item:last-child { border-bottom: none; }
  .aniv-item:hover { background: rgba(255,255,255,0.02); border-radius: 8px; padding-left: 4px; }
  .aniv-date { font-size: 12px; color: var(--muted); text-align: center; min-width: 36px; }
  .aniv-day { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 20px; color: var(--accent); line-height: 1; }
  .aniv-info { flex: 1; }
  .aniv-name { font-size: 14px; font-weight: 500; }
  .aniv-cargo { font-size: 12px; color: var(--muted); }
  .aniv-reactions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .like-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; font-size: 12px; cursor: pointer; transition: all 0.2s; color: var(--muted); display: flex; align-items: center; gap: 4px; }
  .like-btn:hover { transform: scale(1.05); }
  .like-btn.liked { background: rgba(17,231,231,0.1); border-color: var(--accent); color: var(--accent); }
  .like-btn:active { transform: scale(0.94); }

  /* Reactors tooltip */
  .reactors { font-size: 11px; color: var(--muted); max-width: 180px; line-height: 1.4; }

  /* Status */
  .status-chip { font-size: 11px; font-weight: 600; border-radius: 20px; padding: 3px 10px; }
  .status-andamento { background: rgba(86,211,100,0.15); color: var(--success); }
  .status-marcado { background: rgba(91,141,239,0.15); color: #5B8DEF; }

  /* Galeria */
  .galeria-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .galeria-card { border-radius: 12px; overflow: hidden; cursor: pointer; position: relative; aspect-ratio: 4/3; transition: transform 0.25s, box-shadow 0.25s; }
  .galeria-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
  .galeria-card img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s; }
  .galeria-card:hover img { transform: scale(1.06); }
  .galeria-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,25,41,0.9) 0%, transparent 50%); display: flex; flex-direction: column; justify-content: flex-end; padding: 14px; opacity: 0; transition: opacity 0.25s; }
  .galeria-card:hover .galeria-overlay { opacity: 1; }
  .galeria-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; color: #fff; }
  .galeria-sub { font-size: 11px; color: var(--accent); margin-top: 2px; }

  /* Lightbox */
  .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(8px); z-index: 900; display: flex; align-items: center; justify-content: center; }
  .lightbox-img { max-width: 80vw; max-height: 80vh; border-radius: 10px; display: block; object-fit: contain; animation: lbIn 0.25s ease; }
  @keyframes lbIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
  .lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 28px; padding: 12px 16px; cursor: pointer; border-radius: 8px; transition: background 0.15s; }
  .lightbox-nav:hover { background: rgba(255,255,255,0.2); }
  .lightbox-prev { left: 24px; }
  .lightbox-next { right: 24px; }
  .lightbox-close { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 22px; padding: 8px 14px; cursor: pointer; border-radius: 8px; transition: background 0.15s; }
  .lightbox-close:hover { background: rgba(255,255,255,0.2); }
  .lightbox-caption { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.7); font-size: 13px; }
  .lightbox-strip { position: absolute; bottom: 0; left: 0; right: 0; display: flex; gap: 6px; padding: 12px; overflow-x: auto; background: rgba(0,0,0,0.5); justify-content: center; }
  .lightbox-thumb { width: 56px; height: 42px; border-radius: 5px; object-fit: cover; cursor: pointer; opacity: 0.5; border: 2px solid transparent; transition: all 0.15s; flex-shrink: 0; }
  .lightbox-thumb.active { opacity: 1; border-color: var(--accent); }

  /* Mural */
  .mural-msg { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--border); animation: fadeUp 0.3s ease; }
  .mural-msg:last-child { border-bottom: none; }
  .mural-content { flex: 1; }
  .mural-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .mural-name { font-size: 13px; font-weight: 600; }
  .mural-time { font-size: 11px; color: var(--muted); }
  .mural-text { font-size: 13px; color: var(--text); line-height: 1.5; }
  .mural-input { display: flex; gap: 8px; padding-top: 12px; }
  .input-field { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
  .input-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(17,231,231,0.08); }
  .btn-primary { background: var(--accent); color: #0a1929; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 13px; transition: all 0.18s; white-space: nowrap; }
  .btn-primary:hover { background: #0dc4c4; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(17,231,231,0.25); }
  .btn-primary:active { transform: scale(0.97); }
  .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
  .btn-ghost:hover { border-color: var(--text); color: var(--text); }

  /* Grids */
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .dash-layout { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
  .dash-aside { display: flex; flex-direction: column; gap: 16px; }

  /* Filters */
  .filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .filter-tab { padding: 6px 14px; border-radius: 20px; font-size: 13px; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--muted); transition: all 0.15s; }
  .filter-tab:hover { border-color: var(--text); color: var(--text); }
  .filter-tab.active { background: var(--accent); border-color: var(--accent); color: #0a1929; font-weight: 600; }

  /* Login */
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); position: relative; overflow: hidden; }
  .login-bg { position: absolute; inset: 0; background: radial-gradient(ellipse at 60% 20%, rgba(17,231,231,0.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(17,231,231,0.04) 0%, transparent 50%); }
  .login-card { position: relative; width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 40px; animation: fadeUp 0.4s ease; }
  .login-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
  .login-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .login-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }
  .form-group { margin-bottom: 16px; }
  .form-label { font-size: 12px; color: var(--muted); letter-spacing: 0.5px; margin-bottom: 6px; display: block; font-weight: 500; }
  .form-input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 11px 14px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
  .form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(17,231,231,0.08); }
  .btn-full { width: 100%; padding: 12px; font-size: 15px; border-radius: 8px; }
  .login-domain { font-size: 11px; color: var(--muted); text-align: center; margin-top: 16px; }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; animation: overlayIn 0.2s ease; }
  @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; animation: modalIn 0.25s cubic-bezier(.4,0,.2,1); }
  @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .modal-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 20px; line-height: 1; transition: color 0.15s, transform 0.15s; }
  .modal-close:hover { color: var(--text); transform: rotate(90deg); }
  .modal-body { padding: 24px; }

  /* Misc */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .section-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 20px; }
  .section-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .empty-state { text-align: center; padding: 40px; color: var(--muted); font-size: 14px; }
  .dot-online { width: 8px; height: 8px; border-radius: 50%; background: var(--success); display: inline-block; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(86,211,100,0.4); } 50% { box-shadow:0 0 0 5px rgba(86,211,100,0); } }
  .search-input { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 7px 14px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; width: 220px; transition: all 0.2s; }
  .search-input:focus { border-color: var(--accent); width: 280px; box-shadow: 0 0 0 3px rgba(17,231,231,0.07); }
  .search-input::placeholder { color: var(--muted); }
  .today-badge { background: var(--accent); color: #0a1929; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 1px 6px; letter-spacing: 0.5px; }
  .pagination { display: flex; gap: 6px; align-items: center; padding-top: 16px; }
  .page-btn { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; font-size: 13px; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
  .page-btn:hover { border-color: var(--text); color: var(--text); }
  .page-btn.active { background: var(--accent); border-color: var(--accent); color: #0a1929; font-weight: 700; }
  .comment { display: flex; gap: 8px; margin-bottom: 12px; animation: fadeUp 0.25s ease; }
  .comment-body { background: var(--surface2); border-radius: 8px; padding: 10px 12px; flex: 1; }
  .comment-author { font-size: 12px; font-weight: 600; margin-bottom: 3px; }
  .comment-text { font-size: 13px; color: var(--text); }
  .comment-time { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .profile-hero { padding: 32px 24px; display: flex; align-items: center; gap: 20px; border-bottom: 1px solid var(--border); }
  .profile-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 22px; }
  .profile-cargo { color: var(--muted); font-size: 14px; margin-top: 4px; }
  .profile-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
  .profile-row:last-child { border-bottom: none; }
  .profile-icon { width: 20px; text-align: center; font-size: 16px; }
  .profile-val { color: var(--muted); }

  /* Animations */
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.35s ease forwards; }
  .stagger > * { opacity: 0; animation: fadeUp 0.35s ease forwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.04s; }
  .stagger > *:nth-child(2) { animation-delay: 0.08s; }
  .stagger > *:nth-child(3) { animation-delay: 0.12s; }
  .stagger > *:nth-child(4) { animation-delay: 0.16s; }
  .stagger > *:nth-child(5) { animation-delay: 0.20s; }
  .stagger > *:nth-child(6) { animation-delay: 0.24s; }
  .stagger > *:nth-child(n+7) { animation-delay: 0.28s; }

  @keyframes heartPop { 0% { transform:scale(1); } 40% { transform:scale(1.45); } 70% { transform:scale(0.88); } 100% { transform:scale(1); } }
  .heart-pop { animation: heartPop 0.4s cubic-bezier(.4,0,.2,1); }

  /* Confetti canvas */
  .confetti-canvas { position: fixed; inset: 0; pointer-events: none; z-index: 999; }

  /* Topbar bg fix */
  .topbar { background: rgba(21,33,50,0.92); }

  /* Responsive */
  @media (max-width: 900px) {
    .sidebar { transform: translateX(-100%); }
    .main-wrap { margin-left: 0; }
    .dash-layout { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: repeat(2, 1fr); }
    .grid-4 { grid-template-columns: repeat(2, 1fr); }
    .galeria-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .content { padding: 20px 16px; }
    .grid-3, .grid-4, .grid-2 { grid-template-columns: 1fr; }
    .galeria-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (!email.endsWith("@agenciapan.com")) { setError("Use seu e-mail corporativo @agenciapan.com"); return; }
    if (pass.length < 4) { setError("Senha inválida."); return; }
    setLoading(true);
    setTimeout(onLogin, 800);
  };

  return (
    <div className="login-wrap">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-mark">P</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20 }}>Panet</div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Intranet da Pan</div>
          </div>
        </div>
        <div className="login-title">Bem-vindo de volta</div>
        <div className="login-sub">Acesse com sua conta corporativa para continuar.</div>
        <div className="form-group">
          <label className="form-label">E-MAIL CORPORATIVO</label>
          <input className="form-input" type="email" placeholder="seu.nome@agenciapan.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </div>
        <div className="form-group">
          <label className="form-label">SENHA</label>
          <input className="form-input" type="password" placeholder="••••••••" value={pass} onChange={e => { setPass(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12, marginTop: -4 }}>{error}</div>}
        <button className="btn-primary btn-full" onClick={handleLogin} disabled={loading}>
          {loading ? "Entrando..." : "Entrar na Panet"}
        </button>
        <div className="login-domain">Acesso exclusivo para colaboradores @agenciapan.com</div>
      </div>
    </div>
  );
}

// ── PRIMEIRO ACESSO ───────────────────────────────────────────────────────────
function PrimeiroAcessoPage({ onConcluir }) {
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const forca = nova.length === 0 ? 0 : nova.length < 4 ? 1 : nova.length < 6 ? 2 : nova.length < 8 ? 3 : 4;
  const forcaLabel = ["","Muito fraca","Fraca","Razoável","Boa força ✓"];
  const forcaCor = ["","#FF6B6B","#E8B84B","#E8955A","var(--accent)"];

  const salvar = () => {
    if (nova.length < 8) { setErro("A senha deve ter ao menos 8 caracteres."); return; }
    if (nova !== confirma) { setErro("As senhas não coincidem."); return; }
    setOk(true);
    setTimeout(onConcluir, 1400);
  };

  return (
    <div className="login-wrap">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-mark">P</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20 }}>Panet</div>
            <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Intranet da Pan</div>
          </div>
        </div>
        <div style={{ background: "rgba(17,231,231,0.08)", border: "1px solid rgba(17,231,231,0.2)", borderRadius: 8, padding: "12px 14px", marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>🔐</span>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Primeiro acesso detectado</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>Por segurança, você precisa cadastrar uma nova senha antes de continuar.</div>
          </div>
        </div>
        <div className="login-title" style={{ fontSize: 18 }}>Crie sua nova senha</div>
        <div className="login-sub">Ela substituirá a senha temporária enviada pelo administrador.</div>
        <div className="form-group">
          <label className="form-label">NOVA SENHA</label>
          <input className="form-input" type="password" placeholder="Mínimo 8 caracteres" value={nova} onChange={e => { setNova(e.target.value); setErro(""); }} />
        </div>
        {nova.length > 0 && (
          <div style={{ marginBottom: 14, marginTop: -8 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: forca >= i ? forcaCor[forca] : "var(--border)", transition: "background 0.3s" }} />)}
            </div>
            <div style={{ fontSize: 11, color: forcaCor[forca], transition: "color 0.3s" }}>{forcaLabel[forca]}</div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">CONFIRMAR SENHA</label>
          <input className="form-input" type="password" placeholder="Repita a nova senha" value={confirma} onChange={e => { setConfirma(e.target.value); setErro(""); }} onKeyDown={e => e.key === "Enter" && salvar()} />
        </div>
        {erro && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{erro}</div>}
        {ok ? (
          <div style={{ background: "rgba(86,211,100,0.1)", border: "1px solid rgba(86,211,100,0.3)", borderRadius: 8, padding: "12px 14px", textAlign: "center", color: "var(--success)", fontWeight: 600, fontSize: 14 }}>✓ Senha criada! Redirecionando...</div>
        ) : (
          <button className="btn-primary btn-full" onClick={salvar}>Salvar e entrar na Panet</button>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardPage({ onOpenPost, postagens, aniversariantes, ferias, dayoff }) {
  const [curtidas, setCurtidas] = useState({});
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 5;
  const totalPags = Math.ceil(postagens.length / POR_PAGINA);
  const postsPag = postagens.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const today = aniversariantes.find(a => a.diasRestantes === 0);
  const proximos = aniversariantes.filter(a => a.diasRestantes > 0).slice(0, 3);

  return (
    <div className="fade-up">
      {today && (
        <div style={{ background: "linear-gradient(135deg, rgba(17,231,231,0.12), rgba(17,231,231,0.05))", border: "1px solid rgba(17,231,231,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, animation: "fadeUp 0.4s ease" }}>
          <span style={{ fontSize: 32 }}>🎂</span>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>Hoje é aniversário de <span style={{ color: "var(--accent)" }}>{today.colaborador.nome.split(" ")[0]}</span>!</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{today.colaborador.cargo} — Parabenize hoje! 🎉</div>
          </div>
          <button className="btn-primary" style={{ marginLeft: "auto" }}>❤️ Reagir</button>
        </div>
      )}
      <div className="dash-layout">
        <div>
          <div className="section-header">
            <div>
              <div className="section-title">Feed da Pan</div>
              <div className="section-sub">Últimas notícias, comunicados e eventos</div>
            </div>
          </div>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {postsPag.map(post => (
              <div key={post.id} className="post-card">
                <div className="post-thumb">
                  <img src={post.imagem} alt={post.titulo} />
                </div>
                <div className="post-body">
                  <div className="post-meta">
                    <Badge cat={post.categoria} />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(post.data)}</span>
                  </div>
                  <div className="post-title" onClick={() => onOpenPost(post)}>{post.titulo}</div>
                  <div className="post-desc">{post.descricao}</div>
                </div>
                <div className="post-footer">
                  <button className={`post-action ${curtidas[post.id] ? "liked" : ""}`} onClick={() => setCurtidas(p => ({ ...p, [post.id]: !p[post.id] }))}>
                    {curtidas[post.id] ? "❤️" : "🤍"} {post.curtidas.length + (curtidas[post.id] ? 1 : 0)}
                  </button>
                  <button className="post-action" onClick={() => onOpenPost(post)}>💬 {post.comentarios.length}</button>
                  <button className="post-action" onClick={() => onOpenPost(post)} style={{ marginLeft: "auto" }}>Ver mais →</button>
                </div>
              </div>
            ))}
          </div>
          {totalPags > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>‹</button>
              {Array.from({ length: totalPags }, (_, i) => (
                <button key={i} className={`page-btn ${pagina === i + 1 ? "active" : ""}`} onClick={() => setPagina(i + 1)}>{i + 1}</button>
              ))}
              <button className="page-btn" onClick={() => setPagina(p => Math.min(totalPags, p + 1))} disabled={pagina === totalPags}>›</button>
            </div>
          )}
        </div>
        <div className="dash-aside">
          <div className="card">
            <div className="card-header"><span className="card-title">🎂 Aniversários</span></div>
            <div className="card-body" style={{ padding: "8px 16px" }}>
              {today && (
                <div className="aniv-item">
                  <div className="aniv-date"><div className="aniv-day">🎉</div></div>
                  <Avatar col={today.colaborador} size={36} />
                  <div className="aniv-info">
                    <div className="aniv-name">{today.colaborador.nome.split(" ")[0]}</div>
                    <span className="today-badge">HOJE</span>
                  </div>
                </div>
              )}
              {proximos.map(a => (
                <div key={a.colaborador.id} className="aniv-item">
                  <div className="aniv-date">
                    <div className="aniv-day">{a.data.split("/")[0]}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>/{a.data.split("/")[1]}</div>
                  </div>
                  <Avatar col={a.colaborador} size={36} />
                  <div className="aniv-info">
                    <div className="aniv-name">{a.colaborador.nome.split(" ")[0]}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>em {a.diasRestantes} dias</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">✈️ Férias & Day Off</span></div>
            <div className="card-body" style={{ padding: "8px 16px" }}>
              {ferias.slice(0, 2).map(f => (
                <div key={f.colaborador.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <Avatar col={f.colaborador} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.colaborador.nome.split(" ")[0]}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.inicio} → {f.fim}</div>
                  </div>
                  <span className={`status-chip ${f.status === "em_andamento" ? "status-andamento" : "status-marcado"}`}>{f.status === "em_andamento" ? "Férias" : "Marcado"}</span>
                </div>
              ))}
              {dayoff.map(d => (
                <div key={d.colaborador.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <Avatar col={d.colaborador} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{d.colaborador.nome.split(" ")[0]}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Day Off · {d.inicio}</div>
                  </div>
                  <span className="status-chip" style={{ background: "rgba(232,75,122,0.15)", color: "#E84B7A" }}>Day Off</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── POSTAGENS ─────────────────────────────────────────────────────────────────
function PostagensPage({ onOpen, postagens }) {
  const [filtro, setFiltro] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [curtidas, setCurtidas] = useState({});
  const cats = ["Todos", "Notícia", "Comunicado", "Evento"];
  const filtradas = postagens.filter(p =>
    (filtro === "Todos" || p.categoria === filtro) &&
    (busca === "" || p.titulo.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="fade-up">
      <div className="section-header">
        <div><div className="section-title">Postagens</div><div className="section-sub">{postagens.length} publicações</div></div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div className="filter-tabs">
          {cats.map(c => <button key={c} className={`filter-tab ${filtro === c ? "active" : ""}`} onClick={() => setFiltro(c)}>{c}</button>)}
        </div>
        <input className="search-input" placeholder="Buscar postagem..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 200 }} />
      </div>
      <div className="grid-3 stagger">
        {filtradas.map(post => (
          <div key={post.id} className="post-card">
            <div className="post-thumb"><img src={post.imagem} alt={post.titulo} /></div>
            <div className="post-body">
              <div className="post-meta">
                <Badge cat={post.categoria} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(post.data)}</span>
              </div>
              <div className="post-title" onClick={() => onOpen(post)}>{post.titulo}</div>
              <div className="post-desc">{post.descricao}</div>
            </div>
            <div className="post-footer">
              <button className={`post-action ${curtidas[post.id] ? "liked" : ""}`} onClick={() => setCurtidas(p => ({ ...p, [post.id]: !p[post.id] }))}>
                {curtidas[post.id] ? "❤️" : "🤍"} {post.curtidas.length + (curtidas[post.id] ? 1 : 0)}
              </button>
              <button className="post-action" onClick={() => onOpen(post)}>💬 {post.comentarios.length}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── COLABORADORES ─────────────────────────────────────────────────────────────
function ColaboradoresPage() {
  const [selected, setSelected] = useState(null);
  return (
    <div className="fade-up">
      <div className="section-header">
        <div><div className="section-title">Colaboradores</div><div className="section-sub">{COLABORADORES.length} pessoas no time</div></div>
      </div>
      <div className="grid-4 stagger">
        {COLABORADORES.map(col => (
          <div key={col.id} className="collab-card" onClick={() => setSelected(col)}>
            <div style={{ display: "flex", justifyContent: "center" }}><Avatar col={col} size={64} /></div>
            {col.isMe && <div style={{ fontSize: 10, color: "var(--accent)", textAlign: "center", marginTop: 4, fontWeight: 600 }}>VOCÊ</div>}
            <div className="collab-name">{col.nome}</div>
            <div className="collab-cargo">{col.cargo}</div>
            <div className="collab-contact">
              <a href={`mailto:${col.email}`} className="contact-btn" onClick={e => e.stopPropagation()}>✉️ E-mail</a>
              {col.redes?.instagram && <span className="contact-btn">📷</span>}
              {col.redes?.linkedin && <span className="contact-btn">in</span>}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="profile-hero">
              <Avatar col={selected} size={72} />
              <div>
                <div className="profile-name">{selected.nome}</div>
                <div className="profile-cargo">{selected.cargo}</div>
                {selected.isMe && <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, marginTop: 4, display: "block" }}>★ Você</span>}
              </div>
            </div>
            <div style={{ padding: "16px 24px" }}>
              <div className="profile-row"><span className="profile-icon">✉️</span><span className="profile-val">{selected.email}</span></div>
              <div className="profile-row"><span className="profile-icon">📞</span><span className="profile-val">{selected.telefone}</span></div>
              {selected.redes?.instagram && <div className="profile-row"><span className="profile-icon">📷</span><span className="profile-val">@{selected.redes.instagram}</span></div>}
              {selected.redes?.linkedin && <div className="profile-row"><span className="profile-icon">in</span><span className="profile-val">{selected.redes.linkedin}</span></div>}
              {selected.redes?.github && <div className="profile-row"><span className="profile-icon">🐙</span><span className="profile-val">{selected.redes.github}</span></div>}
            </div>
            <div style={{ padding: "0 24px 20px" }}><button className="btn-ghost btn-full" onClick={() => setSelected(null)}>Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ANIVERSÁRIOS ──────────────────────────────────────────────────────────────
function AniversariosPage({ aniversariantes, setAniversariantes }) {
  const { canvasRef, launch } = useConfetti();
  const [heartAnim, setHeartAnim] = useState({});
  const eu = COLABORADORES.find(c => c.isMe);

  const toggleReacao = (index) => {
    const jaReagiu = aniversariantes[index].reacoes.includes(eu.id);
    setAniversariantes(prev => prev.map((a, i) => {
      if (i !== index) return a;
      return {
        ...a,
        reacoes: jaReagiu
          ? a.reacoes.filter(id => id !== eu.id)
          : [...a.reacoes, eu.id]
      };
    }));
    if (!jaReagiu) {
      launch();
      setHeartAnim(p => ({ ...p, [index]: true }));
      setTimeout(() => setHeartAnim(p => ({ ...p, [index]: false })), 500);
    }
  };

  const getNomes = (reacoes) => {
    const cols = reacoes.map(id => COLABORADORES.find(c => c.id === id)).filter(Boolean);
    if (cols.length === 0) return null;
    if (cols.length <= 3) return cols.map(c => c.nome.split(" ")[0]).join(", ");
    return `${cols.slice(0, 2).map(c => c.nome.split(" ")[0]).join(", ")} e mais ${cols.length - 2}`;
  };

  const today = aniversariantes.filter(a => a.diasRestantes === 0);
  const mes = aniversariantes.filter(a => a.diasRestantes > 0 && a.diasRestantes <= 30);
  const proximos = aniversariantes.filter(a => a.diasRestantes > 30);

  const AnivCard = ({ a, index }) => {
    const reagiu = a.reacoes.includes(eu.id);
    const nomes = getNomes(a.reacoes);
    return (
      <div className="aniv-item">
        <div className="aniv-date">
          {a.diasRestantes === 0
            ? <div style={{ fontSize: 22 }}>🎉</div>
            : <><div className="aniv-day">{a.data.split("/")[0]}</div><div style={{ fontSize: 10, color: "var(--muted)" }}>/{a.data.split("/")[1]}</div></>
          }
        </div>
        <Avatar col={a.colaborador} size={40} />
        <div className="aniv-info">
          <div className="aniv-name">{a.colaborador.nome}</div>
          <div className="aniv-cargo">
            {a.diasRestantes === 0
              ? <span className="today-badge">HOJE</span>
              : <span style={{ fontSize: 11, color: "var(--muted)" }}>em {a.diasRestantes} dias</span>}
          </div>
          {nomes && <div className="reactors" style={{ marginTop: 3 }}>❤️ {nomes}</div>}
        </div>
        <div className="aniv-reactions">
          <button
            className={`like-btn ${reagiu ? "liked" : ""} ${heartAnim[index] ? "heart-pop" : ""}`}
            onClick={() => toggleReacao(index)}
            title={reagiu ? "Remover reação" : "Reagir com like"}
          >
            {reagiu ? "❤️" : "🤍"} {a.reacoes.length}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-up">
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div className="section-title" style={{ marginBottom: 20 }}>🎂 Aniversários</div>

      {today.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">🎉 Hoje</span></div>
          <div className="card-body" style={{ padding: "8px 16px" }}>
            {today.map((a, i) => <AnivCard key={i} a={a} index={aniversariantes.indexOf(a)} />)}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">📅 Este mês</span></div>
          <div className="card-body" style={{ padding: "8px 16px" }}>
            {mes.length === 0 ? <div className="empty-state" style={{ padding: 20 }}>Nenhum este mês</div>
              : mes.map((a, i) => <AnivCard key={i} a={a} index={aniversariantes.indexOf(a)} />)}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🗓️ Próximos</span></div>
          <div className="card-body" style={{ padding: "8px 16px" }}>
            {proximos.map((a, i) => <AnivCard key={i} a={a} index={aniversariantes.indexOf(a)} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FÉRIAS & DAY OFF ──────────────────────────────────────────────────────────
function FeriasPage({ ferias, dayoff }) {
  return (
    <div className="fade-up">
      <div className="section-title" style={{ marginBottom: 20 }}>✈️ Férias & Day Off</div>
      <div className="grid-2">
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Férias</div>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ferias.map((f, i) => (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar col={f.colaborador} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.colaborador.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{f.colaborador.cargo}</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>📅 {f.inicio} → {f.fim}</div>
                  </div>
                  <span className={`status-chip ${f.status === "em_andamento" ? "status-andamento" : "status-marcado"}`}>{f.status === "em_andamento" ? "Em andamento" : "Marcado"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Day Off</div>
          <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayoff.map((d, i) => (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar col={d.colaborador} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.colaborador.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.colaborador.cargo}</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>📅 {d.inicio}</div>
                  </div>
                  <span className="status-chip" style={{ background: "rgba(232,75,122,0.15)", color: "#E84B7A" }}>Day Off</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GALERIA ───────────────────────────────────────────────────────────────────
function GaleriaPage() {
  const [eventoAberto, setEventoAberto] = useState(null);
  const [fotoIdx, setFotoIdx] = useState(0);

  const abrirEvento = (evento) => { setEventoAberto(evento); setFotoIdx(0); };
  const fechar = useCallback(() => setEventoAberto(null), []);
  const prev = useCallback(() => {
    if (!eventoAberto) return;
    setFotoIdx((i) => (i - 1 + eventoAberto.fotos.length) % eventoAberto.fotos.length);
  }, [eventoAberto]);
  const next = useCallback(() => {
    if (!eventoAberto) return;
    setFotoIdx((i) => (i + 1) % eventoAberto.fotos.length);
  }, [eventoAberto]);

  useEffect(() => {
    if (!eventoAberto) return;
    const handler = (e) => { if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next(); if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [eventoAberto, fechar, next, prev]);

  return (
    <div className="fade-up">
      <div className="section-header">
        <div><div className="section-title">📸 Galeria de Eventos</div><div className="section-sub">Momentos da Pan</div></div>
      </div>
      <div className="galeria-grid stagger">
        {GALERIA_EVENTOS.map(g => (
          <div key={g.id} className="galeria-card" onClick={() => abrirEvento(g)}>
            <img src={g.capa} alt={g.evento} />
            <div className="galeria-overlay">
              <div className="galeria-title">{g.evento}</div>
              <div className="galeria-sub">{g.mes} · {g.fotos.length} fotos</div>
            </div>
          </div>
        ))}
      </div>

      {eventoAberto && (
        <div className="lightbox" onClick={fechar}>
          <button className="lightbox-close" onClick={fechar}>✕</button>
          <button className="lightbox-prev lightbox-nav" onClick={e => { e.stopPropagation(); prev(); }}>‹</button>
          <img
            key={fotoIdx}
            className="lightbox-img"
            src={eventoAberto.fotos[fotoIdx].src}
            alt={eventoAberto.fotos[fotoIdx].legenda}
            onClick={e => e.stopPropagation()}
          />
          <button className="lightbox-next lightbox-nav" onClick={e => { e.stopPropagation(); next(); }}>›</button>
          <div className="lightbox-caption">{eventoAberto.fotos[fotoIdx].legenda} — {fotoIdx + 1}/{eventoAberto.fotos.length}</div>
          <div className="lightbox-strip" onClick={e => e.stopPropagation()}>
            {eventoAberto.fotos.map((f, i) => (
              <img key={i} src={f.src} className={`lightbox-thumb ${i === fotoIdx ? "active" : ""}`} onClick={() => setFotoIdx(i)} alt="" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MURAL ─────────────────────────────────────────────────────────────────────
function MuralPage() {
  const [msgs, setMsgs] = useState(MURAL_INIT);
  const [texto, setTexto] = useState("");
  const eu = COLABORADORES.find(c => c.isMe);

  const enviar = () => {
    if (!texto.trim()) return;
    setMsgs(p => [{ id: Date.now(), colaborador: eu, texto, hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), data: "Agora" }, ...p]);
    setTexto("");
  };

  return (
    <div className="fade-up">
      <div className="section-header">
        <div><div className="section-title">💬 Mural da Pan</div><div className="section-sub">Mensagens internas do time</div></div>
      </div>
      <div className="card" style={{ maxWidth: 700 }}>
        <div className="card-body">
          <div className="mural-input" style={{ marginBottom: 16 }}>
            <Avatar col={eu} size={36} />
            <input className="input-field" placeholder="Escreva uma mensagem para o time..." value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === "Enter" && enviar()} />
            <button className="btn-primary" onClick={enviar}>Enviar</button>
          </div>
          {msgs.map(m => (
            <div key={m.id} className="mural-msg">
              <Avatar col={m.colaborador} size={36} />
              <div className="mural-content">
                <div className="mural-header">
                  <span className="mural-name">{m.colaborador.nome}</span>
                  <span className="mural-time">{m.data} · {m.hora}</span>
                </div>
                <div className="mural-text">{m.texto}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PERFIL ────────────────────────────────────────────────────────────────────
function PerfilPage() {
  const eu = COLABORADORES.find(c => c.isMe);
  const [form, setForm] = useState({ nome: eu.nome, cargo: eu.cargo, telefone: eu.telefone, instagram: eu.redes?.instagram || "", linkedin: eu.redes?.linkedin || "" });
  const [saved, setSaved] = useState(false);
  const salvar = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="fade-up" style={{ maxWidth: 560 }}>
      <div className="section-title" style={{ marginBottom: 20 }}>👤 Meu Perfil</div>
      <div className="card">
        <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 16, borderBottom: "1px solid var(--border)" }}>
          <Avatar col={eu} size={72} />
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20 }}>{eu.nome}</div>
            <div style={{ color: "var(--muted)", fontSize: 14 }}>{eu.cargo}</div>
            <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4 }}>{eu.email}</div>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          {[["Nome", "nome"], ["Cargo", "cargo"], ["Telefone", "telefone"], ["Instagram", "instagram"], ["LinkedIn", "linkedin"]].map(([label, key]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label.toUpperCase()}</label>
              <input className="form-input" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <button className="btn-primary" onClick={salvar}>{saved ? "✓ Salvo!" : "Salvar alterações"}</button>
        </div>
      </div>
    </div>
  );
}

// ── POST MODAL ────────────────────────────────────────────────────────────────
function PostModal({ post, onClose }) {
  const [curtido, setCurtido] = useState(false);
  const [comentarios, setComentarios] = useState(post.comentarios);
  const [texto, setTexto] = useState("");
  const eu = COLABORADORES.find(c => c.isMe);

  const comentar = () => {
    if (!texto.trim()) return;
    setComentarios(p => [...p, { autor: eu, texto, hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) }]);
    setTexto("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{ height: 220, overflow: "hidden", borderRadius: "16px 16px 0 0" }}>
          <img src={post.imagem} alt={post.titulo} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}><Badge cat={post.categoria} /></div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18 }}>{post.titulo}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{fmtDate(post.data)}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>{post.descricao}</p>
          <div style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
            <button className={`post-action ${curtido ? "liked" : ""}`} onClick={() => setCurtido(p => !p)}>
              {curtido ? "❤️" : "🤍"} {post.curtidas.length + (curtido ? 1 : 0)} curtidas
            </button>
            <button className="post-action">💬 {comentarios.length} comentários</button>
          </div>
          <div style={{ marginBottom: 16 }}>
            {comentarios.map((c, i) => (
              <div key={i} className="comment">
                <Avatar col={c.autor} size={32} />
                <div className="comment-body">
                  <div className="comment-author">{c.autor.nome}</div>
                  <div className="comment-text">{c.texto}</div>
                  <div className="comment-time">{c.hora}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mural-input">
            <Avatar col={eu} size={32} />
            <input className="input-field" placeholder="Escreva um comentário..." value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === "Enter" && comentar()} />
            <button className="btn-primary" onClick={comentar}>→</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
// Image upload component
function ImageUpload({ value, onChange }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`upload-zone ${drag ? "drag" : ""}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      {value
        ? <img src={value} alt="preview" className="upload-preview" />
        : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
            <div style={{ fontSize: 14, color: "var(--muted)" }}>Clique ou arraste uma imagem</div>
            <div style={{ fontSize: 12, color: "var(--border)", marginTop: 4 }}>JPG, PNG, WebP · recomendado 9:16</div>
          </div>
        )
      }
    </div>
  );
}

function AdminPage({ postagens, setPostagens, ferias, setFerias, dayoff, setDayoff, aniversariantes, setAniversariantes }) {
  const [aba, setAba] = useState("colaboradores");
  const ABAS = [
    { id: "colaboradores", label: "Colaboradores", icon: "👥" },
    { id: "postagens", label: "Postagens", icon: "📄" },
    { id: "ferias", label: "Férias & Day Off", icon: "✈️" },
    { id: "aniversarios", label: "Aniversários", icon: "🎂" },
  ];

  return (
    <div className="fade-up">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div><div className="section-title">⚙️ Painel Admin</div><div className="section-sub">Gestão de conteúdo e colaboradores da Panet</div></div>
        <div style={{ background: "rgba(17,231,231,0.1)", border: "1px solid rgba(17,231,231,0.2)", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Administrador</div>
      </div>
      <div className="filter-tabs" style={{ marginBottom: 24 }}>
        {ABAS.map(a => <button key={a.id} className={`filter-tab ${aba === a.id ? "active" : ""}`} onClick={() => setAba(a.id)}>{a.icon} {a.label}</button>)}
      </div>
      {aba === "colaboradores" && <AdminColaboradores />}
      {aba === "postagens" && <AdminPostagens postagens={postagens} setPostagens={setPostagens} />}
      {aba === "ferias" && <AdminFerias ferias={ferias} setFerias={setFerias} dayoff={dayoff} setDayoff={setDayoff} />}
      {aba === "aniversarios" && <AdminAniversarios aniversariantes={aniversariantes} setAniversariantes={setAniversariantes} />}
    </div>
  );
}

function AdminColaboradores() {
  const [lista, setLista] = useState(COLABORADORES);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const CARGOS = ["Diretor(a) de Criação","Gerente de Projetos","Designer UX/UI","Desenvolvedor Full Stack","Social Media","Gestor de Tráfego","Redator(a) Criativo(a)","Fotógrafo(a)","Executivo(a) de Contas","Tech Lead","Estagiário(a)"];
  const CORES = ["#E8826A","#5B8DEF","#7BC47A","#C478E8","#E8B84B","#4BCFE8","#E84B7A","#8DE8A0","#E88B4B","#11E7E7"];

  const abrirNovo = () => { setForm({ nome: "", cargo: "", email: "", telefone: "", cor: CORES[Math.floor(Math.random() * CORES.length)], primeiroacesso: true }); setModal("novo"); };
  const abrirEditar = (col) => { setForm({ ...col }); setModal(col); };
  const salvar = () => {
    if (!form.nome || !form.email) return;
    const iniciais = form.nome.split(" ").filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    if (modal === "novo") setLista(p => [...p, { ...form, id: Date.now(), foto: iniciais, redes: {} }]);
    else setLista(p => p.map(c => c.id === form.id ? { ...form, foto: iniciais } : c));
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn-primary" onClick={abrirNovo}>+ Novo colaborador</button>
      </div>
      <div className="card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Colaborador","Cargo","E-mail","Status","Ações"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(col => (
              <tr key={col.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar col={col} size={32} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{col.nome}</div>
                      {col.isMe && <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>VOCÊ</span>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{col.cargo}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{col.email}</td>
                <td style={{ padding: "12px 16px" }}>
                  {col.primeiroacesso ? <span className="status-chip" style={{ background: "rgba(232,149,90,0.15)", color: "#E8955A" }}>Primeiro acesso</span> : <span className="status-chip status-andamento">Ativo</span>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => abrirEditar(col)}>Editar</button>
                    {!col.isMe && <button onClick={() => setConfirmarExcluir(col)} style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "var(--danger)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Excluir</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17 }}>{modal === "novo" ? "Novo colaborador" : "Editar colaborador"}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group"><label className="form-label">NOME COMPLETO *</label><input className="form-input" value={form.nome || ""} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Ana Paula Ferreira" /></div>
                <div className="form-group"><label className="form-label">CARGO *</label><select className="form-input" value={form.cargo || ""} onChange={e => setForm(p => ({ ...p, cargo: e.target.value }))}><option value="">Selecione...</option>{CARGOS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="form-group"><label className="form-label">E-MAIL CORPORATIVO *</label><input className="form-input" value={form.email || ""} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="nome@agenciapan.com" /></div>
                <div className="form-group"><label className="form-label">TELEFONE</label><input className="form-input" value={form.telefone || ""} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(84) 99999-9999" /></div>
              </div>
              {modal === "novo" && (
                <div className="form-group">
                  <label className="form-label">SENHA TEMPORÁRIA *</label>
                  <input className="form-input" type="text" defaultValue="Pan@2026" />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>O colaborador será obrigado a trocar no primeiro acesso.</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={salvar}>{modal === "novo" ? "Cadastrar" : "Salvar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir && (
        <div className="modal-overlay" onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Excluir colaborador?</div>
              <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}><strong>{confirmarExcluir.nome}</strong> será removido(a) da Panet.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>Cancelar</button>
                <button onClick={() => { setLista(p => p.filter(c => c.id !== confirmarExcluir.id)); setConfirmarExcluir(null); }} style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPostagens({ postagens, setPostagens }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const CATS = ["Notícia", "Comunicado", "Evento"];

  const abrirNovo = () => { setForm({ titulo: "", categoria: "Notícia", data: new Date().toISOString().split("T")[0], descricao: "", imagem: postImg("nova-postagem"), curtidas: [], comentarios: [] }); setModal("novo"); };
  const abrirEditar = (post) => { setForm({ ...post }); setModal(post); };
  const salvar = () => {
    if (!form.titulo || !form.descricao) return;
    if (modal === "novo") setPostagens(p => [{ ...form, id: Date.now() }, ...p]);
    else setPostagens(p => p.map(x => x.id === form.id ? form : x));
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn-primary" onClick={abrirNovo}>+ Nova postagem</button>
      </div>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {postagens.map(post => (
          <div key={post.id} className="card" style={{ padding: 16, transition: "border-color 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={post.imagem} alt={post.titulo} style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <Badge cat={post.categoria} />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(post.data)}</span>
                </div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 14 }}>{post.titulo}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.descricao}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>❤️ {post.curtidas.length} · 💬 {post.comentarios.length}</span>
                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => abrirEditar(post)}>Editar</button>
                <button onClick={() => setConfirmarExcluir(post)} style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "var(--danger)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17 }}>{modal === "novo" ? "Nova postagem" : "Editar postagem"}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">IMAGEM DE DESTAQUE</label>
                <ImageUpload value={form.imagem} onChange={v => setForm(p => ({ ...p, imagem: v }))} />
              </div>
              <div className="form-group">
                <label className="form-label">TÍTULO *</label>
                <input className="form-input" value={form.titulo || ""} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título da postagem" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">CATEGORIA</label>
                  <select className="form-input" value={form.categoria || "Notícia"} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">DATA</label>
                  <input className="form-input" type="date" lang="pt-BR" value={form.data || ""} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">DESCRIÇÃO *</label>
                <textarea className="form-input" rows={4} value={form.descricao || ""} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Descreva o conteúdo da postagem..." style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={salvar}>{modal === "novo" ? "Publicar" : "Salvar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir && (
        <div className="modal-overlay" onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Excluir postagem?</div>
              <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>Esta ação não pode ser desfeita.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>Cancelar</button>
                <button onClick={() => { setPostagens(p => p.filter(x => x.id !== confirmarExcluir.id)); setConfirmarExcluir(null); }} style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminFerias({ ferias, setFerias, dayoff, setDayoff }) {
  const [sub, setSub] = useState("ferias");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [confirmarExcluir, setConfirmarExcluir] = useState(null);
  const lista = sub === "ferias" ? ferias : dayoff;
  const setLista = sub === "ferias" ? setFerias : setDayoff;

  const abrirNovo = () => { setForm({ colaboradorId: "", inicio: "", fim: "", status: "marcado" }); setModal("novo"); };
  const salvar = () => {
    if (!form.colaboradorId || !form.inicio || !form.fim) return;
    const col = COLABORADORES.find(c => c.id === parseInt(form.colaboradorId));
    const fmt = (d) => d.split("-").reverse().join("/");
    const item = { colaborador: col, inicio: fmt(form.inicio), fim: fmt(form.fim), status: form.status };
    if (modal === "novo") setLista(p => [...p, item]);
    else setLista(p => p.map((f, i) => i === modal ? item : f));
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="filter-tabs">
          <button className={`filter-tab ${sub === "ferias" ? "active" : ""}`} onClick={() => setSub("ferias")}>✈️ Férias</button>
          <button className={`filter-tab ${sub === "dayoff" ? "active" : ""}`} onClick={() => setSub("dayoff")}>🏖️ Day Off</button>
        </div>
        <button className="btn-primary" onClick={abrirNovo}>+ Adicionar</button>
      </div>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map((item, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar col={item.colaborador} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.colaborador.nome}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.colaborador.cargo}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>📅 {item.inicio} → {item.fim}</div>
              </div>
              {sub === "ferias" && <span className={`status-chip ${item.status === "em_andamento" ? "status-andamento" : "status-marcado"}`}>{item.status === "em_andamento" ? "Em andamento" : "Marcado"}</span>}
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { const isoFmt = d => d.split("/").reverse().join("-"); setForm({ colaboradorId: String(item.colaborador.id), inicio: isoFmt(item.inicio), fim: isoFmt(item.fim), status: item.status || "marcado" }); setModal(i); }}>Editar</button>
                <button onClick={() => setConfirmarExcluir(i)} style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "var(--danger)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Remover</button>
              </div>
            </div>
          </div>
        ))}
        {lista.length === 0 && <div className="empty-state">Nenhum registro encontrado.</div>}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17 }}>{modal === "novo" ? `Adicionar ${sub === "ferias" ? "Férias" : "Day Off"}` : "Editar registro"}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">COLABORADOR *</label>
                <select className="form-input" value={form.colaboradorId || ""} onChange={e => setForm(p => ({ ...p, colaboradorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {COLABORADORES.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">INÍCIO *</label><input className="form-input" type="date" lang="pt-BR" value={form.inicio || ""} onChange={e => setForm(p => ({ ...p, inicio: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">FIM *</label><input className="form-input" type="date" lang="pt-BR" value={form.fim || ""} onChange={e => setForm(p => ({ ...p, fim: e.target.value }))} /></div>
              </div>
              {sub === "ferias" && (
                <div className="form-group">
                  <label className="form-label">STATUS</label>
                  <select className="form-input" value={form.status || "marcado"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="marcado">Marcado</option>
                    <option value="em_andamento">Em andamento</option>
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={salvar}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmarExcluir !== null && (
        <div className="modal-overlay" onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Remover registro?</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>Essa ação não pode ser desfeita.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmarExcluir(null)}>Cancelar</button>
                <button onClick={() => { setLista(p => p.filter((_, i) => i !== confirmarExcluir)); setConfirmarExcluir(null); }} style={{ background: "var(--danger)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Remover</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminAniversarios({ aniversariantes, setAniversariantes }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const abrirNovo = () => { setForm({ colaboradorId: "", data: "", diasRestantes: 0, reacoes: [] }); setModal("novo"); };
  const salvar = () => {
    if (!form.colaboradorId || !form.data) return;
    const col = COLABORADORES.find(c => c.id === parseInt(form.colaboradorId));
    const item = { colaborador: col, data: form.data, diasRestantes: parseInt(form.diasRestantes) || 0, reacoes: form.reacoes || [] };
    if (modal === "novo") setAniversariantes(p => [...p, item]);
    else setAniversariantes(p => p.map((x, i) => i === modal ? item : x));
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn-primary" onClick={abrirNovo}>+ Adicionar aniversário</button>
      </div>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {aniversariantes.map((a, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar col={a.colaborador} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.colaborador.nome}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.colaborador.cargo}</div>
              </div>
              <div style={{ textAlign: "center", minWidth: 60 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>{a.data}</div>
                {a.diasRestantes === 0 ? <span className="today-badge">HOJE</span> : <div style={{ fontSize: 11, color: "var(--muted)" }}>em {a.diasRestantes}d</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { setForm({ ...a, colaboradorId: String(a.colaborador.id) }); setModal(i); }}>Editar</button>
                <button onClick={() => setAniversariantes(p => p.filter((_, j) => j !== i))} style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "var(--danger)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Remover</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17 }}>{modal === "novo" ? "Adicionar aniversário" : "Editar aniversário"}</div>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">COLABORADOR *</label>
                <select className="form-input" value={form.colaboradorId || ""} onChange={e => setForm(p => ({ ...p, colaboradorId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {COLABORADORES.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">DATA (DD/MM)</label><input className="form-input" value={form.data || ""} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} placeholder="Ex: 22/03" /></div>
                <div className="form-group"><label className="form-label">DIAS RESTANTES</label><input className="form-input" type="number" min="0" value={form.diasRestantes || 0} onChange={e => setForm(p => ({ ...p, diasRestantes: e.target.value }))} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={salvar}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tela, setTela] = useState("login");
  const [pagina, setPagina] = useState("dashboard");
  const [postModal, setPostModal] = useState(null);
  const [isAdmin] = useState(true);

  // Shared state (admin edits reflect everywhere)
  const [postagens, setPostagens] = useState(POSTAGENS_INIT);
  const [aniversariantes, setAniversariantes] = useState(ANIVERSARIANTES_INIT);
  const [ferias, setFerias] = useState(FERIAS_INIT);
  const [dayoff, setDayoff] = useState(DAYOFF_INIT);

  const eu = COLABORADORES.find(c => c.isMe);

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "⌂" },
    { id: "postagens", label: "Postagens", icon: "📄" },
    { id: "colaboradores", label: "Colaboradores", icon: "👥" },
    { id: "aniversarios", label: "Aniversários", icon: "🎂" },
    { id: "ferias", label: "Férias & Day Off", icon: "✈️" },
    { id: "galeria", label: "Galeria", icon: "📸" },
    { id: "mural", label: "Mural", icon: "💬" },
  ];

  const titles = {
    dashboard: "Dashboard", postagens: "Postagens", colaboradores: "Colaboradores",
    aniversarios: "Aniversários", ferias: "Férias & Day Off", galeria: "Galeria",
    mural: "Mural", perfil: "Meu Perfil", admin: "Painel Admin",
  };

  const PAGINAS = {
    dashboard: <DashboardPage onOpenPost={setPostModal} postagens={postagens} aniversariantes={aniversariantes} ferias={ferias} dayoff={dayoff} />,
    postagens: <PostagensPage onOpen={setPostModal} postagens={postagens} />,
    colaboradores: <ColaboradoresPage />,
    aniversarios: <AniversariosPage aniversariantes={aniversariantes} setAniversariantes={setAniversariantes} />,
    ferias: <FeriasPage ferias={ferias} dayoff={dayoff} />,
    galeria: <GaleriaPage />,
    mural: <MuralPage />,
    perfil: <PerfilPage />,
    admin: <AdminPage postagens={postagens} setPostagens={setPostagens} ferias={ferias} setFerias={setFerias} dayoff={dayoff} setDayoff={setDayoff} aniversariantes={aniversariantes} setAniversariantes={setAniversariantes} />,
  };

  if (tela === "login") return <><style>{globalCSS}</style><LoginPage onLogin={() => setTela("primeiro_acesso")} /></>;
  if (tela === "primeiro_acesso") return <><style>{globalCSS}</style><PrimeiroAcessoPage onConcluir={() => setTela("app")} /></>;

  return (
    <>
      <style>{globalCSS}</style>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">P</div>
          <div><div className="logo-text">Panet</div><div className="logo-sub">Intranet da Pan</div></div>
        </div>
        <div className="nav-section">
          <div className="nav-label">Principal</div>
          {NAV.map(n => (
            <button key={n.id} className={`nav-item ${pagina === n.id ? "active" : ""}`} onClick={() => setPagina(n.id)}>
              <span className="nav-icon">{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="nav-section">
            <div className="nav-label">Administração</div>
            <button className={`nav-item ${pagina === "admin" ? "active" : ""}`} onClick={() => setPagina("admin")}>
              <span className="nav-icon">⚙️</span>Painel Admin
            </button>
          </div>
        )}
        <div className="sidebar-user" onClick={() => setPagina("perfil")}>
          <Avatar col={eu} size={34} />
          <div className="user-info"><div className="user-name">{eu.nome}</div><div className="user-role">{eu.cargo}</div></div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>✏️</span>
        </div>
      </nav>

      <div className="main-wrap">
        <div className="topbar">
          <div className="page-title">{titles[pagina]}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input className="search-input" placeholder="🔍  Buscar..." />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot-online" />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Online</span>
            </div>
          </div>
        </div>
        <div className="content">{PAGINAS[pagina]}</div>
      </div>

      {postModal && <PostModal post={postModal} onClose={() => setPostModal(null)} />}
    </>
  );
}
