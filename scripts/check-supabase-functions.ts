const functionsDir = new URL("../supabase/functions/", import.meta.url);

const entries = [];
for await (const entry of Deno.readDir(functionsDir)) {
  if (!entry.isDirectory) continue;
  const indexUrl = new URL(`${entry.name}/index.ts`, functionsDir);
  try {
    const stat = await Deno.stat(indexUrl);
    if (stat.isFile) entries.push(indexUrl);
  } catch (_err) {
    // Ignore function folders without index.ts.
  }
}

entries.sort((a, b) => String(a.pathname).localeCompare(String(b.pathname), "en"));

if (entries.length === 0) {
  console.log("Nenhuma edge function encontrada em supabase/functions.");
  Deno.exit(0);
}

for (const entry of entries) {
  const entryPath = await Deno.realPath(entry);
  const relativePath = entryPath
    .replace(`${Deno.cwd()}\\`, "")
    .replace(`${Deno.cwd()}/`, "")
    .replaceAll("\\", "/");
  console.log(`\nChecking ${relativePath}`);
  const command = new Deno.Command(Deno.execPath(), {
    args: ["check", entryPath],
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await command.output();
  if (code !== 0) Deno.exit(code);
}

console.log(`\nDeno check OK: ${entries.length} edge function(s) validadas.`);
