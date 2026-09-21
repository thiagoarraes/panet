// Ícone de marca por serviço do PanPass.
//
// Cobre só o que o Simple Icons (via react-icons/si) tem de forma segura.
// Adobe, ChatGPT/OpenAI, Slack, LinkedIn, Salesforce, Amazon e Canva NÃO
// entram de propósito: o Simple Icons removeu essas marcas do conjunto após
// pedidos de retirada por direito de marca. Contornar baixando o logo de
// outro lugar (CDN de terceiros, favicon) reproduziria o mesmo risco que o
// projeto evitou ao tirar do ar. Pra esses casos o card cai no monograma
// colorido abaixo — se quiser o logo oficial, o campo "Logo (URL)" no
// formulário do admin aceita a imagem direto.
import {
  SiAirtable, SiClickup, SiDiscord, SiDropbox, SiEnvato, SiFacebook, SiFigma,
  SiGithub, SiGoogledrive, SiHubspot, SiInstagram, SiLoom, SiMailchimp,
  SiMiro, SiNotion, SiTelegram, SiTiktok, SiTrello, SiVercel, SiWhatsapp,
  SiX, SiYoutube, SiZoom,
} from "react-icons/si";

const MARCAS = [
  [/\benvato\b/, SiEnvato, "#81b441"],
  [/\binstagram\b/, SiInstagram, "#e1306c"],
  [/\bwhats ?app\b/, SiWhatsapp, "#25d366"],
  [/\byoutube\b/, SiYoutube, "#ff0000"],
  [/\btik ?tok\b/, SiTiktok, "#000000"],
  [/\bfacebook\b/, SiFacebook, "#0866ff"],
  [/\bgoogle ?drive\b/, SiGoogledrive, "#2684fc"],
  [/\bnotion\b/, SiNotion, "#000000"],
  [/\btrello\b/, SiTrello, "#0052cc"],
  [/\bmailchimp\b/, SiMailchimp, "#ffe01b"],
  [/\bhubspot\b/, SiHubspot, "#ff7a59"],
  [/\bzoom\b/, SiZoom, "#0b5cff"],
  [/\bfigma\b/, SiFigma, "#f24e1e"],
  [/\bgit ?hub\b/, SiGithub, "#181717"],
  [/\bvercel\b/, SiVercel, "#000000"],
  [/\bmiro\b/, SiMiro, "#ffd02f"],
  [/\bairtable\b/, SiAirtable, "#18bfff"],
  [/\bclick ?up\b/, SiClickup, "#7b68ee"],
  [/\bloom\b/, SiLoom, "#625df5"],
  [/\bdropbox\b/, SiDropbox, "#0061ff"],
  [/\btelegram\b/, SiTelegram, "#26a5e4"],
  [/\b(x|twitter)\b/, SiX, "#000000"],
  [/\bdiscord\b/, SiDiscord, "#5865f2"],
];

const normalizar = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Devolve { Icon, cor } quando o nome do serviço casa com uma marca segura,
// ou null quando não há match (cai no monograma).
export function buscarMarcaPanPass(nome) {
  const alvo = normalizar(nome);
  for (const [re, Icon, cor] of MARCAS) {
    if (re.test(alvo)) return { Icon, cor };
  }
  return null;
}

// Cor determinística a partir do nome: o mesmo serviço sempre cai na mesma
// cor, sem precisar guardar nada.
export function corMonogramaPanPass(nome) {
  const s = String(nome || "?");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 62% 46%)`;
}

export function iniciaisPanPass(nome) {
  return (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
