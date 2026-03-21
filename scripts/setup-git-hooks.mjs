import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const hooksPath = ".githooks";
const preCommitHook = path.join(repoRoot, hooksPath, "pre-commit");

try {
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "ignore"],
  });
} catch {
  console.log("Git hooks: repositorio Git nao detectado, setup ignorado.");
  process.exit(0);
}

if (!fs.existsSync(preCommitHook)) {
  console.log("Git hooks: arquivo .githooks/pre-commit nao encontrado, setup ignorado.");
  process.exit(0);
}

try {
  execFileSync("git", ["config", "--local", "core.hooksPath", hooksPath], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "ignore"],
  });
  fs.chmodSync(preCommitHook, 0o755);
  console.log("Git hooks: core.hooksPath configurado para .githooks.");
} catch (error) {
  console.warn("Git hooks: nao foi possivel configurar core.hooksPath.", error?.message || error);
}
