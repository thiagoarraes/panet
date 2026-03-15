import fs from "node:fs";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".json",
  ".md",
  ".mjs",
  ".cjs",
]);

const decUtf8Fatal = new TextDecoder("utf-8", { fatal: true });
const mojibakeRegex = /[\u00C3\u00C2\u00E2][\u0080-\u00BF]|[\u00F0][\u0080-\u00BF]/;

const issues = [];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, out);
      continue;
    }
    if (TEXT_EXTENSIONS.has(path.extname(name))) {
      out.push(filePath);
    }
  }
  return out;
}

function relative(filePath) {
  return filePath.replaceAll("\\", "/");
}

for (const filePath of walk("src")) {
  const raw = fs.readFileSync(filePath);
  let content = "";
  try {
    content = decUtf8Fatal.decode(raw);
  } catch {
    issues.push(`${relative(filePath)}: arquivo não está em UTF-8 válido.`);
    continue;
  }

  if (content.includes("\uFFFD")) {
    issues.push(`${relative(filePath)}: contém caractere de substituição (�).`);
  }
  if (mojibakeRegex.test(content)) {
    issues.push(`${relative(filePath)}: possível mojibake detectado.`);
  }
}

if (issues.length > 0) {
  console.error("Falha na validação de encoding:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Encoding OK: todos os arquivos em src estão em UTF-8 válido.");
