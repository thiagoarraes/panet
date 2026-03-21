import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import path from "node:path";

const exists = async (target) => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const findDenoInWingetPackages = async (baseDir) => {
  if (!(await exists(baseDir))) return null;
  const entries = await readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("DenoLand.Deno_")) continue;
    const candidate = path.join(baseDir, entry.name, "deno.exe");
    if (await exists(candidate)) return candidate;
  }
  return null;
};

const resolveDenoExecutable = async () => {
  const localAppData = process.env.LOCALAPPDATA || "";
  const explicit = process.env.DENO_BIN ? path.resolve(process.env.DENO_BIN) : "";
  const candidates = [
    explicit,
    path.join(localAppData, "Microsoft", "WinGet", "Links", "deno.exe"),
    path.join(localAppData, "Microsoft", "WindowsApps", "deno.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }

  const wingetPackage = await findDenoInWingetPackages(path.join(localAppData, "Microsoft", "WinGet", "Packages"));
  if (wingetPackage) return wingetPackage;

  return "deno";
};

const denoExecutable = await resolveDenoExecutable();
const args = process.argv.slice(2);

const child = spawn(denoExecutable, args, {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`Falha ao executar Deno: ${error.message}`);
  process.exit(1);
});
