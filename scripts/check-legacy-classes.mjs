/**
 * Codemod descartavel da Fase 1 da adocao do HeroUI.
 *
 * Renomeia as 4 classes da Panet que colidem com os blocos BEM do HeroUI:
 *   .card -> .pan-card | .modal -> .pan-modal
 *   .skeleton -> .pan-skeleton | .pagination -> .pan-pagination
 *
 * Nao usa sed de proposito: "modal" tambem e nome de variavel JS em 12+
 * arquivos (ex. AdminColaboradores.jsx `const [modal, setModal]`), entao a
 * troca precisa acontecer so dentro de literais de string no valor de
 * className. Por isso o parsing manual balanceado em parseClassNameValue().
 *
 * Uso:
 *   node scripts/tmp-rename-classes.mjs            aplica
 *   node scripts/tmp-rename-classes.mjs --check    so reporta (exit 1 se achar)
 */
import fs from "node:fs";
import path from "node:path";

const MAP = {
  card: "pan-card",
  modal: "pan-modal",
  skeleton: "pan-skeleton",
  pagination: "pan-pagination",
};
const TOKENS = Object.keys(MAP);
const CHECK = process.argv.includes("--check");

// Ponto literal + fronteira a direita: pega `.card` e `.card:hover`,
// ignora `.post-card` (o char antes de "card" e "-", nao ".") e `.card-header`.
const CSS_RE = new RegExp(String.raw`\.(${TOKENS.join("|")})(?![A-Za-z0-9_-])`, "g");
// Token isolado dentro de uma lista de classes separada por espaco.
const TOKEN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9_-])(${TOKENS.join("|")})(?![A-Za-z0-9_-])`,
  "g",
);

const listFiles = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else if (/\.(css|jsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
};

/**
 * A partir do indice do `=` de um className, devolve [inicio, fim) do valor.
 * Cobre as tres formas: "...", '...' e {...} com chaves aninhadas, pulando
 * o conteudo de strings/templates para nao fechar cedo demais.
 */
const parseClassNameValue = (src, eqIdx) => {
  let i = eqIdx + 1;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  const start = i;
  const open = src[i];

  if (open === '"' || open === "'") {
    i += 1;
    while (i < src.length) {
      if (src[i] === "\\") i += 2;
      else if (src[i] === open) return [start, i + 1];
      else i += 1;
    }
    return null;
  }

  if (open !== "{") return null;

  let depth = 0;
  let quote = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return [start, i + 1];
    }
    i += 1;
  }
  return null;
};

/** Troca os tokens apenas dentro dos literais de string/template do trecho. */
const rewriteValue = (value, onHit) =>
  value.replace(/(["'`])((?:[^\\]|\\.)*?)\1/gs, (_full, quote, body) => {
    const next = body.replace(TOKEN_RE, (_m, token) => {
      onHit();
      return MAP[token];
    });
    return quote + next + quote;
  });

const rewriteJsx = (src, onHit) => {
  let out = "";
  let cursor = 0;
  const attrRe = /className\s*=/g;
  let match;
  while ((match = attrRe.exec(src)) !== null) {
    const span = parseClassNameValue(src, match.index + match[0].length - 1);
    if (!span) continue;
    const [start, end] = span;
    out += src.slice(cursor, start) + rewriteValue(src.slice(start, end), onHit);
    cursor = end;
    attrRe.lastIndex = end;
  }
  return out + src.slice(cursor);
};

let hits = 0;
const touched = [];
for (const file of listFiles("src")) {
  const src = fs.readFileSync(file, "utf8");
  const before = hits;
  const out = file.endsWith(".css")
    ? src.replace(CSS_RE, (_m, token) => {
        hits += 1;
        return "." + MAP[token];
      })
    : rewriteJsx(src, () => {
        hits += 1;
      });

  if (out !== src) {
    touched.push(`${file} (${hits - before})`);
    if (!CHECK) fs.writeFileSync(file, out, "utf8");
  }
}

if (CHECK) {
  if (hits) {
    console.error(`${hits} ocorrencia(s) pendente(s) em ${touched.length} arquivo(s):`);
    touched.forEach((f) => console.error("  " + f));
  } else {
    console.log("OK: nenhuma classe legada encontrada.");
  }
  process.exit(hits ? 1 : 0);
}

console.log(`${hits} ocorrencia(s) trocada(s) em ${touched.length} arquivo(s).`);
