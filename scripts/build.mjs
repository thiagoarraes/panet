import { spawnSync } from "node:child_process";

const npmCliPath = process.env.npm_execpath;
const isVercelBuild = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const run = (label, args) => {
  console.log(label);
  if (!npmCliPath) {
    console.error("Build pipeline failed to start: npm_execpath is not available.");
    process.exit(1);
  }

  const result = spawnSync(process.execPath, [npmCliPath, ...args], {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`Build pipeline failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run("Running UTF-8 encoding checks...", ["run", "check:encoding"]);

if (isVercelBuild) {
  console.log("Skipping Supabase edge function checks on Vercel build.");
} else {
  run("Running Supabase edge function checks...", ["run", "check:functions"]);
}

run("Building Vite app...", ["run", "build:app"]);
