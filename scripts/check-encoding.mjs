import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".env",
  ".example",
  ".gitignore",
  ".gitattributes",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const TEXT_FILENAMES = new Set([
  ".editorconfig",
  ".env",
  ".env.example",
  ".gitattributes",
  ".gitignore",
]);

const IGNORED_PREFIXES = [
  ".claude/",
  ".claire/",
  ".git/",
  ".agents/",
  "dist/",
  "node_modules/",
  "supabase/.temp/",
];

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const MOJIBAKE_PATTERNS = [
  /[\u00C2\u00C3][\u0080-\u00BF]/,
  /\u00E2[\u0080-\u00BF]{1,2}/,
  /\u00EF\u00BB\u00BF/,
];

function normalizeSlashes(filePath) {
  return filePath.replaceAll("\\", "/");
}

function shouldIgnore(filePath) {
  return IGNORED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function shouldCheck(filePath) {
  if (shouldIgnore(filePath)) return false;
  const baseName = path.posix.basename(filePath);
  if (TEXT_FILENAMES.has(baseName)) return true;
  return TEXT_EXTENSIONS.has(path.posix.extname(baseName).toLowerCase());
}

function listGitFiles() {
  const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return output
    .split("\u0000")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeSlashes)
    .filter(shouldCheck);
}

function walkFallback(rootDir, out = []) {
  for (const name of fs.readdirSync(rootDir)) {
    const filePath = path.join(rootDir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkFallback(filePath, out);
      continue;
    }

    const normalized = normalizeSlashes(filePath);
    if (shouldCheck(normalized)) {
      out.push(normalized);
    }
  }

  return out;
}

function listFiles() {
  try {
    return listGitFiles().filter((filePath) => fs.existsSync(filePath));
  } catch {
    return walkFallback(".");
  }
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function detectMojibake(content) {
  for (const pattern of MOJIBAKE_PATTERNS) {
    const match = pattern.exec(content);
    if (match) {
      return {
        snippet: match[0],
        line: getLineNumber(content, match.index),
      };
    }
  }
  return null;
}

const issues = [];

for (const filePath of listFiles()) {
  const raw = fs.readFileSync(filePath);
  let content = "";

  try {
    content = UTF8_DECODER.decode(raw);
  } catch {
    issues.push(`${filePath}: arquivo nao esta em UTF-8 valido.`);
    continue;
  }

  if (content.includes("\uFFFD")) {
    issues.push(`${filePath}: contem o caractere de substituicao \\uFFFD.`);
  }

  const mojibake = detectMojibake(content);
  if (mojibake) {
    issues.push(`${filePath}: possivel mojibake na linha ${mojibake.line} (${JSON.stringify(mojibake.snippet)}).`);
  }
}

if (issues.length > 0) {
  console.error("Falha na validacao de encoding:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Encoding OK: todos os arquivos de texto versionados estao em UTF-8 valido.");
